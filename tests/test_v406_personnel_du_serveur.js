/* tests/test_v406_personnel_du_serveur.js — une ECOLE NEUVE n'a PERSONNE.
 *
 * Defaut reellement signale par l'utilisateur : apres avoir installe un NOUVEL
 * etablissement avec un nouveau directeur, l'ecran RH montrait les memes
 * enseignants et surveillants que l'autre ecole.
 *
 * Cause : la liste venait du telephone (liste ecrite dans l'application) des que le
 * serveur ne renvoyait personne. Une ecole reliee a la base ne doit JAMAIS montrer
 * cette liste-la : elle montre SES fiches, meme quand il n'y en a aucune.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const pause = ms => new Promise(r => setTimeout(r, ms));

// Un faux serveur : il repond ce qu'on lui dit (ici : une ecole neuve = aucune fiche).
function ouvrir(reponseProfils) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(win) {
      win.localStorage.setItem('installationServeur', '1');
      win.localStorage.setItem('atSession', JSON.stringify({
        access_token: 'essai', refresh_token: 'essai',
        expire_le: Date.now() + 3600000, email: 'nouveau@exemple.ma', id: 'x'
      }));
      win.fetch = function (url) {
        const u = String(url);
        const corps = u.indexOf('/rest/v1/profils') >= 0 ? reponseProfils : [];
        return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(corps)); } });
      };
    }
  });
  return dom.window;
}

setTimeout(async () => {
  // ---------- 1. ecole neuve (le serveur ne connait aucun membre du personnel) ----------
  const w1 = ouvrir([]);
  await pause(150);
  await w1.afficherListeProfs();
  await pause(150);
  const ens = w1.document.getElementById('dir-profs-list').textContent;
  const surv = w1.document.getElementById('dir-surveillants-list').textContent;
  t('ecole neuve : aucun enseignant', ens.indexOf('Aucun enseignant') >= 0, ens.slice(0, 60));
  t('ecole neuve : aucun surveillant', surv.indexOf('Aucun surveillant') >= 0, surv.slice(0, 60));
  t('la liste du telephone NE S AFFICHE PLUS',
    ens.indexOf('math-prof1') < 0 && ens.indexOf('أيوب') < 0 && surv.indexOf('Surveillant 1') < 0,
    ens.slice(0, 80) + ' | ' + surv.slice(0, 40));

  // ---------- 2. ecole avec du personnel : ce sont SES fiches ----------
  const w2 = ouvrir([
    { id: 91, nom: 'Prof De Cette Ecole', role: 'enseignant', matiere: 'math', email: 'math-prof1@exemple.ma', auth_user_id: null },
    { id: 92, nom: 'Surv De Cette Ecole', role: 'surveillant', matiere: null, email: 'surv1@exemple.ma', auth_user_id: null }
  ]);
  await pause(150);
  await w2.afficherListeProfs();
  await pause(150);
  const ens2 = w2.document.getElementById('dir-profs-list').textContent;
  const surv2 = w2.document.getElementById('dir-surveillants-list').textContent;
  t('les fiches du serveur sont bien affichees', ens2.indexOf('Prof De Cette Ecole') >= 0, ens2.slice(0, 60));
  t('avec leur matiere et leur adresse', ens2.indexOf('math') >= 0 && ens2.indexOf('math-prof1@exemple.ma') >= 0, ens2.slice(0, 80));
  t('les surveillants du serveur aussi', surv2.indexOf('Surv De Cette Ecole') >= 0, surv2.slice(0, 60));
  t('et toujours AUCUNE personne du telephone', ens2.indexOf('أيوب') < 0 && surv2.indexOf('Surveillant 1') < 0);

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 700);
