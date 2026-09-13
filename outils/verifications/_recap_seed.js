// Recapitulatif des donnees de test generees (aujourd'hui = vendredi 11/09/2026)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const FIXE = new Date('2026-09-11T08:30:00').getTime();
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  beforeParse(win) {
    const V = win.Date;
    win.Date = class extends V { constructor(...a) { super(...(a.length ? a : [FIXE])); } static now() { return FIXE; } };
    win.localStorage.setItem('absenceTrackVersion', 'v2.1');
    win.localStorage.setItem('absences', '[]');
  }
});
setTimeout(() => {
  const w = dom.window;
  const A = JSON.parse(w.eval('JSON.stringify(absences)'));
  const C = JSON.parse(w.eval('JSON.stringify(classes)'));
  console.log('Classes : ' + C.map(c => c.nom + ' (' + c.eleves.length + ' eleves)').join(' | '));
  console.log('Total enregistrements de test : ' + A.length);
  const par = {}; A.forEach(a => { par[a.justifiePar || 'NON JUSTIFIE'] = (par[a.justifiePar || 'NON JUSTIFIE'] || 0) + 1; });
  console.log('Par approbateur : ' + JSON.stringify(par));
  const cl = {}; A.forEach(a => { cl[a.classe] = (cl[a.classe] || 0) + 1; }); console.log('Par classe : ' + JSON.stringify(cl));
  const t = A.filter(a => a.type === 'retard').length;
  console.log('Types : ' + (A.length - t) + ' absences / ' + t + ' retards');
  const dates = A.map(a => a.dateISO).sort(); console.log('Periode : ' + dates[0] + ' -> ' + dates[dates.length - 1]);
  const auj = A.filter(a => a.statut === 'absent' && a.dateISO === '2026-09-11');
  const hier = A.filter(a => a.statut === 'absent' && a.dateISO === '2026-09-10');
  console.log('\nAujourd hui (non justifies) : ' + auj.length);
  auj.forEach(a => console.log('   ' + a.heure + ' ' + a.classe + ' ' + a.matiere + ' (' + a.enseignant + ') -> ' + a.nom));
  console.log('Hier 10/09 (non justifies) : ' + hier.length);
  hier.forEach(a => console.log('   ' + a.heure + ' ' + a.classe + ' ' + a.matiere + ' (' + a.enseignant + ') -> ' + a.nom));
  const just = A.filter(a => a.type === 'retard' && (a.statut === 'justifie_s' || a.statut === 'justifie_d'));
  const effAbs = just.filter(a => w.eval('typeEffectif(absences.find(function(x){return x.id===' + a.id + ';}))') === 'absence');
  console.log('\nRetards approuves : ' + just.length + ' -> ' + (just.length - effAbs.length) + ' restent Rd / ' + effAbs.length + ' transformes en Ab');
  const enAttente = A.filter(a => a.statut === 'absent');
  const conv = enAttente.filter(a => w.eval('typeEffectif(absences.find(function(x){return x.id===' + a.id + ';}))') === 'absence');
  console.log('Non justifies : ' + enAttente.length + ' dont ' + conv.length + ' retards hors delai (affiches Retard -> Absence)');
  const ex = A.filter(a => a.dateISO === '2026-09-03').slice(0, 4);
  console.log('\nExemple 03/09 (anciens approuves) :');
  ex.forEach(a => console.log('   ' + a.heure + ' ' + a.classe + ' ' + a.matiere + ' (' + a.enseignant + ') ' + a.statut + ' par ' + a.justifiePar + ' le ' + a.justifieLe));
  process.exit(0);
}, 400);
