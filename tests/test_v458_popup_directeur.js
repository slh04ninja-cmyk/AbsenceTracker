/* tests/test_v458_popup_directeur.js — MESURE du defaut signale :
 * « compte directeur, j'ouvre RH, je clic 'Declarer une absence' et le popup ne s'ouvre pas »
 *
 * On ne modifie RIEN : on mesure seulement.
 *  - ce que vaut l'affichage de #modal-form AVANT (au chargement)
 *  - apres ouvrirFormulaire('absenceSurv')            (le bouton du directeur)
 *  - apres avoir ouvert puis ferme l'historique du personnel
 *  - puis de nouveau ouvrirFormulaire('absenceSurv')  (le defaut « qui revient »)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

function etat(win) {
  const m = win.document.getElementById('modal-form');
  if (!m) return 'introuvable';
  const inline = m.style.display || '(vide)';
  const cacheeParClasse = m.classList.contains('hidden');
  return 'display:' + inline + ' / classe-hidden:' + (cacheeParClasse ? 'oui' : 'non');
}
function visible(win) {
  const m = win.document.getElementById('modal-form');
  if (!m) return false;
  if (m.classList.contains('hidden')) return false;
  if (m.style.display === 'none') return false;
  return true;
}

(async () => {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('mesure hors ligne')); }
  });
  const win = dom.window;
  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 800));

  // directeur connecte (comme le vrai compte du directeur)
  win.eval("utilisateurConnecte = {role:'directeur', nom:'Directeur Test', email:'directeur@taalim.ma', code:'DIR1'};");
  win.eval("if (typeof appliquerRoleTheme === 'function') appliquerRoleTheme();");

  console.log('--- ETAT AU DEPART ---');
  console.log('   #modal-form ' + etat(win));

  // 1) le bouton « Declarer une absence » du directeur
  win.eval("if (typeof ouvrirFormulaire === 'function') ouvrirFormulaire('absenceSurv');");
  const etape1 = visible(win);
  t('1. au depart, « Declarer une absence » ouvre la fenetre', etape1, etat(win));
  win.eval("if (typeof fermerFormulaire === 'function') fermerFormulaire();");
  console.log('   apres fermeture ' + etat(win));

  // 2) l'historique du personnel (page RH) : ouverture puis fermeture
  let histoOk = true;
  try { win.eval("if (typeof ouvrirHistoriquePersonnel === 'function') ouvrirHistoriquePersonnel('enseignant');"); }
  catch (e) { histoOk = false; console.log('   (historique : ' + e.message + ')'); }
  console.log('   historique ouvert ' + etat(win));
  try { win.eval("if (typeof fermerHistoriquePersonnel === 'function') fermerHistoriquePersonnel();"); } catch (e) {}
  console.log('   historique ferme  ' + etat(win) + (histoOk ? '' : '  (ouverture en erreur)'));

  // 3) de nouveau « Declarer une absence » -> LE DEFAUT
  win.eval("if (typeof ouvrirFormulaire === 'function') ouvrirFormulaire('absenceSurv');");
  const etape3 = visible(win);
  t('2. apres avoir vu l historique, « Declarer une absence » ouvre encore', etape3, etat(win));

  // 4) un autre formulaire du directeur (fermeture / annulation)
  win.eval("if (typeof fermerFormulaire === 'function') fermerFormulaire();");
  win.eval("if (typeof ouvrirFormulaire === 'function') ouvrirFormulaire('fermeture');");
  t('3. la fenetre « Ajouter une fermeture » s ouvre aussi', visible(win), etat(win));

  console.log(ok ? '\nMESURE TERMINEE : tout s ouvre' : '\nMESURE TERMINEE : defaut reproduit');
  process.exit(0);
})();
