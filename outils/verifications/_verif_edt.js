// Verifie que les EDT TCSF-1/2/3 sont bien DANS les donnees du prototype (lues depuis le HTML)
const fs = require('fs');
const h = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const s = h.indexOf('const TABLEAUX_SERVICE_DEFAUT = {');
const e = h.indexOf('\n};', s);
const obj = eval('(' + h.slice(s + 'const TABLEAUX_SERVICE_DEFAUT = '.length, e + 2).replace(/;\s*$/, '') + ')');
const JOURS = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };
const classes = {};
let nSeances = 0;
for (const [email, cr] of Object.entries(obj)) {
  for (const c of cr) {
    nSeances++;
    (classes[c.classe] = classes[c.classe] || {})[JOURS[c.jour]] = (classes[c.classe][JOURS[c.jour]] || []);
    classes[c.classe][JOURS[c.jour]].push(c.debut + '-' + c.fin + ' ' + c.matiere + ' (' + c.prof + ')');
  }
}
console.log('Profs dans les donnees du prototype :', Object.keys(obj).length, '| seances :', nSeances);
for (const cl of ['TCSF-1', 'TCSF-2', 'TCSF-3']) {
  const j = classes[cl];
  if (!j) { console.log('\n' + cl + ' : *** ABSENT DES DONNEES ***'); continue; }
  let tot = 0; for (const v of Object.values(j)) for (const x of v) tot += (parseInt(x.slice(6, 8)) - parseInt(x.slice(0, 2)));
  console.log('\n=== ' + cl + ' (' + tot + 'h/semaine) ===');
  for (const d of ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']) {
    console.log('  ' + d.padEnd(9) + ' ' + (j[d] ? j[d].sort().join('  |  ') : 'repos'));
  }
}
