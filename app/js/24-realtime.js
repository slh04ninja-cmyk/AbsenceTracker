// fichier: app/js/24-realtime.js
// ========== LA BASE PREVIENT LE TELEPHONE (TEMPS REEL) ==========
// Jusqu'ici le telephone decouvrait les changements des autres en relisant la base
// toutes les 5 s. Desormais la base ENVOIE un evenement des qu'une ligne bouge
// (un collegue coche une absence, le directeur approuve, une seance est annulee...)
// et la relecture se fait tout de suite.
//
// CE MODULE NE CHANGE AUCUNE FONCTIONNALITE : il ne fait que DECLENCHER PLUS VITE
// le tour de rafraichissement deja existant (22-sync.js), qui pousse le telephone
// vers la base puis relit la base. Les evenements d'un meme coup sont GROUPES
// (500 ms) : dix changements qui arrivent ensemble ne font qu'UNE relecture.
//
// LE TOUR PERIODIQUE RESTE : c'est le filet de securite. Quand le temps reel
// fonctionne, il passe a 30 s ; quand la connexion manque, il reprend 5 s, comme
// avant. Le telephone n'est donc jamais moins bien qu'avant ce module.
//
// Protocole : WebSocket Supabase Realtime (« postgres changes »), ecrit a la main,
// sans bibliotheque nouvelle. L'abonnement est filtre par les regles de la base :
// un telephone ne recoit que ce qu'il avait deja le droit de lire.

const AT_RT_TABLES = ['classes', 'eleves', 'profils', 'seances', 'signalements',
                      'annulations_seances', 'absences_personnel', 'fermetures'];
const AT_RT_SUJET = 'realtime:absencetrack';
const AT_RT_REGROUPEMENT = 500;          // ms : on regroupe les evenements d'un meme coup
const AT_RT_TOUR_LENT = 30;              // s : filet de securite quand le temps reel fonctionne
const AT_RT_TOUR_RAPIDE = 5;             // s : filet de securite quand il ne fonctionne pas
const AT_RT_REPRISE = 2000;              // ms : premiere reprise apres une coupure
const AT_RT_REPRISE_MAX = 60000;         // ms : delai maximal entre deux reprises
const AT_RT_SURVEILLANCE = 5000;         // ms : verrou de la connexion (ouverture apres connexion)
const AT_RT_BATEMENT = 25000;            // ms : le client dit « je suis la » au serveur
const AT_RT_MUET = 70000;                // ms : sans nouvelle du serveur, le lien est mort

let atRtSocket = null;
let atRtEtat = 'ferme';                  // ferme | attente | ouvert | abonne
let atRtRef = 0;                         // reference des messages envoyes
let atRtJoinRef = null;
let atRtJetonUtilise = null;
let atRtMinuteurs = { regroupement: null, reprise: null, surveillance: null, jeton: null, battement: null };
let atRtDelaiReprise = AT_RT_REPRISE;
let atRtArrete = false;
let atRtDernierMessage = 0;

// ---------- petites briques ----------
function atRtEnvoyer(objet) {
  if (!atRtSocket || atRtEtat === 'ferme') return false;
  try { atRtSocket.send(JSON.stringify(objet)); return true; } catch (e) { return false; }
}

function atRtSuivant() { atRtRef += 1; return String(atRtRef); }

// une connexion reussie passe le filet de securite a 30 s ; une coupure le remet a 5 s
function atRtFilet(secondes) {
  if (typeof demarrerRafraichissementAuto === 'function') {
    try { demarrerRafraichissementAuto(secondes); } catch (e) {}
  }
}

// ---------- le regroupement : une relecture par rafale d'evenements ----------
function atRealtimeSurChangement() {
  if (atRtMinuteurs.regroupement) return;          // une relecture est deja prevue
  atRtMinuteurs.regroupement = setTimeout(function () {
    atRtMinuteurs.regroupement = null;
    if (typeof atUnTourDeRafraichissement !== 'function') return;
    try { atUnTourDeRafraichissement(); } catch (e) {}
  }, AT_RT_REGROUPEMENT);
}

// ---------- ouverture de la connexion ----------
async function atRealtimeOuvrir() {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
  if (atRtSocket) return;                                   // deja en cours
  if (typeof estModeEcole !== 'function' || !estModeEcole()) return;
  let jeton = null;
  try { jeton = await atJeton(); } catch (e) { jeton = null; }
  if (!jeton) return;                                       // pas de session : on reessayera
  if (atRtSocket) return;                                   // une autre attente a pris les devants
  atRtArrete = false;
  const url = String(AT_BASE).replace('https://', 'wss://') +
              '/realtime/v1/websocket?apikey=' + AT_CLE + '&vsn=1.0.0';
  let socket = null;
  try { socket = new WebSocket(url); } catch (e) { atRtReprendre(); return; }
  atRtSocket = socket;
  atRtEtat = 'attente';
  atRtJetonUtilise = jeton;

  socket.onopen = function () {
    if (socket !== atRtSocket) return;
    atRtEtat = 'ouvert';
    atRtDernierMessage = Date.now();
    atRtDemarrerBattement();
    atRtJoinRef = atRtSuivant();
    const filtres = AT_RT_TABLES.map(function (t) {
      return { event: '*', schema: 'public', table: t };
    });
    atRtEnvoyer({
      topic: AT_RT_SUJET, event: 'phx_join', ref: atRtJoinRef, join_ref: atRtJoinRef,
      payload: { config: { postgres_changes: filtres }, access_token: jeton }
    });
  };

  socket.onmessage = function (e) {
    if (socket !== atRtSocket) return;
    atRealtimeMessage(e);
  };

  socket.onclose = function () {
    if (socket !== atRtSocket) return;
    atRtArreterBattement();
    atRtSocket = null;
    atRtEtat = 'ferme';
    atRtJoinRef = null;
    if (atRtArrete) return;
    atRtFilet(AT_RT_TOUR_RAPIDE);          // on retombe sur le fonctionnement d'avant
    atRtReprendre();
  };

  socket.onerror = function () { /* le close qui suit suffit : on ne devine pas l'erreur */ };
}

// ---------- ce que le serveur envoie ----------
function atRealtimeMessage(e) {
  atRtDernierMessage = Date.now();          // le lien vit : toute trame compte
  let m = null;
  try { m = JSON.parse(typeof e.data === 'string' ? e.data : ''); } catch (err) { return; }
  if (!m || typeof m !== 'object') return;
  if (m.topic === 'phoenix') return;                          // reponses de battement de coeur

  if (m.event === 'phx_reply') {
    if (m.ref !== atRtJoinRef) return;
    if (m.payload && m.payload.status === 'ok') {
      atRtEtat = 'abonne';
      atRtDelaiReprise = AT_RT_REPRISE;
      atRtFilet(AT_RT_TOUR_LENT);                             // tout va bien : filet a 30 s
      atRealtimeSurChangement();                              // rattrapage : on relit une fois
    } else {
      atRtRetenter();                                          // abonnement refuse : on reessaie
    }
    return;
  }

  if (m.event === 'postgres_changes') { atRealtimeSurChangement(); return; }

  // le serveur signale qu'un abonnement n'a pas pu se faire (table pas encore dans la
  // publication realtime, par exemple) : le filet de securite reprend son role
  if (m.event === 'system' && m.payload && m.payload.status === 'error') {
    if (atRtEtat === 'abonne') atRtEtat = 'ouvert';
    atRtFilet(AT_RT_TOUR_RAPIDE);
    atRtRetenter();
  }
}

// ---------- battement de coeur : seul moyen de voir un lien mort en silence ----------
function atRtDemarrerBattement() {
  atRtArreterBattement();
  atRtMinuteurs.battement = setInterval(function () {
    atRtEnvoyer({ topic: 'phoenix', event: 'heartbeat', payload: {},
                  ref: atRtSuivant(), join_ref: null });
  }, AT_RT_BATEMENT);
}

function atRtArreterBattement() {
  if (atRtMinuteurs.battement) { clearInterval(atRtMinuteurs.battement); atRtMinuteurs.battement = null; }
}

// ---------- reprise apres coupure ou abonnement refuse ----------
function atRtReprendre() {
  if (atRtArrete || atRtMinuteurs.reprise) return;
  const delai = atRtDelaiReprise;
  atRtDelaiReprise = Math.min(atRtDelaiReprise * 2, AT_RT_REPRISE_MAX);
  atRtMinuteurs.reprise = setTimeout(function () {
    atRtMinuteurs.reprise = null;
    atRealtimeOuvrir();
  }, delai);
}

// le socket reste ouvert mais l'abonnement n'a pas pris : on referme et on recommence
function atRtRetenter() {
  const socket = atRtSocket;
  atRtSocket = null;
  atRtEtat = 'ferme';
  if (socket) { try { socket.close(); } catch (e) {} }
  atRtReprendre();
}

// ---------- jeton de connexion : on le rafraichit sans couper le flux ----------
function atRealtimeRenouvelerJeton() {
  if (!atRtSocket || atRtEtat !== 'abonne') return;
  if (typeof atJeton !== 'function') return;
  atJeton().then(function (jeton) {
    if (!jeton || jeton === atRtJetonUtilise) return;
    atRtJetonUtilise = jeton;
    atRtEnvoyer({
      topic: AT_RT_SUJET, event: 'access_token',
      ref: atRtSuivant(), join_ref: atRtJoinRef,
      payload: { access_token: jeton }
    });
  }).catch(function () {});
}

// ---------- surveillance : la connexion suit la session (connexion, deconnexion) ----------
function atRealtimeSurveiller() {
  if (typeof window === 'undefined') return;
  const enEcole = (typeof estModeEcole === 'function') && estModeEcole();
  const enSession = (typeof atChargerSession === 'function') && !!(atChargerSession() && atChargerSession().access_token);
  // lien muet (plus aucune trame recue) : on le considere mort et on en rouvre un
  if (atRtSocket && atRtDernierMessage && (Date.now() - atRtDernierMessage) > AT_RT_MUET) {
    atRtRetenter();
  }
  if (enEcole && enSession) {
    if (!atRtSocket) { atRealtimeOuvrir(); }
  } else if (atRtSocket) {
    atRtFermerSocket();               // deconnexion ou telephone libre : on coupe, on surveille toujours
  }
}

// ---------- demarrage / arret ----------
function atRealtimeDemarrer() {
  if (typeof window === 'undefined') return;
  if (!atRtMinuteurs.surveillance) {
    atRtMinuteurs.surveillance = setInterval(atRealtimeSurveiller, AT_RT_SURVEILLANCE);
  }
  if (!atRtMinuteurs.jeton) {
    atRtMinuteurs.jeton = setInterval(atRealtimeRenouvelerJeton, 20 * 60 * 1000);
  }
  atRealtimeSurveiller();
}

// couper la seule connexion (la surveillance reste active et rouvrira au besoin)
function atRtFermerSocket() {
  atRtArrete = true;                            // pas de reprise automatique : c'est voulu
  atRtArreterBattement();
  if (atRtMinuteurs.reprise) { clearTimeout(atRtMinuteurs.reprise); atRtMinuteurs.reprise = null; }
  if (atRtMinuteurs.regroupement) { clearTimeout(atRtMinuteurs.regroupement); atRtMinuteurs.regroupement = null; }
  const socket = atRtSocket;
  atRtSocket = null;
  atRtEtat = 'ferme';
  atRtJoinRef = null;
  atRtDelaiReprise = AT_RT_REPRISE;
  if (socket) { try { socket.close(); } catch (e) {} }
}

function atRealtimeFermer() {
  atRtFermerSocket();
  if (atRtMinuteurs.surveillance) { clearInterval(atRtMinuteurs.surveillance); atRtMinuteurs.surveillance = null; }
  if (atRtMinuteurs.jeton) { clearInterval(atRtMinuteurs.jeton); atRtMinuteurs.jeton = null; }
}

if (typeof window !== 'undefined') {
  window.atRealtimeOuvrir = atRealtimeOuvrir;
  window.atRealtimeFermer = atRealtimeFermer;
  window.atRealtimeDemarrer = atRealtimeDemarrer;
  window.atRealtimeSurChangement = atRealtimeSurChangement;
  window.atRealtimeRenouvelerJeton = atRealtimeRenouvelerJeton;
}
