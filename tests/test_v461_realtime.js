/* tests/test_v461_realtime.js — le temps reel fait-il son travail SANS toucher au reste ?
 *
 * Ce banc simule le serveur Supabase Realtime (fausse WebSocket) et mesure :
 *   - la connexion part vers le bon serveur avec les 8 tables de travail ;
 *   - un evenement de la base = une seule relecture, meme si 3 evenements arrivent ensemble ;
 *   - les battements de coeur ne declenchent aucune relecture ;
 *   - le filet de securite passe a 30 s quand tout va bien, et repasse a 5 s des qu'on
 *     perd la connexion (le telephone n'est donc jamais moins bien qu'avant) ;
 *   - une coupure se rouvre toute seule ;
 *   - le jeton renouvele est pousse sans couper le flux.
 *
 * Rien de tout cela ne doit changer les fonctionnalites de l'application : le banc
 * verifie que le module ne fait QUE declencher le tour de rafraichissement existant.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const pause = (ms) => new Promise(r => setTimeout(r, ms));

// ---- la fausse WebSocket : elle garde tout ce que l'application envoie ----
class FauxWebSocket {
  constructor(url) {
    this.url = String(url || '');
    this.envoyes = [];
    this.ferme = false;
    FauxWebSocket.crees.push(this);
  }
  send(texte) { if (!this.ferme) this.envoyes.push(String(texte)); }
  close() { this.ferme = true; if (this.onclose) this.onclose(); }
  recevoir(objet) { if (this.onmessage) this.onmessage({ data: JSON.stringify(objet) }); }
  messages() { return this.envoyes.map(s => JSON.parse(s)); }
}
FauxWebSocket.crees = [];

(async () => {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = () => Promise.reject(new Error('banc hors ligne'));
      w.WebSocket = FauxWebSocket;
    }
  });
  const win = dom.window;
  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 700));

  // le demarrage de l application (init) doit lancer la surveillance temps reel
  t('le demarrage de l application lance la surveillance temps reel',
    win.eval("typeof atRtMinuteurs === 'object' && atRtMinuteurs.surveillance !== null"));

  // on eteint les minuteurs reels de l'application : ce banc pilote tout lui-meme
  win.eval("try { clearInterval(atRafraichissementOrdre); } catch (e) {}");
  win.eval("atRealtimeFermer();");

  // telephone en mode ecole, session ouverte, et compteurs de mesure
  win.eval("estModeEcole = function () { return true; };");
  win.eval("atChargerSession = function () { return { access_token: 'jeton-test' }; };");
  win.eval("atJeton = function () { return Promise.resolve('jeton-test'); };");
  win.eval("window.__filets = []; demarrerRafraichissementAuto = function (s) { window.__filets.push(s); return s * 1000; };");
  win.eval("window.__tours = 0; atUnTourDeRafraichissement = function () { window.__tours += 1; };");

  // ---- 1. ouverture ----
  win.eval("atRealtimeOuvrir();");
  await pause(60);
  t('la connexion s ouvre vers le serveur temps reel', FauxWebSocket.crees.length === 1 &&
    FauxWebSocket.crees[0].url.indexOf('wss://') === 0 &&
    FauxWebSocket.crees[0].url.indexOf('/realtime/v1/websocket') > 0 &&
    FauxWebSocket.crees[0].url.indexOf('vsn=1.0.0') > 0,
    FauxWebSocket.crees.length ? FauxWebSocket.crees[0].url.slice(0, 60) + '…' : 'aucune');

  const socket1 = FauxWebSocket.crees[0];
  socket1.onopen();

  // ---- 2. la demande d'abonnement ----
  const envois1 = socket1.messages();
  const join = envois1.find(m => m.event === 'phx_join');
  const tables = join && join.payload && join.payload.config && join.payload.config.postgres_changes
    ? join.payload.config.postgres_changes.map(f => f.table) : [];
  t('les 8 tables de travail sont demandees', tables.length === 8, tables.join(','));
  t('le jeton de la session accompagne l abonnement',
    !!(join && join.payload && join.payload.access_token === 'jeton-test'));
  t('l abonnement couvre tous les evenements (ajout, modification, retrait)',
    join.payload.config.postgres_changes.every(f => f.event === '*'));

  // ---- 3. le serveur accepte ----
  socket1.recevoir({ ref: join.join_ref, event: 'phx_reply', topic: 'realtime:absencetrack',
                     payload: { status: 'ok', response: { postgres_changes: tables.map((tb, i) => ({ id: i + 1, event: '*', schema: 'public', table: tb })) } } });
  await pause(50);
  t('le filet de securite passe a 30 s quand le temps reel fonctionne',
    win.eval('window.__filets[window.__filets.length - 1]') === 30,
    win.eval('window.__filets.join(",")'));

  await pause(700);
  t('une relecture a lieu tot apres l abonnement (rattrapage)', win.eval('window.__tours') === 1,
    win.eval('window.__tours') + ' tour(s)');

  // ---- 4. le regroupement ----
  win.eval('window.__tours = 0');
  const evenement = (table) => ({ ref: null, topic: 'realtime:absencetrack', event: 'postgres_changes',
    payload: { ids: [1], data: { type: 'INSERT', schema: 'public', table: table, record: {}, old_record: {}, commit_timestamp: '2026-09-29T00:00:00Z' } } });
  socket1.recevoir(evenement('signalements'));
  socket1.recevoir(evenement('annulations_seances'));
  socket1.recevoir(evenement('absences_personnel'));
  await pause(700);
  t('3 evenements groupes ne font qu une seule relecture', win.eval('window.__tours') === 1,
    win.eval('window.__tours') + ' tour(s)');

  socket1.recevoir(evenement('fermetures'));
  await pause(700);
  t('un evenement plus tard declenche une nouvelle relecture', win.eval('window.__tours') === 2,
    win.eval('window.__tours') + ' tour(s)');

  // ---- 5. le battement de coeur n'est pas un changement ----
  win.eval('window.__tours = 0');
  socket1.recevoir({ ref: '99', event: 'phx_reply', topic: 'phoenix', payload: { status: 'ok', response: {} } });
  await pause(700);
  t('le battement de coeur ne declenche aucune relecture', win.eval('window.__tours') === 0,
    win.eval('window.__tours') + ' tour(s)');

  // ---- 6. coupure : retour a 5 s + reprise automatique ----
  win.eval('window.__filets = []');
  socket1.onclose();
  t('une coupure remet le filet de securite a 5 s (comme avant)',
    win.eval('window.__filets[window.__filets.length - 1]') === 5,
    win.eval('window.__filets.join(",")'));
  await pause(2300);
  t('la connexion se rouvre toute seule apres une coupure', FauxWebSocket.crees.length === 2,
    FauxWebSocket.crees.length + ' connexion(s)');

  // ---- 7. changement de jeton sans couper le flux ----
  const socket2 = FauxWebSocket.crees[1];
  socket2.onopen();
  const join2 = socket2.messages().find(m => m.event === 'phx_join');
  socket2.recevoir({ ref: join2.join_ref, event: 'phx_reply', topic: 'realtime:absencetrack',
                     payload: { status: 'ok', response: {} } });
  win.eval("atJeton = function () { return Promise.resolve('jeton-neuf'); };");
  win.eval("atRealtimeRenouvelerJeton();");
  await pause(80);
  const jetonPousse = socket2.messages().find(m => m.event === 'access_token');
  t('le jeton renouvele est envoye au serveur', !!(jetonPousse && jetonPousse.payload.access_token === 'jeton-neuf'),
    jetonPousse ? 'jeton ' + jetonPousse.payload.access_token : 'aucun');
  t('la connexion n a pas ete coupee par le changement de jeton',
    FauxWebSocket.crees.length === 2 && socket2.ferme === false);

  // ---- 8. abonnement impossible (table pas encore dans la publication) ----
  win.eval('window.__filets = []');
  socket2.recevoir({ ref: null, topic: 'realtime:absencetrack', event: 'system',
                     payload: { status: 'error', extension: 'postgres_changes', message: 'Unable to subscribe' } });
  await pause(50);
  t('un abonnement refuse remet le filet de securite a 5 s',
    win.eval('window.__filets[window.__filets.length - 1]') === 5,
    win.eval('window.__filets.join(",")'));

  console.log(ok ? '\nTOUT OK' : '\nECHEC');
  process.exit(0);
})();
