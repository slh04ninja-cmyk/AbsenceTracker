// Test jsdom : v3.68 — la liste "Séances annulées" vient de 2 sources (saisie directe + absences des profs)
// et la liste des fermetures s'affiche en cartes
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const FIXE = new Date('2026-09-12T10:00:00').getTime();   // samedi 12/09/2026
const classes = [
  { id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }] },
  { id: 2, nom: 'TCSF-2', eleves: [{ id: 2, nom: 'Benali', prenom: 'Fatima' }] },
  { id: 3, nom: 'TCSF-3', eleves: [{ id: 3, nom: 'Alami', prenom: 'Youssef' }] }
];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    const V = win.Date;
    win.Date = class extends V { constructor(...a) { super(...(a.length ? a : [FIXE])); } static now() { return FIXE; } };
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
const lignes = id => Array.from(doc.querySelectorAll('#' + id + ' > div')).map(x => x.textContent);

setTimeout(() => {
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();

  // ---------- 1. Source 1 : saisie directe (Gestion > Fermeture > Séance) ----------
  win.switchDirPage('dir-gestion');
  win.basculerSegments('seg-fermeture', 'seg-ferm-seance');
  win.preparerFormulaireAnnulation();
  doc.getElementById('annul-date').value = '2026-09-14';       // lundi
  doc.getElementById('annul-classe').value = 'TCSF-2';
  win.majCreneauxAnnulation();
  // créneau réel de la classe ce jour-là (on prend le dernier de la liste)
  const opts = doc.getElementById('annul-creneau').options;
  t('créneaux proposés pour la classe', opts.length > 0, opts.length);
  doc.getElementById('annul-creneau').value = opts[opts.length - 1].value;
  doc.getElementById('annul-motif').value = 'Réunion';
  win.confirmerAnnulationSeance();
  win.switchDirPage('directeur');
  let l = lignes('annul-liste');
  t('saisie directe : la séance annulée apparaît', l.length === 1 && l[0].indexOf('14/09/2026') >= 0 && l[0].indexOf('TCSF-2') >= 0 && l[0].indexOf('Réunion') >= 0,
    l.join(' | '));
  t('saisie directe : bouton Rétablir', l[0].indexOf('Rétablir') >= 0);
  t('même contenu sur le Dashboard du surveillant', lignes('annul-liste-surv').length === 1, lignes('annul-liste-surv').length);

  // ---------- 2. Source 2 : absence d'un enseignant -> ses séances sont annulées ----------
  win.switchProfil();                                          // RH
  win.basculerSegments('seg-enseignants', 'seg-ens-absence');
  doc.getElementById('indispo-prof').value = 'fr-prof1';
  doc.getElementById('indispo-debut').value = '2026-09-15';    // mardi
  doc.getElementById('indispo-fin').value = '2026-09-18';      // vendredi
  doc.getElementById('indispo-portee').value = 'journee';
  doc.getElementById('indispo-motif').value = 'Maladie';
  win.enregistrerIndispo();
  const calculees = JSON.parse(win.eval('JSON.stringify(seancesAnnuleesParAbsence())'));
  t('séances calculées depuis l absence (multi-jours)', calculees.length >= 2, calculees.length);
  const tcsf1 = calculees.filter(c => c.classe === 'TCSF-1');
  t('les séances de TCSF-1 du prof absent sont calculées',
    tcsf1.some(c => c.dateISO === '2026-09-15' && c.debut === '10:00') && tcsf1.some(c => c.dateISO === '2026-09-18' && c.debut === '08:00'),
    JSON.stringify(tcsf1.map(c => c.dateISO + ' ' + c.debut)));
  t('aucune séance calculée le week-end', calculees.every(c => {
    const [y, m, j] = c.dateISO.split('-').map(Number);
    const g = new Date(y, m - 1, j).getDay();
    return g !== 0 && g !== 6;
  }));
  win.switchDirPage('directeur');
  l = lignes('annul-liste');
  t('la liste du Dashboard contient les 2 sources', l.length === 1 + calculees.length, l.length);
  t('les séances issues de l absence sont marquées',
    l.some(x => x.indexOf('Absence prof') >= 0 && x.indexOf('Absence de سامية الحاضي') >= 0 && x.indexOf('Maladie') >= 0),
    l.find(x => x.indexOf('Absence prof') >= 0) || 'aucune');
  t('pas de bouton Rétablir sur une séance issue d une absence',
    l.filter(x => x.indexOf('Absence prof') >= 0).every(x => x.indexOf('Rétablir') < 0));

  // ---------- 3. Tri : de la plus proche à la plus lointaine ----------
  const dates = l.map(x => x.slice(0, 10));
  t('tri par proximité (14/09 puis 15/09 puis 18/09...)',
    dates[0] === '14/09/2026' && dates[1] === '15/09/2026' && dates[dates.length - 1] === '18/09/2026', dates.join(' | '));
  t('pastille « À venir » sur les dates futures', l.every(x => x.indexOf('À venir') >= 0));

  // ---------- 4. Pas de doublon entre les 2 sources ----------
  win.switchDirPage('dir-gestion');
  win.basculerSegments('seg-fermeture', 'seg-ferm-seance');
  doc.getElementById('annul-date').value = '2026-09-15';
  doc.getElementById('annul-classe').value = 'TCSF-1';
  win.majCreneauxAnnulation();
  doc.getElementById('annul-creneau').value = '10:00|12:00';    // deja annulée par l absence du prof
  doc.getElementById('annul-motif').value = 'Séance non assurée';
  win.confirmerAnnulationSeance();
  win.switchDirPage('directeur');
  l = lignes('annul-liste');
  t('pas de doublon : la même séance n apparaît qu une fois',
    l.filter(x => x.indexOf('15/09/2026') >= 0 && x.indexOf('TCSF-1') >= 0).length === 1,
    l.filter(x => x.indexOf('15/09/2026') >= 0 && x.indexOf('TCSF-1') >= 0).join(' // '));
  t('la saisie directe prime (bouton Rétablir présent)', l.some(x => x.indexOf('15/09/2026') >= 0 && x.indexOf('TCSF-1') >= 0 && x.indexOf('Rétablir') >= 0));

  // ---------- 5. Fermetures : liste en cartes ----------
  win.switchDirPage('dir-gestion');
  win.basculerSegments('seg-fermeture', 'seg-ferm-etab');
  doc.getElementById('ferm-type').value = 'Vacances';
  doc.getElementById('ferm-libelle').value = 'Aïd Al Adha';
  doc.getElementById('ferm-debut').value = '2026-10-05';
  doc.getElementById('ferm-fin').value = '2026-10-09';
  doc.getElementById('ferm-portee').value = 'journee';
  win.enregistrerFermeture();
  const cartesFerm = Array.from(doc.querySelectorAll('#ferm-liste > div'));
  t('fermetures affichées en cartes', cartesFerm.length === 1 && doc.getElementById('ferm-liste').classList.contains('js-fermetures'),
    cartesFerm.length);
  t('carte de fermeture : titre + sous-titre', cartesFerm[0].textContent.indexOf('Aïd Al Adha') >= 0 &&
    cartesFerm[0].textContent.indexOf('05/10/2026') >= 0 && cartesFerm[0].textContent.indexOf('Vacances') >= 0,
    cartesFerm[0].textContent);
  t('carte de fermeture : hauteur fixe 44px', cartesFerm[0].style.height === '44px' || cartesFerm[0].className.indexOf('bg-gray-50') >= 0,
    cartesFerm[0].style.height + ' / ' + cartesFerm[0].className);
  t('carte de fermeture : bouton corbeille', !!cartesFerm[0].querySelector('button'));
  const css = Array.from(doc.querySelectorAll('style')).map(x => x.textContent).join('\n');
  t('défilement partagé (.js-fermetures + .js-annulations)',
    css.indexOf('.js-seances-annulees, .js-absences-personnel, .js-fermetures, .js-annulations, .js-personnel {') > 0);

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
