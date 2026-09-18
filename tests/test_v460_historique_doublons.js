/* tests/test_v460_historique_doublons.js — MESURE du défaut signalé :
 * « à chaque fois où j'ouvre l'historique des absences surveillant/enseignant dans RH,
 *   3 nouvelles listes déroulantes s'ajoutent dans le popup »
 *
 * Ce banc ouvre l'historique TROIS fois et compte les listes du bloc :
 *  - correct  : 3 listes (Période, Etat, personne) quel que soit le nombre d'ouvertures
 *  - défaut   : 3, puis 6, puis 9  (empilement)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

(async () => {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('banc hors ligne')); }
  });
  const win = dom.window;
  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 700));

  win.eval("utilisateurConnecte = {role:'directeur', nom:'Directeur Test', email:'directeur@taalim.ma', code:''};");
  win.eval("indispoProfs = [];");

  const compter = () => {
    const bloc = win.document.getElementById('bloc-form-historique');
    if (!bloc) return { listes: 0, declencheurs: 0 };
    return {
      listes: bloc.querySelectorAll('select').length,
      declencheurs: bloc.querySelectorAll('.sd').length,
      ids: Array.prototype.map.call(bloc.querySelectorAll('select'), s => s.id).join(',')
    };
  };

  const resultats = [];
  for (let ouverture = 1; ouverture <= 3; ouverture++) {
    win.eval("if (typeof ouvrirHistoriquePersonnel === 'function') ouvrirHistoriquePersonnel('enseignant');");
    win.eval("if (typeof fermerHistoriquePersonnel === 'function') fermerHistoriquePersonnel();");
    resultats.push(compter());
    console.log('ouverture ' + ouverture + ' -> ' + resultats[ouverture - 1].listes + ' liste(s) : ' + resultats[ouverture - 1].ids);
  }

  t('les 3 filtres sont présents (Période, Etat, personne)',
    resultats[0].listes === 3, resultats[0].ids);
  t('une 2e ouverture n ajoute pas de liste', resultats[1].listes === 3, resultats[1].listes + ' listes');
  t('une 3e ouverture n ajoute pas de liste', resultats[2].listes === 3, resultats[2].listes + ' listes');
  t('chaque liste n a qu un seul déclencheur habillé (.sd)',
    resultats[2].declencheurs === 3, resultats[2].declencheurs + ' déclencheurs');

  console.log(ok ? '\nTOUT OK' : '\nECHEC');
  process.exit(0);
})();
