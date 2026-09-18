/* tests/test_v459_dashboard_seances.js — les seances annulees passees quittent le Dashboard.
 *
 * Demande de l'utilisateur (18/09) : « pourquoi les seances annulees des deux jours 17, 18
 * s'affichent encore dans le dashboard tant que sont des seances passees » → decision :
 * aujourd'hui + a venir, ET une seance d'aujourd'hui disparait des que son heure est passee,
 * MAIS « ne pas supprimer ces seances dans la base ».
 *
 * Ce banc verifie les deux moities de la regle, et surtout qu'il n'y a AUCUNE suppression :
 *  - hier            -> plus affichee
 *  - aujourd'hui, heure deja passee -> plus affichee
 *  - aujourd'hui, heure a venir     -> affichee
 *  - apres-demain    -> affichee
 *  - listeSeancesAnnulees() (taux de presence, statistiques) -> contient TOUJOURS les 4
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

const jour = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const heure = min => {
  const d = new Date(Date.now() + min * 60000);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

(async () => {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('banc hors ligne')); }
  });
  const win = dom.window;
  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 700));

  const HIER = jour(-1), AUJ = jour(0), APRES = jour(2);
  const PASSE = heure(-90), A_VENIR = heure(90);

  win.eval("indispoProfs = [];");                 // aucune absence de personnel : on isole la carte
  win.eval("seancesAnnulees = " + JSON.stringify([
    { id: 1, dateISO: HIER, classe: 'TCSF-3', debut: '08:00', fin: '10:00', motif: 'Hier' },
    { id: 2, dateISO: AUJ, classe: 'TCSF-2', debut: PASSE, fin: heure(-89), motif: 'Aujourd hui deja passee' },
    { id: 3, dateISO: AUJ, classe: 'TCSF-1', debut: A_VENIR, fin: heure(150), motif: 'Aujourd hui a venir' },
    { id: 4, dateISO: APRES, classe: 'TCSF-3', debut: '10:00', fin: '12:00', motif: 'Apres-demain' }
  ]) + ";");

  win.eval("if (typeof afficherSeancesAnnulees === 'function') afficherSeancesAnnulees();");
  const cont = win.document.getElementById('annul-liste');
  const texte = cont ? cont.textContent : '';
  const nb = cont ? cont.children.length : -1;

  t('hier : plus affichee', texte.indexOf('Hier') === -1, 'carte = ' + nb + ' ligne(s)');
  t('aujourd hui (heure passee) : plus affichee', texte.indexOf('deja passee') === -1);
  t('aujourd hui (heure a venir) : affichee', texte.indexOf('a venir') > -1);
  t('apres-demain : affichee', texte.indexOf('Apres-demain') > -1);
  t('la carte ne garde que 2 lignes', nb === 2, 'lignes = ' + nb);

  // rien n'est supprime pour les calculs
  const restantes = win.eval("JSON.stringify(listeSeancesAnnulees().map(function (s) { return s.motif; }))");
  const liste = JSON.parse(restantes);
  t('les calculs (taux de presence) gardent les 4 annulations', liste.length === 4, liste.join(' | '));
  t('la liste des calculs contient encore « Hier »', liste.indexOf('Hier') > -1);

  console.log(ok ? '\nTOUT OK' : '\nECHEC');
  process.exit(0);
})();
