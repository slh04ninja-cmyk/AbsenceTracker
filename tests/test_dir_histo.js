// Test jsdom : page Historique du DIRECTEUR (remplace la page Absences) — v3.33
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const now = new Date();
const jour = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
const classe = { id: 1, nom: '3eme A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] };
const B = { classe: '3eme A', dateISO: jour, date: '10/09/2026', seance: 'matin', heure: '08:00', enseignant: 'أيوب الكمرة', matiere: 'Maths' };
const absences = [
  Object.assign({ id: 1, eleveId: 1, nom: 'El Amrani Ahmed', type: 'absence', statut: 'justifie_d', justifiePar: 'Directeur', justifieLe: jour + ' 09:30', motif: 'Maladie' }, B),
  Object.assign({ id: 2, eleveId: 1, nom: 'El Amrani Ahmed', type: 'retard', statut: 'justifie_s', justifiePar: 'Surveillant 1', justifieLe: jour + ' 10:15', motif: 'Transport' }, B),
  Object.assign({ id: 3, eleveId: 2, nom: 'Benali Fatima', type: 'absence', statut: 'justifie_s', justifiePar: 'Surveillant 2', justifieLe: jour + ' 11:05', motif: 'Autre' }, B),
  Object.assign({ id: 4, eleveId: 2, nom: 'Benali Fatima', type: 'absence', statut: 'absent' }, B)   // non regle -> hors historique
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('classes', JSON.stringify([classe]));
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('absences', JSON.stringify(absences));
    win.localStorage.setItem('testHistoGenere_v1', '1');
    win.localStorage.setItem('testHistoGenere_v2', '1');
    win.localStorage.setItem('testHistoGenere_v3', '1');
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const compte = role => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='" + role + "';})[0])"));
const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };
const clic = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));

setTimeout(() => {
  // 0. la page Absences a disparu, la page Profil est intacte
  t('page-dir-absences supprimee', doc.getElementById('page-dir-absences') === null);
  t('page Historique presente', !!doc.getElementById('page-dir-historique'));
  t('page Profil intacte', !!doc.getElementById('page-profil') && !!doc.getElementById('profil-nom'));

  // v3.46 : les classes des tableaux de service sont ajoutees automatiquement -> on garde les notres
  win.eval("classes = classes.filter(function(c){ return " + JSON.stringify(['3eme A']) + ".indexOf(c.nom) >= 0; });");
  connecter(compte('directeur'));


  // 1. nav du dashboard : Dashboard puis Historique
  const nav = doc.querySelector('#page-directeur .bottom-nav');
  const items = Array.from(nav.querySelectorAll('.nav-item')).map(n => ({
    txt: n.querySelector('span').textContent,
    icone: n.querySelector('.nav-icon i').className,
    onclick: n.getAttribute('onclick')
  }));
  // v3.64 : pour le directeur, le dernier onglet s'appelle "RH"
  t('ordre du nav = Dashboard / Historique / Stats / Gestion / RH',
    items.map(i => i.txt).join('|') === 'Dashboard|Historique|Stats|Gestion|RH', items.map(i => i.txt).join('|'));
  t('Historique est bien le 2e', items[1].txt === 'Historique');
  t('icone fa-history sur le 2e', items[1].icone.indexOf('fa-history') > 0, items[1].icone);
  t('le 2e pointe vers dir-historique', items[1].onclick.indexOf("switchDirPage('dir-historique'") >= 0, items[1].onclick);
  t('plus aucun item Absences', items.filter(i => i.txt === 'Absences').length === 0);

  // 2. structure de la page (identique au surveillant)
  const surv = doc.getElementById('page-surv-classes');
  const dir = doc.getElementById('page-dir-historique');
  const comparer = (a, b, sel) => a.querySelector(sel) && b.querySelector(sel) &&
    a.querySelector(sel).tagName === b.querySelector(sel).tagName;
  t('titre identique au surveillant',
    dir.querySelector('h2').textContent === surv.querySelector('h2').textContent,
    dir.querySelector('h2').textContent);
  t('bloc recherche identique', comparer(surv, dir, '.stat-card label') && comparer(surv, dir, 'input[type=text]'));
  t('conteneur de liste', !!dir.querySelector('#dir-historique-list'));
  t('pas de doublon d id avec le surveillant',
    doc.querySelectorAll('#recherche-eleve').length === 1 && doc.querySelectorAll('#dir-recherche-eleve').length === 1);

  // 3. rendu de la liste (Ab/Rd regles uniquement, tri par total)
  win.switchDirPage('dir-historique');
  const cartes = Array.from(dir.querySelectorAll('#dir-historique-list .carte-eleve'));
  t('page active apres clic sur l onglet', dir.classList.contains('active'));
  t('2 eleves (le non regle est exclu)', cartes.length === 2, cartes.length);
  t('1re carte = le plus de Ab/Rd (El Amrani, 2)',
    cartes[0].querySelector('.absence-card-name').textContent === 'El Amrani Ahmed' &&
    cartes[0].querySelector('.carte-eleve-total').textContent === '2',
    cartes[0].querySelector('.absence-card-name').textContent + ' / ' + cartes[0].querySelector('.carte-eleve-total').textContent);
  t('meme rendu que le surveillant (nom / classe / total / chevron)',
    !!cartes[0].querySelector('.absence-card-ligne') && !!cartes[0].querySelector('.absence-card-classe') &&
    !!cartes[0].querySelector('.absence-card-icon'));

  // 4. recherche
  const champ = doc.getElementById('dir-recherche-eleve');
  champ.value = 'Benali';
  win.rechercherEleves('dir-recherche-eleve', 'dir-resultats-recherche');
  t('recherche remplie', doc.getElementById('dir-resultats-recherche').children.length === 1,
    doc.getElementById('dir-resultats-recherche').children.length);

  // 5. clic sur une carte -> fiche eleve (popup partage)
  clic(cartes[0]);
  const fiche = doc.getElementById('modal-fiche-eleve');
  t('popup fiche eleve ouvert', !fiche.classList.contains('hidden'));
  const ficheHtml = doc.getElementById('fiche-historique').innerHTML;
  t('fiche = bon eleve + marques simples + lignes d approbation (D et S1)',
    doc.getElementById('fiche-titre').textContent.indexOf('El Amrani') >= 0 &&
    ficheHtml.indexOf('Ab - D') < 0 && ficheHtml.indexOf('Rd - S1') < 0 &&
    ficheHtml.indexOf('Approuvé le') > 0 && ficheHtml.indexOf('>D<') > 0 && ficheHtml.indexOf('>S1<') > 0,
    doc.getElementById('fiche-titre').textContent);
  win.fermerFicheEleve();

  // 6. regression : le surveillant garde sa page
  connecter(compte('surveillant'));
  win.switchSurvPage('surv-classes');
  t('historique surveillant toujours fonctionnel',
    doc.getElementById('surv-classes-list').children.length === 2,
    doc.getElementById('surv-classes-list').children.length);

  // 7. le dashboard directeur fonctionne toujours (carte + liste des absents)
  connecter(compte('directeur'));
  t('dashboard directeur : compteurs', doc.getElementById('dir-total').textContent === '4', doc.getElementById('dir-total').textContent);
  t('dashboard directeur : cartes des non justifies', doc.getElementById('dir-absences-list').querySelectorAll('.absence-card').length === 1,
    doc.getElementById('dir-absences-list').querySelectorAll('.absence-card').length);
  t('Gestion toujours accessible', !!doc.getElementById('page-dir-gestion'));

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
