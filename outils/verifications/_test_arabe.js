// _test_arabe.js — la mise en forme arabe en JS doit produire EXACTEMENT le meme
// resultat que la reference Python (arabic_reshaper + bidi) deja validee sur un vrai PDF.
const fs = require('fs');
const chemin = __dirname + '/';
eval(fs.readFileSync(chemin + '_arabe_fn.js', 'utf8'));

const ref = JSON.parse(fs.readFileSync(chemin + '_ref_arabe.json', 'utf8'));
let ok = true, n = 0;
const echecs = [];
Object.keys(ref).forEach(source => {
  n++;
  const attendu = ref[source];
  const obtenu = formeArabe(source);
  if (obtenu !== attendu) { ok = false; echecs.push({ source, attendu, obtenu }); }
});
console.log('chaines arabes comparees a la reference Python : ' + n);
echecs.forEach(e => {
  console.log('  ECHEC  ' + e.source);
  console.log('     attendu ' + JSON.stringify(e.attendu));
  console.log('     obtenu  ' + JSON.stringify(e.obtenu));
});

// les 11 noms d'enseignants, explicitement
const PROFS = ['أيوب الكمرة','غزالي صالح','كمال الوردي','سامية الحاضي','هشام أجامي','المهدي الصلحي',
               'يسرى البوسعيدي','سكينة الرازي','زكية المندريلي','محمد خليفي','ياسين القامة'];
PROFS.forEach(p => {
  const bon = formeArabe(p) === ref[p];
  if (!bon) { ok = false; console.log('  ECHEC nom enseignant : ' + p); }
});
console.log('noms d\'enseignants verifies : ' + PROFS.length);

// cas limites
const cas = [
  ['texte vide', formeArabe(''), ''],
  ['null', formeArabe(null), ''],
  ['espace', formeArabe(' '), ' '],
  ['nom latin inchange', formeArabe('Samia El Hadi'), 'Samia El Hadi'],
  ['email inchange', formeArabe('math-prof1@taalim.ma'), 'math-prof1@taalim.ma'],
  ['chiffres inchanges', formeArabe('2026-2027'), '2026-2027']
];
cas.forEach(([lib, obtenu, attendu]) => {
  const bon = obtenu === attendu;
  if (!bon) { ok = false; console.log('  ECHEC ' + lib + ' : ' + JSON.stringify(obtenu)); }
});

// la chaine mise en forme ne doit plus contenir de lettre arabe "brute" (toutes en forme contextuelle)
const brut = formeArabe('سامية الحاضي');
const contientBrut = /[\u0621-\u064A]/.test(brut);
if (contientBrut) { ok = false; console.log('  ECHEC : des lettres arabes non mises en forme subsistent'); }
console.log('lettres brutes restantes : ' + (contientBrut ? 'OUI (probleme)' : 'aucune'));

console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
process.exit(ok ? 0 : 1);
