/* tests/test_v408_cloisonnement.js — les eleves d'une AUTRE ecole ne s'affichent jamais.
 *
 * Defaut reellement signale par l'utilisateur : « dans le compte du nouvel etablissement
 * s'affichent les eleves de l'autre etablissement ».
 *
 * Cause : l'application lisait les listes du telephone sans se demander a quelle ecole
 * elles appartiennent. Regle posee en v4.08 : les listes de travail du telephone portent
 * une etiquette (l'ecole a laquelle elles appartiennent) ; une ecole ouverte ne montre que
 * les listes qui portent SON etiquette.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const pause = ms => new Promise(r => setTimeout(r, ms));

const CLASSES = JSON.stringify([
  { id: 4, nom: 'TCSF-1', eleves: [{ id: 1, massar: 'M1', nom: 'Eleve Un', prenom: '' }] },
  { id: 5, nom: 'TCSF-2', eleves: [{ id: 2, massar: '', nom: 'Eleve Sans Code', prenom: '' }] }
]);
const ABSENCES = JSON.stringify([{ id: 9, eleveId: 1, nom: 'Eleve Un', classe: 'TCSF-1', dateISO: '2026-09-10', seance: 'matin', type: 'absence' }]);

// etat : { modeEcole, ecoleOuverte (id/code), etiquettes du telephone }
function ouvrir(etat) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(win) {
      if (etat.modeEcole !== false) win.localStorage.setItem('installationServeur', '1');
      if (etat.ouverte) {
        win.localStorage.setItem('ecoleOuverteId', String(etat.ouverte.id || ''));
        win.localStorage.setItem('ecoleOuverteCode', String(etat.ouverte.code || ''));
      }
      if (etat.etiquetteEcole !== undefined) win.localStorage.setItem('etiquetteEcole', String(etat.etiquetteEcole));
      if (etat.etabDonnees !== undefined) win.localStorage.setItem('etabDonnees', String(etat.etabDonnees));
      if (etat.espaceServeur !== undefined) win.localStorage.setItem('espaceServeur', JSON.stringify(etat.espaceServeur));
      win.localStorage.setItem('classes', CLASSES);
      win.localStorage.setItem('absences', ABSENCES);
      win.fetch = function () { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('[]'); } }); };
    }
  });
  return dom.window;
}

setTimeout(async () => {
  // ---------- 1. le telephone porte les donnees de l'ecole ouverte : il les voit ----------
  const w1 = ouvrir({ ouverte: { id: 1, code: '55300S07' }, etiquetteEcole: 1 });
  await pause(150);
  w1.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
  t('1. donnees de CETTE ecole : visibles', w1.eval('donneesDuTelephoneVisibles()') === true);
  t('1. donnees de CETTE ecole : 2 classes affichees', w1.eval('classes.length') === 2, w1.eval('classes.length'));

  // ---------- 2. LE DEFAUT SIGNALE : donnees d'une AUTRE ecole ----------
  const w2 = ouvrir({ ouverte: { id: 4, code: '55300S08' }, etiquetteEcole: 1 });
  await pause(150);
  w2.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
  t('2. autre ecole : listes masquees', w2.eval('donneesDuTelephoneVisibles()') === false);
  t('2. autre ecole : AUCUNE classe affichee', w2.eval('classes.length') === 0, w2.eval('classes.length'));
  t('2. autre ecole : aucun eleve en memoire', w2.eval('classes.reduce(function(n,c){return n+(c.eleves||[]).length;},0)') === 0);
  t('2. autre ecole : rien n\'est EFFACE sur le telephone (on masque seulement)', w2.eval('Depot.lire("absences", null)') !== null);
  t('2. autre ecole : les absences ne sont pas envoyees non plus', w2.eval('absences.length') === 0, w2.eval('absences.length'));

  // ---------- 3. etiquete par le CODE de l'ecole (installation v4.06) ----------
  const w3 = ouvrir({ ouverte: { id: 4, code: '55300S08' }, etabDonnees: '55300S08' });
  await pause(150);
  w3.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
  t('3. etiquette par code : les donnees sont visibles', w3.eval('donneesDuTelephoneVisibles()') === true);
  t('3. etiquette par code : 2 classes affichees', w3.eval('classes.length') === 2);

  // ---------- 4. donnees sans etiquette, ecole ouverte : rien ----------
  const w4 = ouvrir({ ouverte: { id: 4, code: '55300S08' }, espaceServeur: {} });
  await pause(150);
  w4.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
  t('4. sans etiquette : listes masquees', w4.eval('donneesDuTelephoneVisibles()') === false);
  t('4. sans etiquette : AUCUNE classe affichee', w4.eval('classes.length') === 0);

  // ---------- 5. telephone libre (aucune ecole) : ses donnees sont les siennes ----------
  const w5 = ouvrir({ modeEcole: false });
  await pause(150);
  w5.eval('classes = chargerClasses(); if (typeof appliquerEcoleAuxListes === "function") appliquerEcoleAuxListes();');
  t('5. telephone libre : 2 classes affichees', w5.eval('classes.length') === 2, w5.eval('classes.length'));

  // ---------- 6. l'etiquette d'avant (memoire de l'espace serveur) est respectee ----------
  const w6 = ouvrir({ ouverte: { id: 7, code: 'X' }, espaceServeur: { etablissementId: 7 } });
  await pause(150);
  w6.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
  t('6. ancienne etiquette (id) : les donnees sont visibles', w6.eval('donneesDuTelephoneVisibles()') === true);

  console.log(ok ? 'TOUT OK — les listes d une autre ecole ne s affichent jamais.' : 'ECHEC — voir ci-dessus.');
  process.exit(ok ? 0 : 1);
}, 500);
