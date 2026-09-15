/* outils/essai_donnees.js — MONTER les donnees de Jerada sur le serveur (vraie migration).
 *
 * On charge la sauvegarde du telephone (sauvegarde-absencetrack-2026-09-15.json), on se
 * connecte au serveur comme le directeur, on appelle « envoyerMesDonnees » et on affiche
 * le rapport. La relecture independante se fait ensuite par requete SQL.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const SAUVEGARDE = '/storage/emulated/0/Download/sauvegarde-absencetrack-2026-09-15.json';
const mdp = JSON.parse(fs.readFileSync(path.join(process.env.HOME, 'abs2', 'comptes.json'), 'utf8'));
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const sauvegarde = JSON.parse(fs.readFileSync(SAUVEGARDE, 'utf8'));
const contenu = sauvegarde.contenu;

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 160)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.fetch = fetch;
    win.alert = m => console.log(String(m));
    Object.keys(contenu).forEach(k => {
      const v = contenu[k];
      win.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    });
    win.localStorage.setItem('installationServeur', '1');
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== MONTEES DES DONNEES (vraie) ===');
  console.log('telephone :', win.eval('classes.length'), 'classes ·',
    win.eval('classes.reduce((n,c)=>n+c.eleves.length,0)'), 'eleves ·',
    win.eval('Object.keys(tableauxService).reduce((n,k)=>n+tableauxService[k].length,0)'), 'seances ·',
    win.eval('absences.length'), 'absences');
  await win.atConnecter('directeur@taalim.ma', mdp['directeur@taalim.ma']);
  const r = await win.envoyerMesDonnees();
  console.log('erreurs jsdom :', erreurs.length, erreurs.slice(0, 2).join(' ;; '));
  process.exit(r ? 0 : 1);
}, 1200);
