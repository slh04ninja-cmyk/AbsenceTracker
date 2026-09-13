// test_pdf_arabe.js — verifie l'ordre d'affichage REEL des noms dans le PDF.
// On ne suppose rien sur le comportement de pdf-lib : on relit les glyphes
// effectivement ecrits dans le fichier et on controle l'ordre affiche.
const fs = require('fs');
const zlib = require('zlib');
// chemins explicites : la suite doit tourner depuis le dossier du projet sans réglage
const PDFLib = require('./_pdf/node_modules/pdf-lib');
const fontkit = require('./_pdf/node_modules/@pdf-lib/fontkit');

const D = __dirname + '/';
(0, eval)(fs.readFileSync(D + '_arabe_fn.js', 'utf8'));
const id = require(D + '_pdf/identifiants.js');

// --- correspondance glyphe -> caractere (extraite de la police par fontTools) ---
const carParGlyphe = JSON.parse(fs.readFileSync(D + '_pdf/glyphes.json', 'utf8'));

// --- extraire la suite de glyphes ecrite dans le PDF ---
function glyphesEcrits(chemin) {
  const data = fs.readFileSync(chemin);
  const suites = [];
  let pos = 0;
  while ((pos = data.indexOf('stream', pos)) >= 0) {
    let debut = pos + 6;
    if (data[debut] === 13) debut++;
    if (data[debut] === 10) debut++;
    const fin = data.indexOf('endstream', debut);
    if (fin < 0) break;
    let contenu = null;
    try { contenu = zlib.inflateSync(data.slice(debut, fin)); }
    catch (e) { contenu = data.slice(debut, fin); }
    const texte = contenu.toString('latin1');
    const re = /<([0-9A-Fa-f]+)>\s*Tj/g;
    let m;
    while ((m = re.exec(texte)) !== null) {
      const hexa = m[1];
      const codes = [];
      for (let i = 0; i + 4 <= hexa.length; i += 4) codes.push(parseInt(hexa.substr(i, 4), 16));
      suites.push(codes);
    }
    pos = fin;
  }
  return suites;
}

const NOMS = ['سامية الحاضي', 'أيوب الكمرة', 'محمد خليفي', 'يسرى البوسعيدي', 'ياسين القامة'];

(async () => {
  const octetsPolice = fs.readFileSync(D + 'fonts/NotoNaskhArabic-Regular.ttf');
  const lignes = NOMS.map((nom, i) => ({ nom: nom, email: 'x' + i + '@taalim.ma', password: 'Ab3xY9z2' }));
  const sections = [{ titre: 'Enseignants', lignes: lignes }];
  const doc = await id.construirePdfIdentifiants(PDFLib, PDFLib.PDFDocument, fontkit, octetsPolice, sections, {});
  const chemin = D + '_pdf/_test_ordre.pdf';
  fs.writeFileSync(chemin, Buffer.from(await doc.save()));

  // parmi tous les textes du PDF, on ne garde que ceux ecrits avec la police ARABE
  // (le titre et les emails utilisent Helvetica : leurs codes ne sont pas dans la table)
  const decode = codes => codes.map(g => carParGlyphe[g]).join('');
  const suites = glyphesEcrits(chemin).filter(codes =>
    codes.length > 2 && codes.every(g => carParGlyphe[g]));
  let ok = true;

  const attendu = Array.from(formeArabe(NOMS[0]));        // formes en ordre logique
  const ecrit = decode(suites[0] || []);
  const attenduVisuel = attendu.slice().reverse().join('');  // ordre affiche

  console.log('nom                    : ' + NOMS[0]);
  console.log('formes (ordre logique) : ' + Array.from(attendu).map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' '));
  console.log('ecrit dans le PDF      : ' + Array.from(ecrit).map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' '));

  const sens1 = ecrit === attenduVisuel;                       // pdf-lib a inverse (attendu)
  const sens2 = ecrit === attendu.join('');                    // pdf-lib n'a rien inverse
  console.log();
  console.log('ordre affiche = inverse du logique        : ' + sens1);
  console.log('texte ecrit tel quel (aucune inversion)   : ' + sens2);
  if (!sens1) { ok = false; console.log('  >>> pdf-lib n\'inverse plus le texte : le PDF serait « miroir »'); }

  // et pour chaque nom : le premier glyphe dessine doit etre la DERNIERE lettre logique
  NOMS.forEach((nom, i) => {
    const codes = suites[i] || [];
    const premier = carParGlyphe[codes[0]];
    const dernierLogique = Array.from(formeArabe(nom)).pop();
    const bon = premier === Array.from(formeArabe(nom)).reverse()[0];
    if (!bon) { ok = false; console.log('  ECHEC ordre pour ' + nom + ' (premier glyphe ' + premier + ', attendu ' + dernierLogique + ')'); }
  });
  console.log('ordre du premier glyphe verifie pour ' + NOMS.length + ' noms');

  // toutes les formes doivent etre des formes contextuelles (aucune lettre brute)
  const brut = Array.from(ecrit).some(c => /[\u0621-\u064A]/.test(c));
  if (brut) { ok = false; console.log('  ECHEC : des lettres arabes non mises en forme subsistent'); }
  console.log('lettres non mises en forme : ' + (brut ? 'OUI (probleme)' : 'aucune'));

  console.log();
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
})();
