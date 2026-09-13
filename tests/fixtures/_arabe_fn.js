// Mise en forme arabe (formes contextuelles) + ligatures lam-alef.
// Table extraite de la reference Python validee (arabic_reshaper v1).
const ARABE_FORMES = {
  "ء": ["ﺀ", "", "", ""],
  "آ": ["ﺁ", "", "", "ﺂ"],
  "أ": ["ﺃ", "", "", "ﺄ"],
  "ؤ": ["ﺅ", "", "", "ﺆ"],
  "إ": ["ﺇ", "", "", "ﺈ"],
  "ئ": ["ﺉ", "ﺋ", "ﺌ", "ﺊ"],
  "ا": ["ﺍ", "", "", "ﺎ"],
  "ب": ["ﺏ", "ﺑ", "ﺒ", "ﺐ"],
  "ة": ["ﺓ", "", "", "ﺔ"],
  "ت": ["ﺕ", "ﺗ", "ﺘ", "ﺖ"],
  "ث": ["ﺙ", "ﺛ", "ﺜ", "ﺚ"],
  "ج": ["ﺝ", "ﺟ", "ﺠ", "ﺞ"],
  "ح": ["ﺡ", "ﺣ", "ﺤ", "ﺢ"],
  "خ": ["ﺥ", "ﺧ", "ﺨ", "ﺦ"],
  "د": ["ﺩ", "", "", "ﺪ"],
  "ذ": ["ﺫ", "", "", "ﺬ"],
  "ر": ["ﺭ", "", "", "ﺮ"],
  "ز": ["ﺯ", "", "", "ﺰ"],
  "س": ["ﺱ", "ﺳ", "ﺴ", "ﺲ"],
  "ش": ["ﺵ", "ﺷ", "ﺸ", "ﺶ"],
  "ص": ["ﺹ", "ﺻ", "ﺼ", "ﺺ"],
  "ض": ["ﺽ", "ﺿ", "ﻀ", "ﺾ"],
  "ط": ["ﻁ", "ﻃ", "ﻄ", "ﻂ"],
  "ظ": ["ﻅ", "ﻇ", "ﻈ", "ﻆ"],
  "ع": ["ﻉ", "ﻋ", "ﻌ", "ﻊ"],
  "غ": ["ﻍ", "ﻏ", "ﻐ", "ﻎ"],
  "ـ": ["ـ", "ـ", "ـ", "ـ"],
  "ف": ["ﻑ", "ﻓ", "ﻔ", "ﻒ"],
  "ق": ["ﻕ", "ﻗ", "ﻘ", "ﻖ"],
  "ك": ["ﻙ", "ﻛ", "ﻜ", "ﻚ"],
  "ل": ["ﻝ", "ﻟ", "ﻠ", "ﻞ"],
  "م": ["ﻡ", "ﻣ", "ﻤ", "ﻢ"],
  "ن": ["ﻥ", "ﻧ", "ﻨ", "ﻦ"],
  "ه": ["ﻩ", "ﻫ", "ﻬ", "ﻪ"],
  "و": ["ﻭ", "", "", "ﻮ"],
  "ى": ["ﻯ", "ﯨ", "ﯩ", "ﻰ"],
  "ي": ["ﻱ", "ﻳ", "ﻴ", "ﻲ"],
  "ٱ": ["ﭐ", "", "", "ﭑ"],
  "ٷ": ["ﯝ", "", "", ""],
  "ٹ": ["ﭦ", "ﭨ", "ﭩ", "ﭧ"],
  "ٺ": ["ﭞ", "ﭠ", "ﭡ", "ﭟ"],
  "ٻ": ["ﭒ", "ﭔ", "ﭕ", "ﭓ"],
  "پ": ["ﭖ", "ﭘ", "ﭙ", "ﭗ"],
  "ٿ": ["ﭢ", "ﭤ", "ﭥ", "ﭣ"],
  "ڀ": ["ﭚ", "ﭜ", "ﭝ", "ﭛ"],
  "ڃ": ["ﭶ", "ﭸ", "ﭹ", "ﭷ"],
  "ڄ": ["ﭲ", "ﭴ", "ﭵ", "ﭳ"],
  "چ": ["ﭺ", "ﭼ", "ﭽ", "ﭻ"],
  "ڇ": ["ﭾ", "ﮀ", "ﮁ", "ﭿ"],
  "ڈ": ["ﮈ", "", "", "ﮉ"],
  "ڌ": ["ﮄ", "", "", "ﮅ"],
  "ڍ": ["ﮂ", "", "", "ﮃ"],
  "ڎ": ["ﮆ", "", "", "ﮇ"],
  "ڑ": ["ﮌ", "", "", "ﮍ"],
  "ژ": ["ﮊ", "", "", "ﮋ"],
  "ڤ": ["ﭪ", "ﭬ", "ﭭ", "ﭫ"],
  "ڦ": ["ﭮ", "ﭰ", "ﭱ", "ﭯ"],
  "ک": ["ﮎ", "ﮐ", "ﮑ", "ﮏ"],
  "ڭ": ["ﯓ", "ﯕ", "ﯖ", "ﯔ"],
  "گ": ["ﮒ", "ﮔ", "ﮕ", "ﮓ"],
  "ڱ": ["ﮚ", "ﮜ", "ﮝ", "ﮛ"],
  "ڳ": ["ﮖ", "ﮘ", "ﮙ", "ﮗ"],
  "ں": ["ﮞ", "", "", "ﮟ"],
  "ڻ": ["ﮠ", "ﮢ", "ﮣ", "ﮡ"],
  "ھ": ["ﮪ", "ﮬ", "ﮭ", "ﮫ"],
  "ۀ": ["ﮤ", "", "", "ﮥ"],
  "ہ": ["ﮦ", "ﮨ", "ﮩ", "ﮧ"],
  "ۅ": ["ﯠ", "", "", "ﯡ"],
  "ۆ": ["ﯙ", "", "", "ﯚ"],
  "ۇ": ["ﯗ", "", "", "ﯘ"],
  "ۈ": ["ﯛ", "", "", "ﯜ"],
  "ۉ": ["ﯢ", "", "", "ﯣ"],
  "ۋ": ["ﯞ", "", "", "ﯟ"],
  "ی": ["ﯼ", "ﯾ", "ﯿ", "ﯽ"],
  "ې": ["ﯤ", "ﯦ", "ﯧ", "ﯥ"],
  "ے": ["ﮮ", "", "", "ﮯ"],
  "ۓ": ["ﮰ", "", "", "ﮱ"],
  "‍": ["‍", "‍", "‍", "‍"],
  "ێ": ["", "", "", ""],
  "ە": ["ە", "", "", ""]
};
const ARABE_LAM_ALEF = {
  "ا": ["ﻻ", "ﻼ"],
  "أ": ["ﻷ", "ﻸ"],
  "إ": ["ﻹ", "ﻺ"],
  "آ": ["ﻵ", "ﻶ"]
};

// Met un texte arabe en forme : chaque lettre prend sa forme contextuelle
// (isolee / initiale / mediane / finale) et les ligatures lam-alef sont composees.
//
// POURQUOI PAS D'INVERSION ICI : pdf-lib applique LUI-MEME le sens droite -> gauche.
// Lui donner un texte deja inverse le fait inverser deux fois, et le rendu sort
// « miroir » (mots non continus). Verifie par mesure : correlation avec la version
// miroir +0,76 contre +0,41 dans le bon sens, puis corrige.
// Le test test_pdf_arabe.js relit les glyphes reellement ecrits dans le PDF et
// verifie l'ordre affiche : si pdf-lib changeait de comportement, il echouerait.
function formeArabe(texte) {
  const t = String(texte || '');
  if (!t) return '';
  const ch = Array.from(t);
  const formes = c => ARABE_FORMES[c];
  const lieAvant   = c => !!c && !!formes(c) && formes(c)[1] !== '';
  const lieArriere = c => !!c && !!formes(c) && formes(c)[3] !== '';
  const sortie = [];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], suiv = ch[i + 1], prec = ch[i - 1];
    // ligature lam + alef (ﻻ) : une seule lettre, forme isolee ou finale
    if (c === '\u0644' && suiv && ARABE_LAM_ALEF[suiv]) {
      sortie.push(ARABE_LAM_ALEF[suiv][lieAvant(prec) ? 1 : 0]);
      i++;
      continue;
    }
    const f = formes(c);
    if (!f) { sortie.push(c); continue; }
    const avant = lieAvant(prec), apres = lieArriere(suiv);
    let tiree;
    if (avant && apres) tiree = f[2] || f[3] || f[0];
    else if (avant)     tiree = f[3] || f[0];
    else if (apres)     tiree = f[1] || f[0];
    else                tiree = f[0];
    sortie.push(tiree || c);
  }
  return sortie.join('');          // ordre logique : pdf-lib s'occupe de l'affichage
}
