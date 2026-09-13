// Test jsdom : v3.61 — page Profil → RH (directeur) : popup Profil, rubriques RH,
// mot de passe aléatoire du prof, email {matière}-prof{x}@taalim.ma
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [
  { id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] }
];
const absences = [
  { id: 1, eleveId: 1, nom: 'El Amrani Ahmed', classe: 'TCSF-1', dateISO: '2026-09-11', date: '11/09/2026',
    seance: 'matin', heure: '08:30', type: 'absence', statut: 'absent', enseignant: 'غزالي صالح',
    profCode: 'pc-prof1', matiere: 'PC', test: true }
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', JSON.stringify(absences));
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const compteMail = m => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='" + m + "';})[0])"));
const connecter = (m, mdp) => {
  doc.getElementById('login-email').value = m;
  doc.getElementById('login-password').value = mdp;
  win.connexion();
  return doc.getElementById('page-directeur').classList.contains('active') || doc.getElementById('page-enseignant').classList.contains('active') ||
         doc.getElementById('page-surveillant').classList.contains('active');
};
const txt = id => doc.getElementById(id).textContent;
const val = id => doc.getElementById(id).value;

setTimeout(() => {
  // ══════════ 1. Connexion directeur : la page devient RH ══════════
  connecter('d@taalim.ma', '12345');
  const navDir = Array.from(doc.querySelectorAll('#profil-nav-dir .nav-item span')).map(s => s.textContent);
  t('dernier onglet du directeur = RH', navDir[navDir.length - 1] === 'RH', navDir.join('|'));
  const navEns = Array.from(doc.querySelectorAll('#profil-nav-ens .nav-item span')).map(s => s.textContent);
  t('les autres roles gardent "Profil"', navEns[navEns.length - 1] === 'Profil', navEns.join('|'));

  win.switchProfil();
  t('rubrique RH affichée pour le directeur', doc.getElementById('profil-rh').style.display === 'block');
  t('bouton Profil affiché', doc.getElementById('btn-profil-dir').style.display === 'inline-flex',
    doc.getElementById('btn-profil-dir').style.display);
  t('formulaire mot de passe de la page masqué (il est dans le popup)',
    doc.getElementById('profil-mdp-page').style.display === 'none');
  t('rubriques RH = carte Surveillants + carte Enseignants',
    !!doc.querySelector('#profil-rh #surv-card') && !!doc.querySelector('#profil-rh #ens-card') &&
    !!doc.querySelector('#profil-rh #dir-profs-list') && !!doc.querySelector('#profil-rh #dir-surveillants-list'));
  t('les cartes RH ont quitté Gestion',
    doc.querySelector('#page-dir-gestion #dir-profs-list') === null && doc.querySelector('#page-dir-gestion #indispo-card') === null);

  // ══════════ 2. Popup Profil : nom ══════════
  win.ouvrirProfilDir();
  t('popup ouvert + nom prérempli', !doc.getElementById('modal-profil-dir').classList.contains('hidden') && val('mdpdir-nom') === 'Directeur',
    val('mdpdir-nom'));
  t('email de connexion affiché dans le popup', txt('mdpdir-email').indexOf('d@taalim.ma') >= 0, txt('mdpdir-email'));
  val('mdpdir-nom');
  doc.getElementById('mdpdir-nom').value = 'Nadia Bennis';
  win.enregistrerProfilDir();
  t('nom du directeur mis à jour (compte + carte)',
    compteMail('d@taalim.ma').nom === 'Nadia Bennis' && txt('profil-nom') === 'Nadia Bennis',
    compteMail('d@taalim.ma').nom + ' / ' + txt('profil-nom'));
  t('nom persisté (override par email)', JSON.parse(win.localStorage.getItem('nomsProfs'))['d@taalim.ma'] === 'Nadia Bennis',
    win.localStorage.getItem('nomsProfs'));

  // ══════════ 3. Popup Profil : mot de passe persistant ══════════
  doc.getElementById('mdpdir-ancien').value = '12345';
  doc.getElementById('mdpdir-nouveau').value = 'directeur9';
  doc.getElementById('mdpdir-confirmer').value = 'directeur9';
  win.enregistrerProfilDir();
  const mdpStockes = JSON.parse(win.localStorage.getItem('motsDePasse') || '{}');
  t('mot de passe persisté', mdpStockes['d@taalim.ma'] === 'directeur9', JSON.stringify(mdpStockes));
  t('champs vidés + message de succès', val('mdpdir-nouveau') === '' && txt('mdpdir-success').indexOf('succès') >= 0,
    txt('mdpdir-success'));
  // le mécanisme de persistance réalimente les comptes au chargement
  win.eval("comptes.filter(function(c){return c.email==='d@taalim.ma';})[0].password = '12345'; appliquerMotsDePasse()");
  t('au chargement suivant, le nouveau mot de passe est appliqué',
    compteMail('d@taalim.ma').password === 'directeur9', compteMail('d@taalim.ma').password);
  // ancien mot de passe refusé
  doc.getElementById('mdpdir-ancien').value = 'faux';
  doc.getElementById('mdpdir-nouveau').value = 'autre123';
  doc.getElementById('mdpdir-confirmer').value = 'autre123';
  win.enregistrerProfilDir();
  t('ancien mot de passe incorrect refusé', txt('mdpdir-error').indexOf('incorrect') >= 0 && compteMail('d@taalim.ma').password === 'directeur9',
    txt('mdpdir-error'));
  win.fermerProfilDir();
  t('popup refermé', doc.getElementById('modal-profil-dir').classList.contains('hidden'));

  // ══════════ 4. Professeurs : cartes compactes + email ══════════
  const items = Array.from(doc.querySelectorAll('#dir-profs-list > div'));
  t('11 professeurs listés', items.length === 11, items.length);
  t('cartes comme les listes d absences (.js-personnel + renderer partage)',
    items[0].className.indexOf('px-3') < 0 && items[0].className.indexOf('py-2') < 0 &&
    doc.getElementById('dir-profs-list').classList.contains('js-personnel') &&
    !!items[0].querySelector('.carte-ligne-titre') && !!items[0].querySelector('.carte-ligne-sous'), items[0].className);
  t('email affiché dans la liste', txt('dir-profs-list').indexOf('pc-prof1@taalim.ma') >= 0);

  // ══════════ 5. Modale de modification : email + mot de passe généré ══════════
  win.ouvrirRenommageProf('pc-prof1');
  t('email de connexion du prof affiché', txt('renommer-email').indexOf('pc-prof1@taalim.ma') >= 0, txt('renommer-email'));
  t('format {matière}-prof{x}@taalim.ma', win.eval("/^pc-prof\\d+@taalim\\.ma$/.test('pc-prof1@taalim.ma')") === true);
  win.genererMotDePasseProf();
  const genere = val('renommer-mdp');
  t('mot de passe généré de 8 caractères', genere.length === 8, genere);
  t('mot de passe généré valide (lettre + chiffre, sans caractère spécial)',
    win.eval("validerMotDePasse('" + genere + "') === null"), win.eval("validerMotDePasse('" + genere + "')"));
  const valides = [];
  for (let i = 0; i < 20; i++) { win.genererMotDePasseProf(); valides.push(win.eval("validerMotDePasse('" + val('renommer-mdp') + "') === null")); }
  t('20 générations toutes valides', valides.every(v => v === true));
  // mot de passe invalide refusé
  doc.getElementById('renommer-mdp').value = 'abc';
  win.confirmerRenommageProf();
  t('mot de passe trop faible refusé', (JSON.parse(win.localStorage.getItem('motsDePasse') || '{}'))['pc-prof1@taalim.ma'] === undefined,
    txt('toast'));
  // mot de passe valide enregistré + identifiants affichés
  win.genererMotDePasseProf();
  const mdpProf = val('renommer-mdp');
  win.confirmerRenommageProf();
  t('mot de passe du prof persisté',
    (JSON.parse(win.localStorage.getItem('motsDePasse') || '{}'))['pc-prof1@taalim.ma'] === mdpProf,
    win.localStorage.getItem('motsDePasse'));
  t('modale gardée ouverte avec les identifiants',
    !doc.getElementById('modal-renommer').classList.contains('hidden') &&
    txt('renommer-success').indexOf('pc-prof1@taalim.ma') >= 0 && txt('renommer-success').indexOf(mdpProf) >= 0,
    txt('renommer-success'));
  t('compte du prof mis à jour', compteMail('pc-prof1@taalim.ma').password === mdpProf);
  win.fermerRenommageProf();

  // ══════════ 6. Connexion du prof avec son mot de passe généré ══════════
  win.deconnexion();
  t('connexion du prof avec le mot de passe généré', connecter('pc-prof1@taalim.ma', mdpProf) === true);
  t('le prof voit sa page', doc.getElementById('page-enseignant').classList.contains('active'));
  win.switchProfil();
  t('pour un prof : pas de bouton Profil ni de rubrique RH',
    doc.getElementById('btn-profil-dir').style.display === 'none' && doc.getElementById('profil-rh').style.display === 'none');
  t('pour un prof : formulaire mot de passe sur la page', doc.getElementById('profil-mdp-page').style.display === 'block');
  // ancien mot de passe refusé pour le prof
  win.deconnexion();
  t('ancien mot de passe du prof refusé', connecter('pc-prof1@taalim.ma', '12345') === false);

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
