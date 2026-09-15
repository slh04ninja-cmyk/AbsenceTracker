// Test jsdom : v3.65 — RH = carte Surveillants + carte Enseignants (segments Liste / Absence),
// onglet RH partout, 6 cartes avant défilement, absence du personnel
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }] }];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', '[]');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
const absPerso = () => JSON.parse(win.localStorage.getItem('indispoProfs') || '[]');

setTimeout(() => {
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();

  // ---------- 1. Onglet RH sur toutes les pages du directeur ----------
  const pagesDir = [['page-directeur', '.bottom-nav'], ['page-dir-historique', '.bottom-nav'],
                    ['page-dir-stats', '.bottom-nav'], ['page-dir-gestion', '.bottom-nav'],
                    ['page-profil', '#profil-nav-dir']];
  const derniers = pagesDir.map(([id, sel]) => {
    const nav = doc.querySelector('#' + id + ' ' + sel);
    const items = nav ? nav.querySelectorAll('.nav-item span') : [];
    return items.length ? items[items.length - 1].textContent : '?';
  });
  t('onglet RH sur les 5 pages du directeur', derniers.every(x => x === 'RH'), derniers.join(' | '));

  win.switchProfil();
  // ---------- 2. Deux cartes séparées dans RH ----------
  t('carte Surveillants + carte Enseignants', !!doc.getElementById('surv-card') && !!doc.getElementById('ens-card'));
  t('l ancienne carte unique "Personnel" a disparu', doc.getElementById('personnel-card') === null && doc.getElementById('annul-card') === null);
  t('2 segments Liste / Absence dans chaque carte',
    doc.querySelectorAll('#surv-card .mode-btn').length === 2 && doc.querySelectorAll('#ens-card .mode-btn').length === 2 &&
    doc.getElementById('seg-surv-liste').textContent.indexOf('Liste') >= 0 && doc.getElementById('seg-surv-absence').textContent.indexOf('Absence') >= 0 &&
    doc.getElementById('seg-ens-liste').textContent.indexOf('Liste') >= 0 && doc.getElementById('seg-ens-absence').textContent.indexOf('Absence') >= 0);
  t('Liste active, Absence masquée (les 2 cartes)',
    doc.getElementById('seg-surv-liste').classList.contains('actif') && doc.getElementById('seg-ens-liste').classList.contains('actif') &&
    doc.getElementById('vue-surv-absence').style.display === 'none' && doc.getElementById('vue-ens-absence').style.display === 'none');

  // ---------- 3. Vue Liste ----------
  t('11 enseignants listés', doc.querySelectorAll('#dir-profs-list > div').length === 11,
    doc.querySelectorAll('#dir-profs-list > div').length);
  t('2 surveillants listés', doc.querySelectorAll('#dir-surveillants-list > div').length === 2,
    doc.querySelectorAll('#dir-surveillants-list > div').length);
  const css = Array.from(doc.querySelectorAll('style')).map(x => x.textContent).join('\n');
  t('listes du personnel : meme regle que les absences (.js-personnel, plus de 286px)',
    /\.js-seances-annulees, \.js-absences-personnel, \.js-fermetures, \.js-annulations, \.js-personnel \{/.test(css) &&
    css.indexOf('max-height: 286px') < 0 &&
    doc.getElementById('dir-profs-list').classList.contains('js-personnel') &&
    doc.getElementById('dir-surveillants-list').classList.contains('js-personnel'));

  // ---------- 4. Vue Absence : surveillants ----------
  win.basculerSegments('seg-surveillants', 'seg-surv-absence');
  t('bascule Surveillants → Absence', doc.getElementById('seg-surv-absence').classList.contains('actif') &&
    doc.getElementById('vue-surv-absence').style.display === 'block' && doc.getElementById('vue-surv-liste').style.display === 'none');
  t('formulaire d absence surveillant (2 comptes listés)',
    !!doc.getElementById('abs-surv-compte') && doc.getElementById('abs-surv-compte').options.length === 2 &&
    !!doc.getElementById('abs-surv-portee') && !!doc.getElementById('abs-surv-motif'),
    doc.getElementById('abs-surv-compte').options.length);
  t('dates d absence bornées par l année scolaire',
    doc.getElementById('abs-surv-debut').min === '2026-09-01' && doc.getElementById('abs-surv-debut').max === '2027-05-15',
    doc.getElementById('abs-surv-debut').min + ' → ' + doc.getElementById('abs-surv-debut').max);
  doc.getElementById('abs-surv-compte').value = 's1@taalim.ma';
  doc.getElementById('abs-surv-debut').value = '2026-09-15';
  doc.getElementById('abs-surv-fin').value = '2026-09-16';
  doc.getElementById('abs-surv-portee').value = 'journee';
  doc.getElementById('abs-surv-motif').value = 'Maladie';
  win.enregistrerAbsSurv();
  const apres = absPerso();
  t('absence du surveillant enregistrée avec son rôle',
    apres.length === 1 && apres[0].profCode === 's1@taalim.ma' && apres[0].role === 'surveillant' && apres[0].motif === 'Maladie',
    JSON.stringify(apres[0]));
  t('absence listée dans la vue Absence des surveillants',
    doc.getElementById('abs-surv-liste').textContent.indexOf('Maladie') >= 0 && doc.getElementById('abs-surv-liste').textContent.indexOf('15/09/2026') >= 0,
    doc.getElementById('abs-surv-liste').textContent.slice(0, 60));
  t('liste des enseignants vide (séparation des deux listes)',
    doc.getElementById('indispo-liste').textContent.indexOf('Aucune absence') >= 0, doc.getElementById('indispo-liste').textContent.slice(0, 40));
  t('l absence du surveillant n annule aucune séance',
    win.eval("raisonAnnulation('2026-09-15','TCSF-1','08:00')") === null);

  // ---------- 5. Vue Absence : enseignants ----------
  win.basculerSegments('seg-enseignants', 'seg-ens-absence');
  t('bascule Enseignants → Absence', doc.getElementById('vue-ens-absence').style.display === 'block' &&
    doc.getElementById('vue-ens-liste').style.display === 'none');
  t('formulaire d absence enseignant (11 profs listés)',
    doc.getElementById('indispo-prof').options.length === 11, doc.getElementById('indispo-prof').options.length);
  doc.getElementById('indispo-prof').value = 'fr-prof1';
  doc.getElementById('indispo-debut').value = '2026-09-15';
  doc.getElementById('indispo-fin').value = '2026-09-18';
  doc.getElementById('indispo-portee').value = 'journee';
  doc.getElementById('indispo-motif').value = 'Maladie';
  win.enregistrerIndispo();
  const apres2 = absPerso();
  t('absence de l enseignant enregistrée (rôle enseignant)',
    apres2.length === 2 && apres2[1].profCode === 'fr-prof1' && apres2[1].role === 'enseignant', JSON.stringify(apres2[1]));
  t('absence listée dans la vue Absence des enseignants', doc.getElementById('indispo-liste').textContent.indexOf('سامية الحاضي') >= 0);
  t('elle annule bien les séances du prof',
    (JSON.parse(win.eval("JSON.stringify(raisonAnnulation('2026-09-15','TCSF-1','10:30'))")) || {}).source === 'indispo');
  // suppression
  const idSurv = apres2[0].id;
  win.supprimerIndispo(idSurv);
  t('suppression demandée : confirmation affichée (rien n est encore supprimé)',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') && absPerso().length === 2,
    doc.getElementById('message-confirmation').textContent);
  win.annulerConfirmation();
  t('confirmation annulée : absence conservée', absPerso().length === 2);
  win.supprimerIndispo(idSurv);
  win.validerConfirmation();
  t('suppression confirmée', absPerso().length === 1 && doc.getElementById('abs-surv-liste').textContent.indexOf('Aucune absence') >= 0);

  // ---------- 6. Modification d'un compte (Liste) ----------
  win.basculerSegments('seg-surveillants', 'seg-surv-liste');
  win.ouvrirRenommageProf('s1@taalim.ma');
  t('titre adapté au surveillant', doc.getElementById('renommer-titre').textContent === 'Nom du surveillant');
  doc.getElementById('renommer-nom').value = 'Hassan Alami';
  doc.getElementById('renommer-mdp').value = 'surv2026x';
  win.confirmerRenommageProf();
  const overrides = JSON.parse(win.localStorage.getItem('nomsProfs') || '{}');
  const mdp = JSON.parse(win.localStorage.getItem('motsDePasse') || '{}');
  t('nom + mot de passe du surveillant persistés',
    overrides['s1@taalim.ma'] === 'Hassan Alami' && mdp['s1@taalim.ma'] === 'surv2026x');
  win.fermerRenommageProf();
  t('carte du surveillant rafraîchie', doc.getElementById('dir-surveillants-list').textContent.indexOf('Hassan Alami') >= 0);
  win.deconnexion();
  doc.getElementById('login-email').value = 's1@taalim.ma';
  doc.getElementById('login-password').value = 'surv2026x';
  win.connexion();
  t('connexion du surveillant renommé', doc.getElementById('page-surveillant').classList.contains('active'));

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
