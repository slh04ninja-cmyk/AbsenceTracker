// fichier: app/js/03b-serveur.js
// ========== SERVEUR (Supabase) ==========
// L'application range ses donnees DANS LE TELEPHONE (la porte « Depot »). Ce module
// porte la porte vers le SERVEUR : la configuration, la connexion reelle des
// utilisateurs (Supabase Auth, mot de passe hache cote serveur) et les echanges de
// donnees (API REST).
//
// La cle ci-dessous est la cle PUBLIQUE : elle est FAITE pour vivre dans le code et
// n'ouvre rien toute seule — c'est la RLS du serveur qui decide ce que chacun voit.
// Le mot de passe de base, lui, ne doit JAMAIS se trouver ici.
const SERVEUR = {
  url: 'https://mtbadhxrezbbuzdtfpez.supabase.co',
  cle: 'sb_publishable_riEixeLQaD-5-XXoyQHSxA_q-CCf7Gu',
  session: null
};

// Identifiant de l'etablissement du serveur auquel on est rattache : il vient de la fiche
// (ou du compte connecte). On ne le range PAS dans le compte, pour ne jamais melanger un
// compte de demonstration et l'etablissement du serveur.
let etablissementServeurId = null;
let ficheServeurId = null;

function serveurIdFiche() {
  return (utilisateurConnecte && utilisateurConnecte.fiche) || ficheServeurId || null;
}

function serveurConfigure() { return !!(SERVEUR.url && SERVEUR.cle); }

function serveurIdEtablissement() {
  return (utilisateurConnecte && utilisateurConnecte.etablissementId) || etablissementServeurId || null;
}

// ---------- session (jetons uniquement : aucun mot de passe n'est conserve) ----------
function serveurSauverSession(s) {
  SERVEUR.session = s;
  if (s) Depot.ecrireJSON('sessionServeur', s); else Depot.effacer('sessionServeur');
}

function serveurChargerSession() {
  const s = Depot.lireJSON('sessionServeur', null);
  SERVEUR.session = (s && s.access_token) ? s : null;
  return SERVEUR.session;
}

function serveurMessageErreur(d, statut) {
  if (!d) return 'erreur ' + statut;
  if (typeof d === 'string') return d;
  return d.message || d.error_description || d.msg || d.hint || ('erreur ' + statut);
}

// ---------- appel au serveur ----------
async function serveurAppel(chemin, options) {
  const o = options || {};
  const entetes = Object.assign({ 'apikey': SERVEUR.cle, 'Content-Type': 'application/json' }, o.entetes || {});
  const jeton = SERVEUR.session && SERVEUR.session.access_token;
  entetes['Authorization'] = 'Bearer ' + (jeton || SERVEUR.cle);
  const reponse = await fetch(SERVEUR.url + chemin, {
    method: o.methode || 'GET',
    headers: entetes,
    body: o.corps ? JSON.stringify(o.corps) : undefined
  });
  const texte = await reponse.text();
  let donnees = null;
  try { donnees = texte ? JSON.parse(texte) : null; } catch (e) { donnees = texte; }
  if (!reponse.ok) {
    // Le jeton de connexion ne vit qu'UNE HEURE. S'il est perime, on le renouvelle une seule
    // fois avec le jeton de rafraichissement, puis on refait l'appel : c'est ce qui evite de
    // redemander le mot de passe a l'utilisateur (defaut reellement signale).
    if (reponse.status === 401 && !o.sansRafraichir && SERVEUR.session && SERVEUR.session.refresh_token) {
      try {
        await serveurRafraichir();
        return await serveurAppel(chemin, Object.assign({}, o, { sansRafraichir: true }));
      } catch (e) {
        serveurSauverSession(null);            // renouvellement impossible : session morte
      }
    }
    const erreur = new Error(serveurMessageErreur(donnees, reponse.status));
    erreur.statut = reponse.status;
    erreur.donnees = donnees;
    throw erreur;
  }
  return donnees;
}

// Renouvelle le jeton de connexion a partir du jeton de rafraichissement.
async function serveurRafraichir() {
  const s = SERVEUR.session;
  if (!s || !s.refresh_token) throw new Error('session sans jeton de rafraichissement');
  const d = await serveurAppel('/auth/v1/token?grant_type=refresh_token', {
    methode: 'POST', corps: { refresh_token: s.refresh_token }, sansRafraichir: true
  });
  serveurSauverSession({
    access_token: d.access_token,
    refresh_token: d.refresh_token || s.refresh_token,
    expire_le: Date.now() + ((d.expires_in || 3600) * 1000),
    email: s.email, id: s.id
  });
  return SERVEUR.session;
}

// ---------- connexion / deconnexion ----------
async function serveurConnexion(email, motDePasse) {
  const d = await serveurAppel('/auth/v1/token?grant_type=password', {
    methode: 'POST', corps: { email: email, password: motDePasse }
  });
  serveurSauverSession({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expire_le: Date.now() + ((d.expires_in || 3600) * 1000),
    email: (d.user && d.user.email) || email,
    id: (d.user && d.user.id) || null
  });
  return SERVEUR.session;
}

// NOTE : le rafraichissement automatique du jeton viendra avec la vraie session
// (etape suivante). Ici on se reconnecte a chaque installation.
async function serveurDeconnexion() {
  try { if (SERVEUR.session) await serveurAppel('/auth/v1/logout', { methode: 'POST' }); } catch (e) {}
  serveurSauverSession(null);
}

// ---------- ma fiche (role, nom, matiere, etablissement) ----------
async function serveurMaFiche() {
  const id = SERVEUR.session && SERVEUR.session.id;
  if (!id) return null;
  const lignes = await serveurAppel('/rest/v1/profils?auth_user_id=eq.' + id + '&select=*');
  return (lignes && lignes.length) ? lignes[0] : null;
}

// ---------- la porte du premier directeur (voir migration 0003) ----------
async function serveurPremierDirecteur(etab) {
  return await serveurAppel('/rest/v1/rpc/premier_directeur', {
    methode: 'POST',
    corps: {
      p_code_etab: etab.code,
      p_nom_etab: etab.nom,
      p_nom: etab.nomDirecteur,
      p_academie: etab.academie || '',
      p_direction: etab.direction || '',
      p_annee: etab.annee || '2026-2027',
      p_semestres: etab.semestres || []
    }
  });
}

// ========== LE DEMENAGEMENT DES DONNEES (etablissement, classes, eleves) ==========
// REGLE DE MODE : l'application ne parle au serveur QUE si l'on est connecte avec un
// compte du serveur. Avec un compte de demonstration, tout reste local — c'est ce qui
// permet aux 40 suites de tourner hors ligne, sans rien changer a leur comportement.
function serveurActif() {
  return !!(utilisateurConnecte && utilisateurConnecte.serveur === true && SERVEUR.session);
}

// L'application est-elle RELIEE a un espace serveur ? Ce drapeau survit a la
// deconnexion (la session, elle, est effacee). Une fois relie, l'app ne doit PLUS
// accepter les comptes de demonstration : ils feraient croire que tout marche
// alors que rien ne part sur le serveur (defaut reellement signale).
function espaceServeurLie() { return !!Depot.lireJSON('espaceServeur', null); }

function marquerEspaceServeur(fiche) {
  if (!fiche) return;
  Depot.ecrireJSON('espaceServeur', {
    fiche: fiche.id || null,
    etablissementId: fiche.etablissement_id || etablissementServeurId || null,
    le: new Date().toISOString()
  });
}

// D'ou viennent les donnees affichees ? L'ecran doit le DIRE, sinon on ne peut
// pas savoir si l'on regarde le telephone ou le serveur.
function afficherSourceDonnees() {
  const el = document.getElementById('dir-source');
  if (!el) return;
  if (!espaceServeurLie()) { el.style.display = 'none'; return; }
  const h = new Date();
  const heure = ('0' + h.getHours()).slice(-2) + ':' + ('0' + h.getMinutes()).slice(-2);
  el.style.display = '';
  if (serveurActif()) {
    el.innerHTML = '<i class="fas fa-cloud"></i> Donnees du serveur — lues a ' + heure;
  } else {
    el.innerHTML = '<i class="fas fa-mobile-alt"></i> Donnees du telephone — serveur non joint';
  }
}

// La lecture du serveur range ses donnees en passant par les memes fonctions
// d'enregistrement que l'utilisateur. Sans ce drapeau, chacun de ces
// enregistrements declencherait un nouvel envoi : la boucle ne s'arreterait plus.
let serveurLectureEnCours = false;

// Le telephone a-t-il des saisies que le serveur ignore encore ? On le note, puis
// la lecture les REMONTE (une seule fois, a la fin).
let serveurARemonter = false;

// Envoi « au fil de l'eau » : chaque changement fait dans l'app part aussitot.
// Un seul envoi a la fois ; si un changement arrive pendant l'envoi, on refait
// un tour a la fin. Sans cela, une modification restait sur le telephone et
// disparaissait a la prochaine lecture du serveur (defaut reellement signale).
let serveurEnvoiEnCours = false, serveurEnvoiARefaire = false, serveurEnvoiMinuteur = null;

// Ce qui a CHANGE depuis le dernier envoi. Envoyer les sept familles a chaque
// modification etait trop lourd (une vingtaine d'allers-retours vers le serveur) :
// sur le reseau mobile, une suppression mettait une minute a partir — l'utilisateur
// croyait que « la suppression ne marchait pas » (defaut reellement signale).
const serveurAEnvoyer = {};

function serveurMarquer(quoi) {
  // Pendant le CHARGEMENT, les listes se reecrivent avant que ce module soit pret :
  // ce n'est pas une erreur, il n'y a simplement rien a envoyer.
  try {
    serveurAEnvoyer[quoi] = true;
    serveurEnvoiArrierePlan();
  } catch (e) { return; }
}

// Une rafale de modifications (creer une fermeture, puis une annulation, puis un
// cours...) ne doit PAS declencher une rafale d'envois : on attend un court instant
// de calme, puis on envoie UNE fois. Sur le reseau mobile, c'est la difference
// entre une application fluide et une application qui « rame ».
function serveurEnvoiArrierePlan(delai) {
  // Pendant le CHARGEMENT de la page, les listes se reecrivent avant que ce module
  // soit pret : ce n'est pas une erreur, il n'y a simplement rien a envoyer.
  try {
    if (serveurEnvoiMinuteur) clearTimeout(serveurEnvoiMinuteur);
    serveurEnvoiMinuteur = setTimeout(function () {
      serveurEnvoiMinuteur = null;
      serveurEnvoiMaintenant();
    }, delai === undefined ? 1200 : delai);
  } catch (e) { return; }
}

function serveurEnvoiMaintenant() {
  // Etat propre au depart : si une lecture a echoue en route (reseau coupe, jeton
  // perime), son drapeau pouvait rester leve et BLOQUER tous les envois suivants
  // (defaut reellement constate : plus rien ne partait, sans le moindre message).
  serveurLectureEnCours = false;
  // Pendant le CHARGEMENT de la page, les listes se reecrivent avant que la
  // session et l'utilisateur existent : ce n'est pas une erreur, il n'y a
  // simplement rien a envoyer.
  let actif = false, role = '';
  try { actif = serveurActif(); role = (utilisateurConnecte && utilisateurConnecte.role) || ''; }
  catch (e) { return; }
  if (!actif) return;
  // Le directeur envoie TOUT. Le professeur et le surveillant n'envoient que leurs
  // ABSENCES : sans cela, une absence cochee par un professeur ne partait jamais et
  // n'apparaissait donc jamais chez le surveillant ni chez le directeur (defaut
  // reellement signale).
  const peutEnvoyer = (role === 'directeur');
  if (serveurLectureEnCours) return;            // simple rangement, pas un changement
  if (serveurEnvoiEnCours) { serveurEnvoiARefaire = true; return; }
  serveurEnvoiEnCours = true;
  // Chaque famille de donnees part INDEPENDAMMENT. C'est capital : avant, la
  // moindre erreur sur une fiche arretait toute la chaine, et les fermetures,
  // annulations et absences du personnel n'arrivaient JAMAIS sur le serveur
  // (defaut reellement constate sur le vrai serveur).
  const toutes = [
    ['listes', 'les listes (classes, eleves)', serveurEnvoyerDonnees],
    ['personnes', 'les personnes', serveurEnvoyerFiches],
    ['cours', 'les cours', serveurEnvoyerSeances],
    ['fermetures', 'les fermetures', serveurEnvoyerFermetures],
    ['absencesPerso', 'les absences du personnel', serveurEnvoyerAbsencesPersonnel],
    ['annulations', 'les annulations de seance', serveurEnvoyerAnnulations],
    ['signalements', 'les absences', serveurEnvoyerSignalements]
  ];
  // On n'envoie QUE ce qui a change, et on retire la marque AVANT d'envoyer : si
  // une nouvelle modification arrive pendant l'envoi, elle sera re-marquee.
  const aFaire = toutes.filter(function (x) {
    if (!serveurAEnvoyer[x[0]]) return false;
    if (peutEnvoyer) return true;
    return x[0] === 'signalements';             // un professeur : ses absences, rien d'autre
  });
  aFaire.forEach(function (x) { delete serveurAEnvoyer[x[0]]; });
  // Rien a envoyer ET rien a relire : on ne fait AUCUN aller-retour.
  if (!aFaire.length) { serveurEnvoiEnCours = false;
    if (serveurEnvoiARefaire) { serveurEnvoiARefaire = false; serveurEnvoiArrierePlan(0); }
    return; }
  const soucis = [];
  (async function () {
    for (let i = 0; i < aFaire.length; i++) {
      try { await aFaire[i][2](); }
      catch (e) { soucis.push(aFaire[i][1] + ' : ' + (e.message || e)); }
    }
    // PAS de relecture complete : les donnees du telephone sont la verite, le
    // serveur les copie. Relire tout a chaque fois rendait chaque geste lent.
    serveurRafraichirEcrans();
    if (soucis.length) {
      afficherToast('Garde sur le telephone (pas encore sur le serveur) — ' + soucis.join(' | '), 'warning');
    }
  })().then(function () {
    serveurEnvoiEnCours = false;
    if (serveurEnvoiARefaire) { serveurEnvoiARefaire = false; serveurEnvoiArrierePlan(0); }
  });
}

function etabLocal() {
  try { return (typeof etablissement === 'object' && etablissement) ? etablissement : {}; }
  catch (e) { return {}; }
}

function anneeLocale() {
  try { return (typeof anneeScolaire === 'object' && anneeScolaire && anneeScolaire.libelle) ? anneeScolaire.libelle : ''; }
  catch (e) { return ''; }
}

// Ce que le serveur contient deja pour mon etablissement.
async function serveurCompterDonnees() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) return { classes: 0, eleves: 0, profils: 0, signalements: 0, seances: 0 };
  const cs = (await serveurAppel('/rest/v1/classes?etablissement_id=eq.' + idEtab + '&select=id')) || [];
  let eleves = 0;
  if (cs.length) {
    const ids = cs.map(c => c.id).join(',');
    const es = (await serveurAppel('/rest/v1/eleves?classe_id=in.(' + ids + ')&select=id')) || [];
    eleves = es.length;
  }
  // On compte les personnes SANS le directeur : c'est ce que le telephone compte aussi
  // (sinon les deux nombres ne veulent pas dire la meme chose — l'utilisateur a pose la question).
  const ps = (await serveurAppel('/rest/v1/profils?etablissement_id=eq.' + idEtab +
                                 '&role=neq.directeur&actif=is.true&select=id')) || [];
  const ss = (await serveurAppel('/rest/v1/signalements?etablissement_id=eq.' + idEtab + '&select=id')) || [];
  const ses = (await serveurAppel('/rest/v1/seances?etablissement_id=eq.' + idEtab + '&select=id')) || [];
  return { classes: cs.length, eleves: eleves, profils: ps.length, signalements: ss.length,
           seances: ses.length };
}

// Envoie (ou remet a jour) les listes du telephone vers le serveur.
// IDEMPOTENT : classes retrouvees par leur nom, eleves par leur code MASSAR — un second
// envoi n'ajoute donc aucun doublon, il corrige juste ce qui a change.
async function serveurEnvoyerDonnees() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  const rapport = { classes: 0, eleves: 0, maj: 0, etabMaj: false };

  // 1) l'etablissement : on complete ce que le telephone sait et que le serveur ignore
  const et = etabLocal();
  const aEnvoyer = {};
  if (et.academie) aEnvoyer.academie = et.academie;
  if (et.direction) aEnvoyer.direction = et.direction;
  if (anneeLocale()) aEnvoyer.annee_libelle = anneeLocale();
  if (Object.keys(aEnvoyer).length) {
    await serveurAppel('/rest/v1/etablissements?id=eq.' + idEtab, { methode: 'PATCH', corps: aEnvoyer });
    rapport.etabMaj = true;
  }

  // 2) les classes (retrouvees par nom) puis les eleves (par code MASSAR)
  const cServ = (await serveurAppel('/rest/v1/classes?etablissement_id=eq.' + idEtab + '&select=id,nom')) || [];
  const classeParNom = {};
  cServ.forEach(function (c) { classeParNom[c.nom] = c.id; });

  for (let i = 0; i < classes.length; i++) {
    const cl = classes[i];
    let idClasse = classeParNom[cl.nom];
    if (!idClasse) {
      const cree = await serveurAppel('/rest/v1/classes', {
        methode: 'POST', entetes: { 'Prefer': 'return=representation' },
        corps: { etablissement_id: idEtab, nom: cl.nom }
      });
      idClasse = cree && cree[0] ? cree[0].id : null;
      if (idClasse) { classeParNom[cl.nom] = idClasse; rapport.classes++; }
    }
    if (!idClasse) continue;

    const eServ = (await serveurAppel('/rest/v1/eleves?classe_id=eq.' + idClasse +
                                      '&select=id,code_massar,nom,prenom,actif')) || [];
    const parCode = {}, parNom = {};
    eServ.forEach(function (e) {
      if (e.code_massar) parCode[e.code_massar] = e;
      parNom[cleNomEleve(e)] = e;
    });

    const aAjouter = [];
    for (let j = 0; j < cl.eleves.length; j++) {
      const e = cl.eleves[j];
      const code = e.massar ? String(e.massar) : null;
      const existant = (code && parCode[code]) || (!code && parNom[cleNomEleve(e)]) || null;
      const nom = (e.nom || '') + '';
      const prenom = (e.prenom || '') + '';
      const actif = !estSorti(e);
      if (!existant) {
        aAjouter.push({ classe_id: idClasse, code_massar: code, nom: nom, prenom: prenom, actif: actif });
      } else if (existant.nom !== nom || existant.prenom !== prenom || existant.actif !== actif) {
        await serveurAppel('/rest/v1/eleves?id=eq.' + existant.id, {
          methode: 'PATCH', corps: { nom: nom, prenom: prenom, actif: actif }
        });
        rapport.maj++;
      }
    }
    if (aAjouter.length) {
      const crees = await serveurAppel('/rest/v1/eleves', {
        methode: 'POST', entetes: { 'Prefer': 'return=representation' }, corps: aAjouter
      });
      rapport.eleves += (crees ? crees.length : aAjouter.length);
    }
  }
  return rapport;
}

// ========== LIRE DEPUIS LE SERVEUR (le mode serveur lit le SERVEUR, plus le telephone) ==========
// REGLE DE SECURITE : on ne remplace JAMAIS les donnees locales par une lecture vide ou
// suspecte, et on garde une copie de secours avant tout remplacement.
async function serveurChargerDonnees() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  serveurLectureEnCours = true;
  const etabs = await serveurAppel('/rest/v1/etablissements?id=eq.' + idEtab + '&select=*');
  const et = (etabs && etabs[0]) || null;
  const cServ = (await serveurAppel('/rest/v1/classes?etablissement_id=eq.' + idEtab + '&select=id,nom&order=nom')) || [];
  if (!cServ.length && classes.length) {
    serveurLectureEnCours = false;
    throw new Error('lecture vide : on garde les donnees du telephone (rien\'a ete remplace)');
  }
  const eServ = (await serveurAppel('/rest/v1/eleves?select=id,classe_id,code_massar,nom,prenom,actif')) || [];
  const pServ = (await serveurAppel('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&select=id,nom,code,role,matiere,email')) || [];
  const sServ = (await serveurAppel('/rest/v1/signalements?etablissement_id=eq.' + idEtab +
        '&select=id,eleve_id,classe_id,prof_id,date_abs,moment,heure,type,retard_minutes,statut,motif,decide_par,decide_le&order=date_abs')) || [];
  const seServ = (await serveurAppel('/rest/v1/seances?etablissement_id=eq.' + idEtab +
        '&select=id,prof_id,classe_id,jour,debut,fin,salle,matiere')) || [];
  const feServ = (await serveurAppel('/rest/v1/fermetures?etablissement_id=eq.' + idEtab +
        '&select=id,type,libelle,debut,fin,portee,cree_par,cree_le')) || [];
  const apServ = (await serveurAppel('/rest/v1/absences_personnel?etablissement_id=eq.' + idEtab +
        '&select=id,prof_id,role_absent,debut,fin,portee,motif,cree_par')) || [];
  const anServ = (await serveurAppel('/rest/v1/annulations_seances?etablissement_id=eq.' + idEtab +
        '&select=id,date_seance,classe_id,debut,fin,motif,cree_par')) || [];

  // Les noms viennent du SERVEUR : on met a jour la liste locale des noms, sinon
  // l'ecran continuerait d'afficher un ancien nom (ou un renommage « reviendrait »).
  // MAIS PAS si un envoi est en attente : sinon la lecture ecraserait un renommage
  // que l'utilisateur vient de faire, juste avant qu'il ne parte (course constatee).
  try {
    if (!serveurEnvoiMinuteur && !serveurEnvoiEnCours && !serveurEnvoiARefaire) {
      pServ.forEach(function (p) { if (p.code && p.nom) nomsProfs[p.code] = p.nom; });
      sauvegarderNomsProfs();        // sans envoi : la lecture est en cours (garde-fou)
    }
  } catch (e) {}

  const profParId = {}, classeParId = {}, eleveParId = {};
  pServ.forEach(function (p) { profParId[p.id] = p; });
  cServ.forEach(function (c) { classeParId[c.id] = c; });
  eServ.forEach(function (e) { eleveParId[e.id] = e; });

  const nouvelles = cServ.map(function (c) { return { id: c.id, nom: c.nom, eleves: [] }; });
  const parClasse = {};
  nouvelles.forEach(function (c) { parClasse[c.id] = c; });
  eServ.forEach(function (e) {
    const cl = parClasse[e.classe_id];
    if (!cl) return;
    cl.eleves.push({ id: e.id, massar: e.code_massar || '', nom: e.nom || '',
                     prenom: e.prenom || '', actif: e.actif !== false });
  });
  const nouvellesAbsences = sServ.map(function (s) {
    const cl = classeParId[s.classe_id] || {};
    const pr = profParId[s.prof_id] || {};
    const el = eleveParId[s.eleve_id] || {};
    return {
      id: s.id, eleveId: s.eleve_id,
      nom: ((el.nom || '') + ' ' + (el.prenom || '')).trim(),
      classe: cl.nom || '', dateISO: s.date_abs, date: dateAffichage(s.date_abs),
      heure: String(s.heure || '').slice(0, 5), seance: s.moment, type: s.type,
      duree: s.retard_minutes ? String(s.retard_minutes) : '', statut: s.statut,
      enseignant: pr.nom || '', matiere: pr.matiere || '', motif: s.motif || '',
      justifiePar: (s.decide_par && profParId[s.decide_par]) ? profParId[s.decide_par].nom : '',
      justifieLe: s.decide_le ? String(s.decide_le).slice(0, 16).replace('T', ' ') : ''
    };
  });

  // les tableaux de service : reconstruits par professeur (cle = email, sinon nom, sinon matiere)
  const tableau = {};
  seServ.forEach(function (s) {
    const pr = profParId[s.prof_id] || {};
    const cl = classeParId[s.classe_id] || {};
    const cle = pr.email || pr.nom || ('matiere:' + (s.matiere || ''));
    if (!tableau[cle]) tableau[cle] = [];
    tableau[cle].push({ jour: s.jour, debut: String(s.debut || '').slice(0, 5),
                        fin: String(s.fin || '').slice(0, 5), classe: cl.nom || '',
                        matiere: s.matiere || pr.matiere || '', prof: pr.nom || '',
                        salle: s.salle || '' });
  });

  // copie de secours AVANT de remplacer (au cas ou), puis remplacement
  Depot.ecrireJSON('classesAvantServeur', classes);
  Depot.ecrireJSON('tableauxServiceAvantServeur', tableauxService);
  Depot.ecrireJSON('absencesAvantServeur', absences);
  classes = nouvelles;
  absences = nouvellesAbsences;
  if (Object.keys(tableau).length) {          // jamais d'ecrasement par une lecture vide
    tableauxService = tableau;
    sauvegarderTableauxService();
  }
  // les fermetures : petites, on les remplace (une liste vide est une verite possible ici)
  const nouvellesFermetures = feServ.map(function (f) {
    const pr = profParId[f.cree_par] || {};
    return { id: f.id, type: f.type, libelle: f.libelle || '', debut: f.debut, fin: f.fin,
             portee: f.portee || 'journee', par: pr.nom || '',
             le: f.cree_le ? String(f.cree_le).slice(0, 10) : '' };
  });
  // GARDE-FOU (meme esprit que celui des classes) : si le serveur ne connait AUCUNE
  // fermeture alors que le telephone en avait, on garde celles du telephone et on les
  // remontera. Sans cela, une saisie faite avant la liaison au serveur disparaissait
  // sans bruit a la premiere lecture (defaut reellement signale).
  Depot.ecrireJSON('fermeturesEtabAvantServeur', fermeturesEtab);
  if (!nouvellesFermetures.length && fermeturesEtab && fermeturesEtab.length) {
    serveurARemonter = true;
  } else {
    fermeturesEtab = nouvellesFermetures;
    sauvegarderFermetures();
  }

  // les absences du personnel : on retrouve la personne par son code (le champ local est profCode)
  const codeParProfId = {};
  pServ.forEach(function (p) { if (p.code) codeParProfId[p.id] = p.code; });
  const nouvellesIndispos = apServ.map(function (a) {
    const pr = profParId[a.prof_id] || {};
    return { id: a.id, profCode: codeParProfId[a.prof_id] || pr.email || pr.nom || '',
             role: a.role_absent || 'enseignant', debut: a.debut, fin: a.fin,
             portee: a.portee || 'journee', motif: a.motif || '',
             par: (profParId[a.cree_par] || {}).nom || '',
             le: a.cree_le ? String(a.cree_le).slice(0, 10) : '' };
  });
  Depot.ecrireJSON('indispoProfsAvantServeur', indispoProfs);
  if (!nouvellesIndispos.length && indispoProfs && indispoProfs.length) {
    serveurARemonter = true;                    // meme garde-fou
  } else {
    indispoProfs = nouvellesIndispos;
    sauvegarderIndispo();
  }

  // les annulations de seance
  const nouvellesAnnulations = anServ.map(function (a) {
    const cl = classeParId[a.classe_id] || {};
    return { id: a.id, dateISO: a.date_seance, classe: cl.nom || '',
             debut: String(a.debut || '').slice(0, 5), fin: String(a.fin || '').slice(0, 5),
             motif: a.motif || '', par: (profParId[a.cree_par] || {}).nom || '',
             le: (a.cree_le ? String(a.cree_le).slice(0, 10) : '') + ' ' +
                 String(a.cree_le ? a.cree_le.slice(11, 16) : '') };
  });
  Depot.ecrireJSON('seancesAnnuleesAvantServeur', seancesAnnulees);
  if (!nouvellesAnnulations.length && seancesAnnulees && seancesAnnulees.length) {
    serveurARemonter = true;                    // meme garde-fou
  } else {
    seancesAnnulees = nouvellesAnnulations;
    sauvegarderSeancesAnnulees();
  }
  sauvegarderClasses();
  Depot.ecrireJSON('absences', absences);

  if (et && typeof etablissement === 'object') {
    etablissement.code = et.code || etablissement.code || '';
    etablissement.nom = et.nom || etablissement.nom || '';
    etablissement.academie = et.academie || etablissement.academie || '';
    etablissement.direction = et.direction || etablissement.direction || '';
    Depot.ecrireJSON('etablissement', etablissement);
  }
  if (et && et.annee_libelle && typeof anneeScolaire === 'object') {
    anneeScolaire.libelle = et.annee_libelle;
    if (Array.isArray(et.semestres) && et.semestres.length) anneeScolaire.semestres = et.semestres;
    Depot.ecrireJSON('anneeScolaire', anneeScolaire);
  }
  serveurLectureEnCours = false;

  // Le telephone avait des saisies que le serveur ignore : on les remonte
  // maintenant (une seule fois, a la fin de la lecture).
  if (serveurARemonter) { serveurARemonter = false; serveurEnvoiArrierePlan(); }

  return { classes: nouvelles.length, eleves: eServ.length, absences: nouvellesAbsences.length,
           seances: seServ.length, fermetures: nouvellesFermetures.length,
           indispos: nouvellesIndispos.length, annulations: nouvellesAnnulations.length };
}

// Apres une lecture, on redessine les ecrans qui existent pour le role connecte.
function serveurRafraichirEcrans() {
  const appels = ['mettreAJourDashboardDir', 'mettreAJourDashboardSurv', 'afficherSeancesAnnulees',
                  'afficherListeEleves', 'remplirListeClasses', 'afficherAbsencesPersonnel',
                  'afficherSourceDonnees', 'majBlocRecuperation'];
  for (let i = 0; i < appels.length; i++) {
    try { if (typeof window[appels[i]] === 'function') window[appels[i]](); } catch (e) {}
  }
}

// Toute ecriture d'absence faite dans l'app est immediatement reportee sur le serveur :
// on reutilise l'envoi REJOUABLE deja teste (aucun doublon au second passage).
function serveurApresEcritureAbsences() {
  if (!serveurActif()) return;
  serveurMarquer('signalements');            // meme mecanisme groupe que le reste
}

// ========== SAUVEGARDE ET RECUPERATION DES SAISIES DU TELEPHONE ==========
// Avant de remplacer une liste par celle du serveur, l'application garde une copie
// de secours. Ces deux boutons permettent de la consulter et de remettre les
// saisies : sans cela, une saisie faite avant la liaison au serveur disparaissait
// sans bruit (defaut reellement signale).
const SAUVEGARDES_SAISIES = [
  { cle: 'fermeturesEtabAvantServeur',  liste: 'fermetures',  nom: 'fermeture(s) d\'établissement' },
  { cle: 'indispoProfsAvantServeur',    liste: 'indispos',    nom: 'absence(s) d\'enseignant' },
  { cle: 'seancesAnnuleesAvantServeur', liste: 'annulations', nom: 'annulation(s) de séance' }
];

function saisiesRetrouvees() {
  const trouvees = [];
  SAUVEGARDES_SAISIES.forEach(function (d) {
    let l = null;
    try { l = Depot.lireJSON(d.cle, null); } catch (e) { l = null; }
    if (Array.isArray(l) && l.length) trouvees.push({ liste: d.liste, nom: d.nom, nombre: l.length, contenu: l });
  });
  return trouvees;
}

function majBlocRecuperation() {
  const bloc = document.getElementById('inst-recuperation');
  const etat = document.getElementById('inst-recuperation-etat');
  const btn = document.getElementById('inst-btn-recuperer');
  if (!bloc || !etat || !btn) return;
  bloc.style.display = '';
  const t = saisiesRetrouvees();
  if (!t.length) {
    etat.textContent = 'Rien à récupérer : la copie de secours ne contient plus de saisie.';
    btn.style.display = 'none';
    return;
  }
  etat.textContent = 'Retrouvé sur ce téléphone : ' +
    t.map(function (x) { return x.nombre + ' ' + x.nom; }).join(' · ');
  btn.style.display = '';
}

function installationRecuperer() {
  const t = saisiesRetrouvees();
  if (!t.length) { afficherToast('Rien à récupérer', 'warning'); return; }
  t.forEach(function (x) {
    if (x.liste === 'fermetures' && typeof fermeturesEtab !== 'undefined') {
      fermeturesEtab = x.contenu; Depot.ecrireJSON('fermeturesEtab', fermeturesEtab);
    }
    if (x.liste === 'indispos' && typeof indispoProfs !== 'undefined') {
      indispoProfs = x.contenu; Depot.ecrireJSON('indispoProfs', indispoProfs);
    }
    if (x.liste === 'annulations' && typeof seancesAnnulees !== 'undefined') {
      seancesAnnulees = x.contenu; Depot.ecrireJSON('seancesAnnulees', seancesAnnulees);
    }
  });
  afficherToast('Saisies remises : envoi au serveur...', 'modif');
  serveurEnvoiArrierePlan();
  setTimeout(function () { majBlocRecuperation(); serveurRafraichirEcrans(); }, 1500);
}

function telechargerTexte(texte, nom) {
  const blob = new Blob([texte], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url; lien.download = nom;
  document.body.appendChild(lien); lien.click(); document.body.removeChild(lien);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function installationSauvegarde() {
  const contenu = Depot.tout(['sessionServeur']);   // jetons de connexion : jamais copies
  const quand = new Date();
  telechargerTexte(JSON.stringify({
    application: 'AbsenceTrack', quand: quand.toISOString(),
    source: serveurActif() ? 'serveur' : 'telephone', contenu: contenu
  }, null, 1), 'sauvegarde-absencetrack-' + quand.toISOString().slice(0, 10) + '.json');
  afficherToast('Sauvegarde préparée : regarde dans Téléchargements', 'modif');
}

// ---- LES ABSENCES DU PERSONNEL (indisponibilites d'un professeur ou d'un surveillant) ----
async function serveurEnvoyerAbsencesPersonnel() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  const rapport = { absences: 0, ignores: 0, raisons: [] };
  const moi = serveurIdFiche();
  const pServ = (await serveurAppel('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&select=id,code,nom,email')) || [];
  const parCode = {}, parNom = {}, parMail = {};
  pServ.forEach(function (p) {
    if (p.code) parCode[p.code] = p;
    parNom[p.nom] = p;
    if (p.email) parMail[String(p.email).toLowerCase()] = p;
  });
  await serveurAppel('/rest/v1/absences_personnel?etablissement_id=eq.' + idEtab, { methode: 'DELETE' });
  const lignes = [];
  for (let i = 0; i < indispoProfs.length; i++) {
    const a = indispoProfs[i];
    const prof = parCode[a.profCode] || parMail[String(a.profCode || '').toLowerCase()] || parNom[a.profCode] || null;
    if (!prof) { rapport.ignores++; rapport.raisons.push('personne non reconnue : ' + a.profCode); continue; }
    if (!a.debut || !a.fin || String(a.fin) < String(a.debut)) {
      rapport.ignores++; rapport.raisons.push('periode invalide pour ' + a.profCode); continue;
    }
    lignes.push({ etablissement_id: idEtab, prof_id: prof.id,
                  role_absent: a.role === 'surveillant' ? 'surveillant' : 'enseignant',
                  debut: a.debut, fin: a.fin,
                  portee: (a.portee === 'matin' || a.portee === 'apres-midi') ? a.portee : 'journee',
                  motif: a.motif || null, cree_par: moi });
  }
  if (lignes.length) {
    const crees = await serveurAppel('/rest/v1/absences_personnel', {
      methode: 'POST', entetes: { 'Prefer': 'return=representation' }, corps: lignes
    });
    rapport.absences = crees ? crees.length : lignes.length;
  }
  return rapport;
}

// ---- LES ANNULATIONS DE SEANCE (une seance precise, saisie a la main) ----
async function serveurEnvoyerAnnulations() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  const rapport = { annulations: 0, ignores: 0, raisons: [] };
  const moi = serveurIdFiche();
  const cServ = (await serveurAppel('/rest/v1/classes?etablissement_id=eq.' + idEtab + '&select=id,nom')) || [];
  const classeParNom = {};
  cServ.forEach(function (c) { classeParNom[c.nom] = c.id; });
  await serveurAppel('/rest/v1/annulations_seances?etablissement_id=eq.' + idEtab, { methode: 'DELETE' });
  const lignes = [], dejaVues = {};
  for (let i = 0; i < seancesAnnulees.length; i++) {
    const a = seancesAnnulees[i];
    const idClasse = classeParNom[a.classe];
    if (!idClasse) { rapport.ignores++; rapport.raisons.push('classe inconnue : ' + a.classe); continue; }
    if (!a.dateISO || !a.debut) { rapport.ignores++; rapport.raisons.push('seance incomplete (date ou heure)'); continue; }
    const cle = idClasse + '|' + a.dateISO + '|' + a.debut;
    if (dejaVues[cle]) { rapport.ignores++; rapport.raisons.push('deja annulee : ' + a.classe + ' ' + a.dateISO + ' ' + a.debut); continue; }
    dejaVues[cle] = 1;
    lignes.push({ etablissement_id: idEtab, date_seance: a.dateISO, classe_id: idClasse,
                  debut: a.debut + ':00', fin: a.fin ? (a.fin + ':00') : null,
                  motif: a.motif || null, cree_par: moi });
  }
  if (lignes.length) {
    const crees = await serveurAppel('/rest/v1/annulations_seances', {
      methode: 'POST', entetes: { 'Prefer': 'return=representation' }, corps: lignes
    });
    rapport.annulations = crees ? crees.length : lignes.length;
  }
  return rapport;
}

// ---- LES FERMETURES (vacances, fetes, examens...) ----
// Ces tables sont PETITES : on remplace la liste entiere (la liste locale est la verite), ce qui
// rend l'envoi rejouable. Une lecture VIDE est ici une verite possible (aucune fermeture), donc
// on remplace meme par une liste vide — contrairement aux classes/eleves, ou une lecture vide est
// forcement suspecte et ne doit rien ecraser.
async function serveurEnvoyerFermetures() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  const rapport = { fermetures: 0, ignores: 0, raisons: [] };
  const moi = serveurIdFiche();
  await serveurAppel('/rest/v1/fermetures?etablissement_id=eq.' + idEtab, { methode: 'DELETE' });
  const lignes = [];
  for (let i = 0; i < fermeturesEtab.length; i++) {
    const f = fermeturesEtab[i];
    const p = (f.portee === 'matin' || f.portee === 'apres-midi') ? f.portee : 'journee';
    if (!f.debut || !f.fin || String(f.fin) < String(f.debut)) {
      rapport.ignores++;
      rapport.raisons.push('fermeture invalide : ' + (f.libelle || f.type || '?') + ' (' + f.debut + ' → ' + f.fin + ')');
      continue;
    }
    lignes.push({ etablissement_id: idEtab, type: f.type || 'Autre', libelle: f.libelle || null,
                  debut: f.debut, fin: f.fin, portee: p, cree_par: moi });
  }
  if (lignes.length) {
    const crees = await serveurAppel('/rest/v1/fermetures', {
      methode: 'POST', entetes: { 'Prefer': 'return=representation' }, corps: lignes
    });
    rapport.fermetures = crees ? crees.length : lignes.length;
  }
  return rapport;
}

// ---- LES TABLEAUX DE SERVICE (les seances) : le prealable aux comptes des professeurs ----
// Un enseignant qui se connecte doit voir SES cours : ils doivent donc etre sur le serveur.
// On REMPLACE le tableau d'un professeur (comme le fait l'import local) : rejouable, sans doublon.
async function serveurEnvoyerSeances() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  const rapport = { seances: 0, profs: 0, ignores: 0, raisons: [] };
  const cServ = (await serveurAppel('/rest/v1/classes?etablissement_id=eq.' + idEtab + '&select=id,nom')) || [];
  const classeParNom = {};
  cServ.forEach(function (c) { classeParNom[c.nom] = c.id; });
  const pServ = (await serveurAppel('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&select=id,nom,code,matiere,email')) || [];
  const profParEmail = {}, profParNom = {}, profsParMatiere = {};
  pServ.forEach(function (p) {
    if (p.email) profParEmail[String(p.email).toLowerCase()] = p;
    profParNom[p.nom] = p;
    const m = normaliserMatiere(p.matiere);
    if (m) { if (!profsParMatiere[m]) profsParMatiere[m] = []; profsParMatiere[m].push(p); }
  });

  for (const cle in tableauxService) {
    const liste = tableauxService[cle] || [];
    if (!liste.length) continue;
    let prof = profParEmail[String(cle).toLowerCase()] || profParNom[cle] || null;
    if (!prof) {
      const cands = profsParMatiere[normaliserMatiere(cle.replace(/^matiere:/, '') || liste[0].matiere)] || [];
      if (cands.length === 1) prof = cands[0];       // une seule fiche pour cette matiere : aucun doute
    }
    if (!prof) {
      rapport.ignores++;
      rapport.raisons.push('professeur non reconnu pour un tableau : ' + cle);
      continue;
    }
    await serveurAppel('/rest/v1/seances?prof_id=eq.' + prof.id, { methode: 'DELETE' });
    const lignes = [];
    for (let i = 0; i < liste.length; i++) {
      const s = liste[i];
      const idClasse = classeParNom[s.classe];
      if (!idClasse) { rapport.ignores++; rapport.raisons.push('classe inconnue : ' + s.classe); continue; }
      if (!(s.jour >= 1 && s.jour <= 6)) { rapport.ignores++; rapport.raisons.push('jour invalide : ' + s.jour); continue; }
      if (hhmmEnMinutes(s.fin) <= hhmmEnMinutes(s.debut)) {
        rapport.ignores++; rapport.raisons.push('horaire invalide : ' + s.classe + ' ' + s.debut + '-' + s.fin);
        continue;
      }
      lignes.push({ etablissement_id: idEtab, prof_id: prof.id, classe_id: idClasse,
                    jour: s.jour, debut: s.debut + ':00', fin: s.fin + ':00',
                    salle: s.salle || null, matiere: s.matiere || prof.matiere || null });
    }
    if (lignes.length) {
      const crees = await serveurAppel('/rest/v1/seances', {
        methode: 'POST', entetes: { 'Prefer': 'return=representation' }, corps: lignes
      });
      rapport.seances += (crees ? crees.length : lignes.length);
      rapport.profs++;
    }
  }
  return rapport;
}

// ---- les personnes (fiches sans compte) : prealable obligatoire aux absences, car
//      chaque signalement est rattache a la fiche du professeur concerne ----
function personnesAEtager() {
  const liste = [];
  for (let i = 0; i < comptes.length; i++) {
    const c = comptes[i];
    if (c.role === 'directeur') continue;            // sa fiche existe deja
    // Le nom AFFICHE (celui qu'on a pu corriger dans l'application) fait foi :
    // sans cette ligne, un renommage restait sur le telephone et la prochaine
    // lecture ramenait l'ancien nom (defaut reellement signale).
    let nomAffiche = c.nom;
    try { if (c.code && nomsProfs[c.code]) nomAffiche = nomsProfs[c.code]; } catch (e) {}
    liste.push({
      code: c.code || null,
      nom: nomAffiche,
      role: c.role,
      matiere: c.role === 'enseignant' ? (c.matiere || null) : null,
      email: c.email || null
    });
  }
  // les professeurs des tableaux de service qui n'ont pas encore de compte
  let tableaux = {};
  try { tableaux = (typeof tableauxService === 'object' && tableauxService) ? tableauxService : {}; } catch (e) { tableaux = {}; }
  for (const cle in tableaux) {
    const seances = tableaux[cle] || [];
    if (!seances.length) continue;
    // Une cle qui est une adresse designe une personne connue par son e-mail : on
    // la garde (le serveur la reconnait par son adresse), et on applique le nom
    // affiche — sinon un renommage de cette personne ne partait jamais.
    const estMail = /@/.test(cle);
    const code = estMail ? cle.split('@')[0] : null;
    liste.push({
      code: code,
      nom: (code && nomsProfs[code]) || seances[0].prof || cle.replace(/^matiere:/, ''),
      role: 'enseignant',
      matiere: seances[0].matiere || cle.replace(/^matiere:/, ''),
      email: estMail ? cle : null
    });
  }
  const vus = {}, uniques = [];
  for (let i = 0; i < liste.length; i++) {
    const cle = liste[i].code || ('nom:' + liste[i].nom);
    if (vus[cle]) continue;
    vus[cle] = 1;
    uniques.push(liste[i]);
  }
  return uniques;
}

async function serveurEnvoyerFiches() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  const rapport = { fiches: 0, maj: 0 };
  const fServ = (await serveurAppel('/rest/v1/profils?etablissement_id=eq.' + idEtab +
                                    '&select=id,code,nom,matiere,role,email,actif')) || [];
  const parCode = {}, parNom = {}, parMail = {};
  fServ.forEach(function (f) {
    if (f.code) parCode[f.code] = f;
    if (f.nom) parNom[f.nom] = f;
    if (f.email) parMail[String(f.email).toLowerCase()] = f;
  });
  const liste = personnesAEtager();
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    // L'adresse fait partie de l'identite d'une fiche : sans elle, on tentait de
    // RECREER une fiche dont l'adresse existait deja, la base refusait, et l'envoi
    // s'arretait la (defaut reellement constate sur le vrai serveur).
    const existante = (p.code && parCode[p.code]) ||
                      (p.email && parMail[String(p.email).toLowerCase()]) ||
                      parNom[p.nom] || null;
    try {
      if (!existante) {
        const cree = await serveurAppel('/rest/v1/profils', {
          methode: 'POST', entetes: { 'Prefer': 'return=representation' },
          corps: { etablissement_id: idEtab, code: p.code, nom: p.nom, role: p.role,
                   matiere: p.matiere, email: p.email }
        });
        if (cree && cree[0]) {
          if (cree[0].code) parCode[cree[0].code] = cree[0];
          parNom[cree[0].nom] = cree[0];
          if (cree[0].email) parMail[String(cree[0].email).toLowerCase()] = cree[0];
          rapport.fiches++;
        }
      } else if (existante.nom !== p.nom) {
        // ATTENTION : la base ne laisse modifier QUE la colonne « nom » sur une fiche
        // (verrou de colonne voulu : impossible de changer role, matiere ou etablissement).
        await serveurAppel('/rest/v1/profils?id=eq.' + existante.id, {
          methode: 'PATCH', corps: { nom: p.nom }
        });
        rapport.maj++;
      }
    } catch (e) {
      // une fiche qui resiste ne doit PAS empecher les autres de partir
      rapport.ignorees = (rapport.ignorees || 0) + 1;
      rapport.raisons = rapport.raisons || [];
      rapport.raisons.push('fiche non envoyee : ' + (p.nom || p.email || '?') + ' (' + (e.message || e) + ')');
    }
  }

  // Les fiches que CETTE application a elle-meme creees : elle seule peut les
  // retirer. Une fiche venue d'ailleurs (autre appareil, import, script) n'est
  // JAMAIS touchee : sinon elle disparaissait des ecrans sans que personne ne
  // comprenne pourquoi (defaut constate a l'essai sur le vrai serveur).
  // Les personnes qui ne sont PLUS dans la liste du telephone sont marquees INACTIVES.
  // On ne les supprime JAMAIS : l'historique de ce qu'elles ont approuve doit rester lisible.
  // Une fiche est « encore la » si l'un de ses identifiants (code, email, nom) est dans la liste —
  // ainsi un simple renommage ne la desactive pas.
  const identifiants = {};
  for (let k = 0; k < liste.length; k++) {
    const q = liste[k];
    if (q.code) identifiants['code:' + q.code] = 1;
    if (q.email) identifiants['mail:' + String(q.email).toLowerCase()] = 1;
    identifiants['nom:' + q.nom] = 1;
  }

  // On ne retire QUE les personnes que l'application connaissait deja (celles de
  // ses propres listes). Une fiche venue d'ailleurs — autre appareil, script,
  // import — n'est JAMAIS touchee : sinon elle disparaissait des ecrans sans que
  // personne ne comprenne pourquoi (defaut constate a l'essai sur le vrai serveur).
  const connues = Depot.lireJSON('fichesConnues', {}) || {};
  for (const kk in identifiants) connues[kk] = 1;
  Depot.ecrireJSON('fichesConnues', connues);
  const etaitConnue = function (f) {
    return (f.code && connues['code:' + f.code]) ||
           (f.email && connues['mail:' + String(f.email).toLowerCase()]) ||
           connues['nom:' + f.nom];
  };
  rapport.desactivees = 0;
  for (let k = 0; k < fServ.length; k++) {
    const f = fServ[k];
    if (f.role === 'directeur') continue;
    if (f.actif === false) continue;                       // deja inactive
    if (!etaitConnue(f)) continue;                         // venue d'ailleurs : intouchable
    const encore = (f.code && identifiants['code:' + f.code]) ||
                   (f.email && identifiants['mail:' + String(f.email).toLowerCase()]) ||
                   identifiants['nom:' + f.nom];
    if (encore) continue;
    await serveurAppel('/rest/v1/profils?id=eq.' + f.id, { methode: 'PATCH', corps: { actif: false } });
    rapport.desactivees++;
  }
  return rapport;
}

function eleveLocalParId(id) {
  for (let i = 0; i < classes.length; i++) {
    for (let j = 0; j < classes[i].eleves.length; j++) {
      if (classes[i].eleves[j].id === id) return { eleve: classes[i].eleves[j], classe: classes[i] };
    }
  }
  return null;
}

// Le retard est enregistre comme « delai sans approbation » (voir la migration 0002) :
// du debut de la seance jusqu'a l'approbation — ou jusqu'a maintenant si elle n'est pas venue.
function minutesDeRetard(a) {
  const debut = new Date(String(a.dateISO) + 'T' + (a.heure || '08:00') + ':00');
  const fin = a.justifieLe ? new Date(String(a.justifieLe).replace(' ', 'T')) : new Date();
  const m = Math.round((fin.getTime() - debut.getTime()) / 60000);
  return m > 0 ? m : 1;
}

// Signalement ORPHELIN : son « eleveId » ne correspond plus a personne (reste de l'ancien bug
// de duplication des listes d'eleves). Le signalement porte le NOM de l'eleve : on le retrouve
// par ce nom, dans la classe indiquee — c'est la meme reparation que celle faite a l'import.
function eleveLocalParNom(nom, nomClasse) {
  const cible = String(nom || '').trim().toLowerCase();
  if (!cible) return null;
  for (let i = 0; i < classes.length; i++) {
    const cl = classes[i];
    if (nomClasse && cl.nom !== nomClasse) continue;
    for (let j = 0; j < cl.eleves.length; j++) {
      const e = cl.eleves[j];
      const libelle = String((typeof libelleEleve === 'function' ? libelleEleve(e) : '') ||
                             ((e.nom || '') + ' ' + (e.prenom || ''))).trim().toLowerCase();
      if (libelle === cible || String(e.nom || '').trim().toLowerCase() === cible) {
        return { eleve: e, classe: cl };
      }
    }
  }
  return null;
}

async function serveurEnvoyerSignalements() {
  const idEtab = serveurIdEtablissement();
  if (!idEtab) throw new Error('aucun etablissement dans ce compte');
  const moi = serveurIdFiche();
  if (!moi) throw new Error('fiche du directeur introuvable');
  const rapport = { ajoutes: 0, maj: 0, ignores: 0, orphelins: 0, raisons: [] };

  const cServ = (await serveurAppel('/rest/v1/classes?etablissement_id=eq.' + idEtab + '&select=id,nom')) || [];
  const classeParNom = {}; cServ.forEach(function (c) { classeParNom[c.nom] = c.id; });
  const eServ = (await serveurAppel('/rest/v1/eleves?select=id,code_massar,nom,prenom,classe_id')) || [];
  const eleveParCode = {}, eleveParNom = {};
  eServ.forEach(function (e) {
    if (e.code_massar) eleveParCode[e.code_massar] = e;
    eleveParNom[String(e.nom || '') + '|' + String(e.prenom || '')] = e;
  });
  const pServ = (await serveurAppel('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&select=id,nom,code')) || [];
  const profParNom = {}, profParCode = {};
  pServ.forEach(function (p) { profParNom[p.nom] = p.id; if (p.code) profParCode[p.code] = p.id; });
  const sServ = (await serveurAppel('/rest/v1/signalements?etablissement_id=eq.' + idEtab +
                                    '&select=id,eleve_id,date_abs,moment')) || [];
  const dejaLa = {};
  sServ.forEach(function (s) { dejaLa[s.eleve_id + '|' + s.date_abs + '|' + s.moment] = s.id; });

  for (let i = 0; i < absences.length; i++) {
    const a = absences[i];
    let local = eleveLocalParId(a.eleveId);
    if (!local) {
      // signalement orphelin : on le rattache par le nom porte par le signalement
      local = eleveLocalParNom(a.nom, a.classe);
      if (local) rapport.orphelins++;
    }
    if (!local) {
      rapport.ignores++;
      rapport.raisons.push('« ' + (a.nom || '?') + ' » · ' + (a.date || a.dateISO || '?') +
                           ' · ' + (a.type === 'retard' ? 'retard' : 'absence') +
                           ' · classe ' + (a.classe || '?') + ' : cet élève n\'est plus dans ta liste');
      continue;
    }
    const nomEleve = String(local.eleve.nom || '') + '|' + String(local.eleve.prenom || '');
    const codeMassar = local.eleve.massar ? String(local.eleve.massar) : null;
    const el = (codeMassar && eleveParCode[codeMassar]) || eleveParNom[nomEleve] || null;
    const idClasse = classeParNom[local.classe.nom];
    if (!el || !idClasse) {
      rapport.ignores++;
      rapport.raisons.push('eleve ou classe absent du serveur : ' + local.classe.nom);
      continue;
    }
    const idProf = profParNom[a.enseignant] || null;
    if (!idProf) {
      rapport.ignores++;
      rapport.raisons.push('professeur inconnu : ' + a.enseignant);
      continue;
    }
    const justifie = a.statut === 'justifie_s' || a.statut === 'justifie_d';
    const decideur = justifie
      ? (profParCode[a.justifiePar] || profParNom[a.justifiePar] || moi)
      : null;
    const valeurs = {
      etablissement_id: idEtab,
      eleve_id: el.id,
      classe_id: idClasse,
      prof_id: idProf,
      date_abs: a.dateISO,
      moment: a.seance === 'apres-midi' ? 'apres-midi' : 'matin',
      heure: (a.heure || '08:00') + ':00',
      type: a.type === 'retard' ? 'retard' : 'absence',
      retard_minutes: a.type === 'retard' ? minutesDeRetard(a) : null,
      statut: justifie ? a.statut : 'absent',
      motif: justifie ? (a.motif || null) : null,
      decide_par: decideur,
      decide_le: justifie ? String(a.justifieLe || '').replace(' ', 'T') || null : null,
      signale_par: moi
    };
    if (!valeurs.decide_le) valeurs.decide_le = null;
    const clef = el.id + '|' + a.dateISO + '|' + valeurs.moment;
    if (dejaLa[clef]) {
      await serveurAppel('/rest/v1/signalements?id=eq.' + dejaLa[clef], {
        methode: 'PATCH',
        corps: { statut: valeurs.statut, motif: valeurs.motif,
                 decide_par: valeurs.decide_par, decide_le: valeurs.decide_le }
      });
      rapport.maj++;
    } else {
      const cree = await serveurAppel('/rest/v1/signalements', {
        methode: 'POST', entetes: { 'Prefer': 'return=representation' }, corps: valeurs
      });
      if (cree && cree[0]) dejaLa[clef] = cree[0].id;
      rapport.ajoutes++;
    }
  }
  return rapport;
}

// ========== CONNEXION PAR LE SERVEUR, DEPUIS L'ECRAN PRINCIPAL ==========
// Le compte n'est pas dans la liste de demonstration : on demande au serveur, puis on lit
// la FICHE (role, nom, matiere) — c'est elle qui decide de l'ecran a afficher.
function serveurMessageConnexion(e) {
  const m = (e && e.message) || '';
  if (/invalid login credentials|invalid_grant|invalid password/i.test(m)) return 'Email ou mot de passe incorrect';
  if (/email not confirmed/i.test(m)) {
    return 'Ce compte n\'est pas encore confirme dans Supabase : recoche « Auto Confirm User ».';
  }
  if (/failed to fetch|network|load failed/i.test(m)) return 'Le serveur est injoignable (verifie ta connexion internet).';
  return 'Le serveur a refuse : ' + (m || 'raison inconnue');
}

async function connexionParLeServeur(email, motDePasse) {
  messageConnexion('Connexion au serveur...', true);
  try {
    await serveurConnexion(email, motDePasse);
  } catch (e) {
    erreurConnexion(serveurMessageConnexion(e));
    return;
  }
  let fiche = null;
  try { fiche = await serveurMaFiche(); } catch (e) { fiche = null; }
  if (!fiche) {
    erreurConnexion('Ce compte n\'a pas encore de fiche. Ouvre « Première installation » pour créer ton établissement.');
    return;
  }
  etablissementServeurId = fiche.etablissement_id;
  marquerEspaceServeur(fiche);
  connecterReussi({
    email: email,
    password: '',                        // jamais conservé
    role: fiche.role,
    code: fiche.code || '',
    matiere: fiche.matiere || '',
    nom: fiche.nom,
    serveur: true,                       // <- ce drapeau distingue les deux sortes de comptes
    fiche: fiche.id,
    etablissementId: fiche.etablissement_id
  });
}

// ========== FENETRE « PREMIERE INSTALLATION » ==========
// Le titre doit dire la VERITE : au tout premier demarrage on INSTALLE, ensuite on ne fait
// que visiter son espace serveur (meme fenetre, deux situations differentes).
function majTitreInstallation(fiche) {
  const t = document.getElementById('inst-titre');
  if (!t) return;
  t.textContent = (fiche || ficheServeurId) ? 'Espace serveur' : 'Première installation';
}

function instDire(classe, texte) {
  const el = document.getElementById('inst-message');
  if (!el) return;
  el.className = 'inst-message' + (classe ? ' ' + classe : '');
  el.textContent = texte || '';
}

async function installationDeconnexion() {
  await serveurDeconnexion();
  const m = document.getElementById('modal-installation');
  if (m) m.setAttribute('data-etape', '1');
  instDire('info', 'Deconnecte du serveur.');
}

function ouvrirInstallation() {
  const m = document.getElementById('modal-installation');
  if (!m) return;
  serveurChargerSession();
  majTitreInstallation(null);
  instDire('', '');
  const annee = document.getElementById('inst-annee');
  if (annee && !annee.value) annee.value = ANNEE_SCOLAIRE_DEFAUT.libelle;
  m.setAttribute('data-etape', '1');
  m.classList.remove('hidden');
  if (SERVEUR.session) majEtapeInstallation();
}

function fermerInstallation() {
  const m = document.getElementById('modal-installation');
  if (m) m.classList.add('hidden');
}

async function installationConnexion() {
  const email = (document.getElementById('inst-email').value || '').trim();
  const mdp = document.getElementById('inst-mdp').value || '';
  if (!email || !mdp) { instDire('ko', 'Renseigne l\'adresse du compte et le mot de passe.'); return; }
  const bouton = document.getElementById('inst-btn-connexion');
  bouton.disabled = true;
  instDire('info', 'Connexion au serveur...');
  try {
    await serveurConnexion(email, mdp);
    instDire('ok', 'Connecte au serveur.');
    await majEtapeInstallation();
  } catch (e) {
    instDire('ko', 'Connexion refusee : ' + e.message);
  } finally {
    bouton.disabled = false;
  }
}

function majDonneesLocal() {
  const zone = document.getElementById('inst-donnees-local');
  if (!zone) return;
  let nbEleves = 0;
  for (let i = 0; i < classes.length; i++) nbEleves += classes[i].eleves.length;
  let nbSeances = 0;
  try { for (const k in tableauxService) nbSeances += (tableauxService[k] || []).length; } catch (e) {}
  zone.textContent = 'Sur ce téléphone : ' + classes.length + ' classe(s) · ' + nbEleves + ' élève(s) · ' +
                     personnesAEtager().length + ' personne(s) · ' + absences.length + ' signalement(s) · ' +
                     nbSeances + ' séance(s)';
}

async function majDonneesServeur() {
  const zone = document.getElementById('inst-donnees-serveur');
  if (!zone) return;
  zone.textContent = 'Sur le serveur : lecture...';
  try {
    const c = await serveurCompterDonnees();
    zone.textContent = 'Sur le serveur : ' + c.classes + ' classe(s) · ' + c.eleves + ' élève(s) · ' +
                       c.profils + ' personne(s) · ' + c.signalements + ' signalement(s) · ' +
                       c.seances + ' séance(s)';
  } catch (e) {
    zone.textContent = 'Sur le serveur : impossible de lire (' + e.message + ')';
  }
}

async function installationEnvoyer() {
  const bouton = document.getElementById('inst-btn-envoyer');
  bouton.disabled = true;
  instDire('info', 'Envoi en cours : listes, puis personnes, puis absences...');
  try {
    const l = await serveurEnvoyerDonnees();
    const p = await serveurEnvoyerFiches();
    const se = await serveurEnvoyerSeances();
    const fe = await serveurEnvoyerFermetures();
    const ap = await serveurEnvoyerAbsencesPersonnel();
    const an = await serveurEnvoyerAnnulations();
    const s = await serveurEnvoyerSignalements();
    let texte = 'Envoyé.\nListes : ' + l.classes + ' classe(s) nouvelle(s), ' + l.eleves +
                ' élève(s) ajouté(s).\nPersonnes : ' + p.fiches + ' nouvelle(s), ' + p.maj +
                ' renommée(s).\nCours : ' + se.seances + ' séance(s) envoyée(s).\nFermetures : ' +
                fe.fermetures + ' envoyée(s)';
    if (fe.ignores) texte += ' (' + fe.ignores + ' ignorée(s) : ' + fe.raisons[0] + ')';
    texte += '\nPersonnel : ' + ap.absences + ' indisponibilité(s), ' + an.annulations +
             ' annulation(s) de séance';
    if (ap.ignores || an.ignores) texte += ' (' + (ap.ignores + an.ignores) + ' ignorée(s) : ' +
      (ap.raisons[0] || an.raisons[0] || '') + ')';
    texte += '\nAbsences : ' +
                s.ajoutes + ' ajoutée(s), ' + s.maj + ' mise(s) à jour';
    if (p.desactivees) texte += '. ' + p.desactivees + ' personne(s) marquée(s) INACTIVE(S) (retirée(s) de la liste, historique conservé)';
    if (s.orphelins) texte += ', ' + s.orphelins + ' rattachée(s) par leur nom';
    if (s.ignores) {
      texte += ', ' + s.ignores + ' NON envoyée(s) :';
      for (let i = 0; i < Math.min(s.raisons.length, 5); i++) texte += '\n   • ' + s.raisons[i];
    }
    instDire(s.ignores ? 'info' : 'ok', texte);
    await majDonneesServeur();
  } catch (e) {
    instDire('ko', 'Le serveur a refusé : ' + e.message);
  } finally {
    bouton.disabled = false;
  }
}

async function majEtapeInstallation() {
  const m = document.getElementById('modal-installation');
  if (!m || !SERVEUR.session) return;
  document.getElementById('inst-compte').textContent = 'Compte : ' + (SERVEUR.session.email || '');
  let fiche = null, panne = null;
  try { fiche = await serveurMaFiche(); } catch (e) { panne = e; }
  const formulaire = document.getElementById('inst-formulaire');
  const bouton = document.getElementById('inst-btn-creer');
  const donnees = document.getElementById('inst-donnees');
  const reconnecter = document.getElementById('inst-reconnecter');
  majTitreInstallation(fiche);
  if (panne) {
    // On ne propose SURTOUT PAS de recreer l'etablissement : le serveur refuserait, et
    // l'utilisateur croirait avoir perdu son installation.
    document.getElementById('inst-aide-fiche').textContent =
      'Impossible de lire ton espace serveur (' + panne.message + '). Appuie sur « Se reconnecter » ci-dessous.';
    formulaire.style.display = 'none';
    bouton.style.display = 'none';
    donnees.style.display = 'none';
    reconnecter.style.display = '';
    m.setAttribute('data-etape', '2');
    return;
  }
  if (fiche) {
    document.getElementById('inst-aide-fiche').textContent =
      'Ce compte est deja rattache a « ' + fiche.nom + ' » (role : ' + fiche.role + ').';
    formulaire.style.display = 'none';
    bouton.style.display = 'none';
    etablissementServeurId = fiche.etablissement_id;
    ficheServeurId = fiche.id;
    donnees.style.display = '';
    reconnecter.style.display = '';
    majDonneesLocal();
    majDonneesServeur();
    majBlocRecuperation();
  } else {
    document.getElementById('inst-aide-fiche').textContent =
      'Ce compte n\'a pas encore de fiche : cree ton etablissement ci-dessous.';
    formulaire.style.display = '';
    bouton.style.display = '';
  }
  m.setAttribute('data-etape', '2');
}

async function installationCreer() {
  const code = (document.getElementById('inst-code').value || '').trim();
  const nom = (document.getElementById('inst-nom').value || '').trim();
  const nomDir = (document.getElementById('inst-nomdir').value || '').trim();
  if (!code || !nom || !nomDir) {
    instDire('ko', 'Renseigne le code, le nom de l\'etablissement et ton nom.');
    return;
  }
  const bouton = document.getElementById('inst-btn-creer');
  bouton.disabled = true;
  instDire('info', 'Creation en cours...');
  try {
    const id = await serveurPremierDirecteur({
      code: code, nom: nom, nomDirecteur: nomDir,
      academie: (document.getElementById('inst-academie').value || '').trim(),
      direction: (document.getElementById('inst-direction').value || '').trim(),
      annee: (document.getElementById('inst-annee').value || '').trim(),
      semestres: ANNEE_SCOLAIRE_DEFAUT.semestres
    });
    marquerEspaceServeur({ id: id });
    instDire('ok', 'Etablissement cree (fiche n° ' + id + '). Tu es le directeur de « ' + nom + ' ».');
    await majEtapeInstallation();
  } catch (e) {
    instDire('ko', 'Le serveur a refuse : ' + e.message);
  } finally {
    bouton.disabled = false;
  }
}
