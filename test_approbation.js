// Test jsdom : tracage de l'approbation de la justification (v3.31)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const now = new Date();
const H = String(now.getHours()).padStart(2, '0');
const jour = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
const classe = { id: 1, nom: '3eme A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] };
const base = { classe: '3eme A', eleveId: 1, nom: 'El Amrani Ahmed', dateISO: jour, date: '10/09/2026', seance: 'matin', heure: '08:00', enseignant: 'أيوب الكمرة', matiere: 'Maths' };
const absences = [
  Object.assign({ id: 11, type: 'absence', statut: 'justifie_s', justifiePar: 'Surveillant 1', justifieLe: jour + ' 09:15', motif: 'Maladie' }, base),
  // v3.50 : approuve 20 min apres le signalement -> reste un Retard (delai = 30 min)
  Object.assign({ id: 12, type: 'retard', statut: 'justifie_s', justifiePar: 'Surveillant 2', justifieLe: jour + ' 08:20', motif: 'Transport' }, base),
  Object.assign({ id: 13, type: 'absence', statut: 'justifie_d', justifiePar: 'Directeur', justifieLe: jour + ' 11:45', motif: 'Raison familiale' }, base),
  Object.assign({ id: 14, type: 'absence', statut: 'absent' }, base),
  Object.assign({ id: 15, type: 'absence', statut: 'justifie_s', justifiePar: '', justifieLe: jour + ' 12:00', motif: 'Autre' }, base) // ancien enregistrement sans justifiePar
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
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

setTimeout(() => {
  // 1. helper : codes d'approbation
  const codes = JSON.parse(win.eval("JSON.stringify(absences.map(function(a){return codeApprobation(a);}))"));
  t('codes S1 / S2 / D / vide / S (ancien)', JSON.stringify(codes) === JSON.stringify(['S1', 'S2', 'D', '', 'S']), codes.join(','));
  t('libelleStatutAbs', win.eval("libelleStatutAbs(absences[0])") === 'Justifiée S1' &&
    win.eval("libelleStatutAbs(absences[2])") === 'Justifiée D' &&
    win.eval("libelleStatutAbs(absences[3])") === 'Non justifiée',
    win.eval("libelleStatutAbs(absences[0])") + ' / ' + win.eval("libelleStatutAbs(absences[2])") + ' / ' + win.eval("libelleStatutAbs(absences[3])"));

  // 2. liste des Ab/Rd de l'historique (fiche eleve)
  win.ouvrirFicheEleve(1, 1);
  const marques = Array.from(doc.querySelectorAll('#fiche-historique span')).map(e => e.textContent).filter(x => /^(Ab|Rd)/.test(x));
  t('marques simples : Ab / Rd / Ab / Ab / Ab',
    JSON.stringify(marques) === JSON.stringify(['Ab', 'Rd', 'Ab', 'Ab', 'Ab']), marques.join(' | '));
  t('aucun code colle a la marque', marques.filter(m => m.indexOf(' - ') >= 0).length === 0);
  const codesFiche = Array.from(doc.querySelectorAll('#fiche-historique span')).map(e => e.textContent).filter(x => /^(S1|S2|S|D)$/.test(x));
  t('codes d approbation sur leur propre ligne : S1 / S2 / D / S',
    JSON.stringify(codesFiche) === JSON.stringify(['S1', 'S2', 'D', 'S']), codesFiche.join(' | '));
  t('un enregistrement non justifie n a pas de ligne d approbation',
    Array.from(doc.querySelectorAll('#fiche-historique span')).filter(e => e.textContent.indexOf('Approuvé le') >= 0).length === 4);
  win.fermerFicheEleve();

  // 3. page Historique du directeur (la page Absences a ete supprimee en v3.33)
  connecter(compte('directeur'));
  t('page Absences supprimee', doc.getElementById('page-dir-absences') === null);
  win.switchDirPage('dir-historique');
  t('page Historique du directeur affichee', doc.getElementById('page-dir-historique').classList.contains('active'));
  t('liste des Ab/Rd regles rendue', doc.getElementById('dir-historique-list').children.length > 0,
    doc.getElementById('dir-historique-list').children.length);
  win.ouvrirFicheEleve(1, 1);
  const marquesDir = Array.from(doc.querySelectorAll('#fiche-historique span')).map(e => e.textContent).filter(x => /^(Ab|Rd)/.test(x));
  const codesDir = Array.from(doc.querySelectorAll('#fiche-historique span')).map(e => e.textContent).filter(x => /^(S1|S2|S|D)$/.test(x));
  t('le directeur voit les memes codes (dont D)', codesDir.includes('D') && codesDir.includes('S1'), codesDir.join(' | '));
  win.fermerFicheEleve();
  t('libelles statut directeur (S1/S2/D)', win.eval("libelleStatutAbs(absences[0])") === 'Justifiée S1' &&
    win.eval("libelleStatutAbs(absences[2])") === 'Justifiée D');

  // 4. toast apres justification par un surveillant
  connecter(compte('surveillant'));                          // Surveillant 1
  doc.getElementById('select-motif').value = 'Maladie';
  win.justifierAbsence(14, 'surv');
  t('toast = Justifiée S1 · Maladie', doc.getElementById('toast').textContent === 'Justifiée S1 · Maladie',
    doc.getElementById('toast').textContent);
  t('enregistrement : justifie_s + justifiePar Surveillant 1',
    win.eval("(function(){var a=absences.filter(function(x){return x.id===14;})[0];return a.statut+'/'+a.justifiePar;})()") === 'justifie_s/Surveillant 1',
    win.eval("(function(){var a=absences.filter(function(x){return x.id===14;})[0];return a.statut+'/'+a.justifiePar;})()"));
  // la justification du surveillant apparait bien dans l'historique du directeur
  win.switchDirPage('dir-historique');
  win.ouvrirFicheEleve(1, 1);
  t('ligne d approbation ajoutee apres justification du surveillant',
    doc.getElementById('fiche-historique').innerHTML.indexOf('Approuvé le') > 0 &&
    Array.from(doc.querySelectorAll('#fiche-historique span')).map(e => e.textContent).includes('S1'));
  win.fermerFicheEleve();

  // 5. enregistrement ancien (regle mais sans justifieLe) : la ligne d approbation existe quand meme
  const ddmmL = jour.slice(8, 10) + '/' + jour.slice(5, 7) + '/' + jour.slice(0, 4);
  win.eval("absences.push({ id: 16, eleveId: 1, classe: '3eme A', nom: 'El Amrani Ahmed', dateISO: '" + jour + "', date: '10/09/2026', seance: 'matin', heure: '07:30', type: 'absence', statut: 'justifie_s' })");
  win.ouvrirFicheEleve(1, 1);
  const hLegacy = doc.getElementById('fiche-historique').innerHTML;
  t('ancien enregistrement regle : ligne Approuve le presente (repli datetime) + code a droite',
    (hLegacy.match(/Approuvé le/g) || []).length === 6 &&
    hLegacy.indexOf('Approuvé le ' + ddmmL + ' · 07:30') > 0, (hLegacy.match(/Approuvé le/g) || []).length + ' ligne(s)');
  win.fermerFicheEleve();

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
