// test_v376.js — la page « Rapports » du surveillant devient « Stats », identique à
// celle du directeur : même bloc (#stats-commun) déplacé dans la page affichée, donc
// un seul jeu d'identifiants, un seul rendu, des écrans qui ne peuvent pas diverger.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const now = new Date();
const H = String(now.getHours()).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const auj = iso(now);
const classes = [
  { id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Berrada', prenom: 'Imane' }] },
  { id: 2, nom: 'TCSF-2', eleves: [{ id: 3, nom: 'Ouazzani', prenom: 'Karim' }] }
];
const B = (cl, eid, nom, o) => Object.assign({ classe: cl, eleveId: eid, nom: nom, dateISO: auj, date: '12/09/2026',
  seance: 'matin', heure: H + ':05', enseignant: 'أيوب الكمرة', matiere: 'Maths', type: 'absence', statut: 'absent' }, o);
// des chiffres NON nuls et distincts : si les deux pages divergeaient, le test le verrait
const absences = [
  B('TCSF-1', 1, 'El Amrani Ahmed', { id: 1 }),
  B('TCSF-1', 1, 'El Amrani Ahmed', { id: 2, type: 'retard', statut: 'justifie_s', justifiePar: 'Surveillant 1', justifieLe: auj + ' ' + H + ':20' }),
  B('TCSF-1', 2, 'Berrada Imane', { id: 3, seance: 'apres-midi', statut: 'justifie_d', justifiePar: 'Directeur', justifieLe: auj + ' 11:40' }),
  B('TCSF-2', 3, 'Ouazzani Karim', { id: 4 }),
  B('TCSF-2', 3, 'Ouazzani Karim', { id: 5, type: 'retard', statut: 'absent' })
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
const txt = id => { const el = doc.getElementById(id); return el ? el.textContent : ''; };

function connecter(role) {
  const c = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(x){return x.role==='" + role + "';})[0])"));
  doc.getElementById('login-email').value = c.email;
  doc.getElementById('login-password').value = c.password;
  win.connexion();
  return c;
}

setTimeout(() => {
  // ================= 1. En tant que SURVEILLANT =================
  const surv = connecter('surveillant');

  // l'onglet s'appelle Stats, plus Rapports
  const navs = Array.from(doc.querySelectorAll('#page-surveillant .bottom-nav, #page-surv-classes .bottom-nav, #page-surv-stats .bottom-nav'));
  const libelles = navs.map(n => Array.from(n.querySelectorAll('.nav-item span')).map(s => s.textContent.trim()));
  t('tous les onglets du surveillant disent « Stats »',
    libelles.length >= 3 && libelles.every(l => l.indexOf('Stats') >= 0), JSON.stringify(libelles));
  t('plus aucun onglet « Rapports »', doc.body.textContent.indexOf('Rapports') < 0);
  t('l icône est celle du directeur (graphique)',
    doc.querySelectorAll('#page-surv-stats .nav-item i.fa-chart-bar').length >= 1);
  t('l ancienne page Rapports a disparu', doc.getElementById('page-surv-rapports') === null);
  t('le code mort a été retiré',
    win.eval("typeof genererRapport") === 'undefined' &&
    doc.getElementById('rapport-date') === null && doc.getElementById('rapports-list') === null);

  // ouverture de la page Stats du surveillant
  win.switchSurvPage('surv-stats');
  t('la page surv-stats est affichée', doc.getElementById('page-surv-stats').classList.contains('active'));
  const conteneurSurv = doc.getElementById('surv-stats-conteneur');
  t('le bloc de statistiques est déplacé chez le surveillant',
    !!conteneurSurv.querySelector('#stats-commun'));
  const titres = conteneurSurv.querySelectorAll('h2');
  t('le titre est celui du directeur',
    titres.length === 1 && titres[0].textContent.indexOf("Statistiques de l'établissement") >= 0,
    titres[0] && titres[0].textContent);

  // les mêmes blocs que chez le directeur
  const blocsAttendus = ['dir-stats-periode', 'dir-stats-type', 'dir-stats-dates',
                         'dir-stats-totaux', 'dir-stat-presence', 'dir-progress-presence',
                         'dir-stat-presence-detail', 'dir-chart-tendance', 'dir-chart-absences', 'dir-top-absents'];
  const manquants = blocsAttendus.filter(id => !conteneurSurv.querySelector('#' + id));
  t('tous les blocs du directeur sont présents (' + blocsAttendus.length + ')', manquants.length === 0, manquants.join(' '));
  t('les filtres proposent les mêmes périodes',
    conteneurSurv.querySelectorAll('#dir-stats-periode option').length === 8 &&
    conteneurSurv.querySelectorAll('#dir-stats-type option').length === 3);
  t('les totaux affichent des chiffres NON nuls',
    /ABSENCES[1-9]/.test(txt('dir-stats-totaux').replace(/\s/g, '')) || /RETARDS[1-9]/.test(txt('dir-stats-totaux').replace(/\s/g, '')),
    txt('dir-stats-totaux').replace(/\s+/g, ' ').slice(0, 80));
  t('les statistiques sont calculées (totaux affichés)',
    conteneurSurv.querySelector('#dir-stats-totaux').children.length >= 2,
    conteneurSurv.querySelector('#dir-stats-totaux').children.length + ' blocs');
  t('le taux de présence est renseigné', txt('dir-stat-presence').trim().length > 0 && txt('dir-stat-presence').trim() !== '—',
    txt('dir-stat-presence').trim());
  t('le graphique par classe est rempli', conteneurSurv.querySelector('#dir-chart-absences').children.length > 0);
  t('le classement des élèves signalés est rempli', conteneurSurv.querySelector('#dir-top-absents').children.length > 0);

  const totauxSurv = txt('dir-stats-totaux');
  const presenceSurv = txt('dir-stat-presence');

  // les filtres fonctionnent chez le surveillant
  doc.getElementById('dir-stats-periode').value = 'jour';
  win.changerFiltreStatsDir();
  t('le filtre « Aujourd hui » recalcule', txt('dir-stats-totaux').length > 0);
  doc.getElementById('dir-stats-periode').value = 'mois';
  win.changerFiltreStatsDir();
  t('retour au mois : mêmes totaux que le directeur les verra', txt('dir-stats-totaux') === totauxSurv);

  // ================= 2. En tant que DIRECTEUR =================
  win.deconnexion();
  connecter('directeur');
  win.switchDirPage('dir-stats');
  const conteneurDir = doc.getElementById('dir-stats-conteneur');
  t('le bloc est revenu chez le directeur',
    !!conteneurDir.querySelector('#stats-commun') && !doc.getElementById('surv-stats-conteneur').querySelector('#stats-commun'));
  t('la page du surveillant ne garde rien', conteneurDir.querySelector('#stats-commun').children.length > 3);

  // ================= 3. IDENTIQUE : mêmes chiffres pour les deux rôles =================
  t('les totaux sont identiques pour les deux rôles', txt('dir-stats-totaux') === totauxSurv,
    JSON.stringify({ dir: txt('dir-stats-totaux').slice(0, 60), surv: totauxSurv.slice(0, 60) }));
  t('le taux de présence est identique', txt('dir-stat-presence') === presenceSurv);

  // le bloc est bien unique dans tout le document
  t('un seul bloc de statistiques dans toute la page', doc.querySelectorAll('#stats-commun').length === 1);

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 1200);
