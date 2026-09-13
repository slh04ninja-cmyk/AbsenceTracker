// Test jsdom : donnees de test v3.48 — tableaux de service des 11 profs reels + criteres demandes
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('absences', '[]');
    win.localStorage.setItem('testHistoGenere_v1', '1');
    win.localStorage.setItem('testHistoGenere_v2', '1');
    win.localStorage.setItem('testHistoGenere_v3', '1');
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const VraiDate = win.Date;
function figer(jourISO, jourJS, h, m) {
  win.Date = class extends VraiDate {
    constructor(...a) { super(...(a.length ? a : [jourISO + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00'])); }
    getDay() { return jourJS; }
    getHours() { return h; }
    getMinutes() { return m; }
  };
}
const hhmm = t2 => { const p = String(t2).split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); };
const demi = t2 => hhmm(t2) < 12 * 60 ? 0 : 1;
const CRENEAUX = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

setTimeout(() => {
  // ---------- 1. comptes ----------
  const comptes = JSON.parse(win.eval('JSON.stringify(comptes)'));
  const profs = comptes.filter(c => c.role === 'enseignant');
  const attendus = { 'Maths': 'math-prof1', 'PC': 'pc-prof1', 'SVT': 'svt-prof1', 'Français': 'fr-prof1',
                     'Anglais': 'ang-prof1', 'Arabe': 'ar-prof1', 'EPS': 'eps-prof1', 'Informatique': 'info-prof1',
                     'Philo': 'philo-prof1', 'Educ. islamique': 'ei-prof1', 'Hist-Géo': 'hg-prof1' };
  t('11 professeurs avec code {matiere}-prof{x}', profs.length === 11 &&
    Object.keys(attendus).every(m => profs.some(p => p.matiere === m && p.code === attendus[m])),
    profs.map(p => p.code).join(', '));
  t('noms reels du tableau des professeurs (dont Informatique et PC ajoutes)',
    ['أيوب الكمرة', 'غزالي صالح', 'كمال الوردي', 'سامية الحاضي', 'هشام أجامي', 'المهدي الصلحي',
     'يسرى البوسعيدي', 'سكينة الرازي', 'زكية المندريلي', 'محمد خليفي', 'ياسين القامة'].every(n => profs.some(p => p.nom === n)));
  t('emails = code@taalim.ma', profs.every(p => p.email === p.code + '@taalim.ma'));
  t('aide de connexion mise a jour', doc.body.innerHTML.indexOf('info-prof1') > 0 && doc.body.innerHTML.indexOf('hg-prof1') > 0);

  // ---------- 2. tableaux de service ----------
  const tab = JSON.parse(win.eval('JSON.stringify(tableauxService)'));
  t('11 tableaux de service', Object.keys(tab).length === 11, Object.keys(tab).join(', '));
  const tous = [];
  Object.keys(tab).forEach(cle => tab[cle].forEach(c => tous.push(Object.assign({ cle: cle }, c))));
  t('aucune seance le samedi', tous.every(c => c.jour >= 1 && c.jour <= 5));
  t('creneaux dans 08:00-12:00 ou 14:00-18:00 (demi-journee complete)',
    tous.every(c => (hhmm(c.debut) >= 480 && hhmm(c.fin) <= 720) || (hhmm(c.debut) >= 840 && hhmm(c.fin) <= 1080)),
    tous.filter(c => !((hhmm(c.debut) >= 480 && hhmm(c.fin) <= 720) || (hhmm(c.debut) >= 840 && hhmm(c.fin) <= 1080))).map(c => c.debut + '-' + c.fin).join(','));
  const heures = {};
  Object.keys(tab).forEach(cle => { heures[cle] = tab[cle].reduce((s, c) => s + (hhmm(c.fin) - hhmm(c.debut)) / 60, 0); });
  t('service <= 20 h par prof', Object.keys(heures).every(k => heures[k] <= 20),
    Object.keys(heures).map(k => k.split('@')[0] + '=' + heures[k]).join(' '));
  const attendu = { 'math-prof1': 15, 'pc-prof1': 12, 'svt-prof1': 12, 'fr-prof1': 12, 'ang-prof1': 9,
                    'ar-prof1': 6, 'eps-prof1': 6, 'info-prof1': 6, 'philo-prof1': 6, 'ei-prof1': 6, 'hg-prof1': 6 };
  t('heures par matiere conformes (Maths 15 h pour 3 classes, etc.)',
    Object.keys(attendu).every(k => Math.abs(heures[k + '@taalim.ma'] - attendu[k]) < 0.01),
    Object.keys(heures).map(k => k.split('@')[0] + '=' + heures[k]).join(' '));

  // prof : pas de chevauchement et une seule demi-journee par jour
  const parProf = {};
  tous.forEach(c => {
    const slots = [];
    for (let i = hhmm(c.debut); i < hhmm(c.fin); i += 60) slots.push(c.jour + '|' + i);
    if (!parProf[c.cle]) parProf[c.cle] = { slots: [], demi: {} };
    slots.forEach(s => parProf[c.cle].slots.push(s));
    const d = demi(c.debut);
    parProf[c.cle].demi[c.jour] = parProf[c.cle].demi[c.jour] === undefined ? d : (parProf[c.cle].demi[c.jour] === d ? d : 'MIXTE');
  });
  t('aucun prof en double au meme creneau', Object.keys(parProf).every(k => new Set(parProf[k].slots).size === parProf[k].slots.length));
  t('un prof ne travaille que le matin OU l apres-midi dans un jour',
    Object.keys(parProf).every(k => Object.values(parProf[k].demi).every(v => v !== 'MIXTE')),
    Object.keys(parProf).filter(k => Object.values(parProf[k].demi).some(v => v === 'MIXTE')).join(', '));

  // ---------- 3. emplois du temps des classes (reconstruits) ----------
  const parClasse = { 'TCSF-1': {}, 'TCSF-2': {}, 'TCSF-3': {} };
  tous.forEach(c => {
    if (!parClasse[c.classe]) return;
    parClasse[c.classe][c.jour] = parClasse[c.classe][c.jour] || [];
    parClasse[c.classe][c.jour].push(c);
  });
  const attenduMat = { 'Maths': 5, 'PC': 4, 'SVT': 4, 'Français': 4, 'Anglais': 3, 'Arabe': 2,
                       'EPS': 2, 'Informatique': 2, 'Philo': 2, 'Educ. islamique': 2, 'Hist-Géo': 2 };
  for (const cl of ['TCSF-1', 'TCSF-2', 'TCSF-3']) {
    const liste = [];
    Object.keys(parClasse[cl]).forEach(j => liste.push.apply(liste, parClasse[cl][j]));
    const parMat = {};
    liste.forEach(c => { parMat[c.matiere] = (parMat[c.matiere] || 0) + (hhmm(c.fin) - hhmm(c.debut)) / 60; });
    t(cl + ' : 32 h avec la repartition demandee',
      Object.keys(attenduMat).every(m => Math.abs((parMat[m] || 0) - attenduMat[m]) < 0.01) &&
      liste.reduce((s, c) => s + (hhmm(c.fin) - hhmm(c.debut)) / 60, 0) === 32,
      Object.keys(parMat).map(m => m + '=' + parMat[m]).join(' '));
    // max 2 h / matiere / jour
    const trop = [];
    Object.keys(parClasse[cl]).forEach(j => {
      const pm = {};
      parClasse[cl][j].forEach(c => { pm[c.matiere] = (pm[c.matiere] || 0) + (hhmm(c.fin) - hhmm(c.debut)) / 60; });
      Object.keys(pm).forEach(m => { if (pm[m] > 2) trop.push(j + ' ' + m + '=' + pm[m]); });
    });
    t(cl + ' : maximum 2 h de la meme matiere par jour', trop.length === 0, trop.join(', '));
    // PC / SVT en seances de 2 h
    const courtes = liste.filter(c => ['PC', 'SVT'].indexOf(c.matiere) >= 0 && (hhmm(c.fin) - hhmm(c.debut)) < 120);
    t(cl + ' : PC et SVT en seances de 2 h', courtes.length === 0, courtes.map(c => c.matiere + ' ' + c.debut).join(', '));
    // pas de chevauchement dans la classe
    const vus = [];
    Object.keys(parClasse[cl]).forEach(j => parClasse[cl][j].forEach(c => {
      for (let i = hhmm(c.debut); i < hhmm(c.fin); i += 60) vus.push(j + '|' + i);
    }));
    t(cl + ' : aucune superposition de cours', new Set(vus).size === vus.length);
  }
  t('les 3 classes existent avec des eleves',
    ['TCSF-1', 'TCSF-2', 'TCSF-3'].every(n => win.eval("classes.some(function(c){return c.nom==='" + n + "' && c.eleves.length>0;})") === true));

  // ---------- 4. le Dashboard suit le tableau ----------
  const cr = tab['math-prof1@taalim.ma'][0];
  figer('2026-09-14', cr.jour, Math.floor(hhmm(cr.debut) / 60), hhmm(cr.debut) % 60 + 15);
  doc.getElementById('login-email').value = 'math-prof1@taalim.ma';
  doc.getElementById('login-password').value = '12345';
  win.connexion();
  t('en seance : la classe du creneau est preselectionnee',
    win.eval('classeSelectionnee ? classeSelectionnee.nom : null') === cr.classe,
    cr.classe + ' / obtenu : ' + win.eval('classeSelectionnee ? classeSelectionnee.nom : null'));
  t('en seance : menu bloque avec l horaire du creneau',
    doc.getElementById('select-classe').disabled === true &&
    doc.getElementById('select-classe').options[0].textContent.indexOf(cr.debut + '–' + cr.fin) > 0,
    doc.getElementById('select-classe').options[0] ? doc.getElementById('select-classe').options[0].textContent : '');
  t('en seance : eleves affiches', doc.getElementById('liste-eleves-enseignant').children.length === 12,
    doc.getElementById('liste-eleves-enseignant').children.length);
  figer('2026-09-19', 6, 10, 0);      // samedi 10:00 -> repos
  win.appliquerTableauService();
  t('samedi : aucune classe et bloc repos',
    win.eval('classeSelectionnee') === null && !doc.getElementById('ens-repos').classList.contains('hidden') &&
    doc.getElementById('ens-repos-prochain').textContent.indexOf('Prochain cours') === 0,
    doc.getElementById('ens-repos-prochain').textContent);

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
