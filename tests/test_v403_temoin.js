/* tests/test_v403_temoin.js — le temoin « sur quoi je travaille ? ».
 *
 * Demande de l'utilisateur : « comment je peux savoir si l'application travaille sur le
 * serveur, pas localement ? » -> un petit temoin visible dans la barre de titre :
 *   telephone (defaut) / serveur (relie) / hors ligne (relie mais serveur injoignable).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

function ouvrir(avant) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) { w.localStorage.setItem('modeDemonstration', '1'); if (avant) avant(w); }
  });
  return dom.window;
}
const badge = win => win.document.querySelector('.appbar .badge-etat');

const pause = ms => new Promise(r => setTimeout(r, ms));

setTimeout(async () => {
  // 1. telephone non relie : le temoin dit « telephone »
  const w1 = ouvrir(null);
  await pause(150);                        // le temoin se pose quand la page est prete
  t('le temoin existe dans la barre de titre', !!badge(w1));
  t('il y a un temoin par page (barre de titre)', w1.document.querySelectorAll('.badge-etat').length >= 4,
    w1.document.querySelectorAll('.badge-etat').length + ' temoin(s)');
  t('application non reliee : « telephone »', w1.eval('etatTravail()') === 'telephone', w1.eval('etatTravail()'));
  t('sa classe suit l etat', badge(w1).classList.contains('badge-telephone'), badge(w1).className);
  t('son libelle est ecrit', badge(w1).textContent.indexOf('telephone') >= 0, badge(w1).textContent);
  t('et il explique au survol', badge(w1).title.indexOf('telephone') >= 0, badge(w1).title);

  // 2. mode ecole sans session ouverte : « hors ligne »
  const w2 = ouvrir(w => w.localStorage.setItem('installationServeur', '1'));
  await pause(150);
  t('ecole reliee sans session : « hors ligne »', w2.eval('etatTravail()') === 'hors-ligne', w2.eval('etatTravail()'));
  t('sa classe suit l etat', badge(w2).classList.contains('badge-hors-ligne'), badge(w2).className);

  // 3. mode ecole avec une session : « serveur »
  const w3 = ouvrir(w => {
    w.localStorage.setItem('installationServeur', '1');
    w.localStorage.setItem('atSession', JSON.stringify({ access_token: 'essai', refresh_token: 'essai',
      expire_le: Date.now() + 3600000, email: 'directeur@taalim.ma', id: 'x' }));
  });
  await pause(150);
  t('ecole reliee avec session : « serveur »', w3.eval('etatTravail()') === 'serveur', w3.eval('etatTravail()'));
  t('sa classe suit l etat', badge(w3).classList.contains('badge-serveur'), badge(w3).className);
  t('son libelle est ecrit', badge(w3).textContent.indexOf('serveur') >= 0, badge(w3).textContent);

  // 4. le clic explique la situation (ici : pas de serveur joignable dans le banc)
  w1.verifierEtatTravail();
  t('un clic le dit clairement (notification)', w1.document.getElementById('toast').textContent.indexOf('NON reliee') >= 0,
    w1.document.getElementById('toast').textContent);

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 700);
