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
  if (!idEtab) return { classes: 0, eleves: 0, profils: 0, signalements: 0 };
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
                                 '&role=neq.directeur&select=id')) || [];
  const ss = (await serveurAppel('/rest/v1/signalements?etablissement_id=eq.' + idEtab + '&select=id')) || [];
  return { classes: cs.length, eleves: eleves, profils: ps.length, signalements: ss.length };
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
  const etabs = await serveurAppel('/rest/v1/etablissements?id=eq.' + idEtab + '&select=*');
  const et = (etabs && etabs[0]) || null;
  const cServ = (await serveurAppel('/rest/v1/classes?etablissement_id=eq.' + idEtab + '&select=id,nom&order=nom')) || [];
  if (!cServ.length && classes.length) {
    throw new Error('lecture vide : on garde les donnees du telephone (rien n\'a ete remplace)');
  }
  const eServ = (await serveurAppel('/rest/v1/eleves?select=id,classe_id,code_massar,nom,prenom,actif')) || [];
  const pServ = (await serveurAppel('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&select=id,nom,code,role,matiere,email')) || [];
  const sServ = (await serveurAppel('/rest/v1/signalements?etablissement_id=eq.' + idEtab +
        '&select=id,eleve_id,classe_id,prof_id,date_abs,moment,heure,type,retard_minutes,statut,motif,decide_par,decide_le&order=date_abs')) || [];

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

  // copie de secours AVANT de remplacer (au cas ou), puis remplacement
  Depot.ecrireJSON('classesAvantServeur', classes);
  Depot.ecrireJSON('absencesAvantServeur', absences);
  classes = nouvelles;
  absences = nouvellesAbsences;
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
  return { classes: nouvelles.length, eleves: eServ.length, absences: nouvellesAbsences.length };
}

// Apres une lecture, on redessine les ecrans qui existent pour le role connecte.
function serveurRafraichirEcrans() {
  const appels = ['mettreAJourDashboardDir', 'mettreAJourDashboardSurv', 'afficherSeancesAnnulees',
                  'afficherListeEleves', 'remplirListeClasses', 'afficherAbsencesPersonnel'];
  for (let i = 0; i < appels.length; i++) {
    try { if (typeof window[appels[i]] === 'function') window[appels[i]](); } catch (e) {}
  }
}

// Toute ecriture d'absence faite dans l'app est immediatement reportee sur le serveur :
// on reutilise l'envoi REJOUABLE deja teste (aucun doublon au second passage).
function serveurApresEcritureAbsences() {
  if (!serveurActif()) return;
  serveurEnvoyerSignalements().catch(function (e) {
    instDire('ko', 'Enregistré sur le téléphone, mais pas encore sur le serveur (' + e.message + ').');
  });
}

// ---- les personnes (fiches sans compte) : prealable obligatoire aux absences, car
//      chaque signalement est rattache a la fiche du professeur concerne ----
function personnesAEtager() {
  const liste = [];
  for (let i = 0; i < comptes.length; i++) {
    const c = comptes[i];
    if (c.role === 'directeur') continue;            // sa fiche existe deja
    liste.push({
      code: c.code || null,
      nom: c.nom,
      role: c.role,
      matiere: c.role === 'enseignant' ? (c.matiere || null) : null,
      email: c.email || null
    });
  }
  // les professeurs des tableaux de service qui n'ont pas encore de compte
  let tableaux = {};
  try { tableaux = (typeof tableauxService === 'object' && tableauxService) ? tableauxService : {}; } catch (e) { tableaux = {}; }
  for (const cle in tableaux) {
    if (/@/.test(cle)) continue;                      // deja un compte
    const seances = tableaux[cle] || [];
    if (!seances.length) continue;
    liste.push({
      code: null,
      nom: seances[0].prof || cle.replace(/^matiere:/, ''),
      role: 'enseignant',
      matiere: seances[0].matiere || cle.replace(/^matiere:/, ''),
      email: null
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
                                    '&select=id,code,nom,matiere')) || [];
  const parCode = {}, parNom = {};
  fServ.forEach(function (f) {
    if (f.code) parCode[f.code] = f;
    parNom[f.nom] = f;
  });
  const liste = personnesAEtager();
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    const existante = (p.code && parCode[p.code]) || parNom[p.nom] || null;
    if (!existante) {
      const cree = await serveurAppel('/rest/v1/profils', {
        methode: 'POST', entetes: { 'Prefer': 'return=representation' },
        corps: { etablissement_id: idEtab, code: p.code, nom: p.nom, role: p.role,
                 matiere: p.matiere, email: p.email }
      });
      if (cree && cree[0]) { parCode[cree[0].code] = cree[0]; parNom[cree[0].nom] = cree[0]; rapport.fiches++; }
    } else if (existante.nom !== p.nom) {
      // ATTENTION : la base ne laisse modifier QUE la colonne « nom » sur une fiche
      // (verrou de colonne voulu : impossible de changer role, matiere ou etablissement).
      await serveurAppel('/rest/v1/profils?id=eq.' + existante.id, {
        methode: 'PATCH', corps: { nom: p.nom }
      });
      rapport.maj++;
    }
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
  zone.textContent = 'Sur ce téléphone : ' + classes.length + ' classe(s) · ' + nbEleves + ' élève(s) · ' +
                     personnesAEtager().length + ' personne(s) · ' + absences.length + ' signalement(s)';
}

async function majDonneesServeur() {
  const zone = document.getElementById('inst-donnees-serveur');
  if (!zone) return;
  zone.textContent = 'Sur le serveur : lecture...';
  try {
    const c = await serveurCompterDonnees();
    zone.textContent = 'Sur le serveur : ' + c.classes + ' classe(s) · ' + c.eleves + ' élève(s) · ' +
                       c.profils + ' personne(s) · ' + c.signalements + ' signalement(s)';
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
    const s = await serveurEnvoyerSignalements();
    let texte = 'Envoyé.\nListes : ' + l.classes + ' classe(s) nouvelle(s), ' + l.eleves +
                ' élève(s) ajouté(s).\nPersonnes : ' + p.fiches + ' nouvelle(s), ' + p.maj +
                ' renommée(s).\nAbsences : ' + s.ajoutes + ' ajoutée(s), ' + s.maj + ' mise(s) à jour';
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
    instDire('ok', 'Etablissement cree (fiche n° ' + id + '). Tu es le directeur de « ' + nom + ' ».');
    await majEtapeInstallation();
  } catch (e) {
    instDire('ko', 'Le serveur a refuse : ' + e.message);
  } finally {
    bouton.disabled = false;
  }
}
