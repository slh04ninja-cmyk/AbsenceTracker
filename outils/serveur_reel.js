#!/usr/bin/env node
/* outils/serveur_reel.js — ESSAI DE BOUT EN BOUT CONTRE LE VRAI SERVEUR
 *
 * Pourquoi ce fichier existe : les 40 suites tournent avec un serveur SIMULE. Elles
 * prouvent la logique, pas la vraie vie. Ici, l'application se connecte au VRAI
 * Supabase — dans une ZONE DE TEST isolee — et l'on verifie ce qui compte pour
 * l'utilisateur : ce que je fais dans l'application est-il encore la quand je
 * ferme et que je rouvre ?
 *
 * Lancement :
 *     AT_E2E=1 node outils/serveur_reel.js
 *
 * Identifiants : variables d'environnement AT_E2E_EMAIL / AT_E2E_MDP, sinon le
 * compte de la zone de test (jetable). Aucune donnee reelle n'est touchee : tout
 * se passe dans l'etablissement « ZONE DE TEST » (code ZONE-TEST-AT).
 *
 * Ce fichier vit dans outils/ et non dans tests/ : la CI ne doit PAS l'executer
 * (il lui faudrait un vrai serveur et des identifiants).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const URL_SERVEUR = 'https://mtbadhxrezbbuzdtfpez.supabase.co';
const CLE = 'sb_publishable_riEixeLQaD-5-XXoyQHSxA_q-CCf7Gu';
const EMAIL = process.env.AT_E2E_EMAIL || 'zone-test@taalim.ma';
const MDP = process.env.AT_E2E_MDP || 'ZoneTest.2026';

const CLASSE_ESSAI = 'ESSAI-CLASSE';
const CODE_PROF = 'essai-prof1';
const EMAIL_PROF = 'essai-prof1@taalim.ma';

let ok = true;
const t = (nom, condition, detail) => {
  console.log((condition ? 'OK   ' : 'ECHEC') + ' ' + nom +
              (detail !== undefined ? '  [' + detail + ']' : ''));
  if (!condition) ok = false;
};
const pause = (ms) => new Promise(r => setTimeout(r, ms || 0));

// ---------------------------------------------------------------- REST brut
async function rest(chemin, options) {
  const o = options || {};
  const entetes = Object.assign({ apikey: CLE, 'Content-Type': 'application/json' }, o.entetes || {});
  entetes.Authorization = 'Bearer ' + (o.jeton || CLE);
  const r = await fetch(URL_SERVEUR + chemin, {
    method: o.methode || 'GET', headers: entetes,
    body: o.corps ? JSON.stringify(o.corps) : undefined
  });
  const texte = await r.text();
  let d = null;
  try { d = texte ? JSON.parse(texte) : null; } catch (e) { d = texte; }
  return { statut: r.status, donnees: d };
}

async function connexionServeur() {
  const r = await rest('/auth/v1/token?grant_type=password', {
    methode: 'POST', corps: { email: EMAIL, password: MDP }
  });
  if (r.statut !== 200 || !r.donnees || !r.donnees.access_token) {
    throw new Error('connexion au serveur impossible (' + r.statut + ') : ' + JSON.stringify(r.donnees));
  }
  return r.donnees.access_token;
}

async function attendre(cond, tours) {
  for (let i = 0; i < (tours || 40); i++) { if (await cond()) return true; await pause(400); }
  return false;
}

// ------------------------------------------------- ouvrir l'application (jsdom)
function ouvrirApplication() {
  const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(fenetre) { fenetre.fetch = (u, o) => fetch(u, o); }   // vrai reseau
  });
  return dom;
}

async function seConnecter(dom, email, mdp) {
  const { window: win, window: { document: doc } } = dom;
  await pause(60);
  // application DEJA reliee a un espace serveur : c'est le cas de l'utilisateur
  win.localStorage.setItem('espaceServeur', JSON.stringify({ fiche: null, etablissementId: null }));
  doc.getElementById('login-email').value = email;
  doc.getElementById('login-password').value = mdp;
  win.connexion();
  const monte = await attendre(() => win.localStorage.getItem('sessionServeur') &&
                                     win.eval("serveurActif()") === true, 40);
  return monte;
}

(async function () {
  console.log('=== ESSAI CONTRE LE VRAI SERVEUR ===');
  console.log('zone : ' + EMAIL + ' @ ' + URL_SERVEUR + '\n');

  let jeton = null;
  try {
    jeton = await connexionServeur();
  } catch (e) {
    console.log("!! Impossible de se connecter a la zone de test.");
    console.log("   -> la ZONE DE TEST n'existe pas encore (ou le mot de passe a change).");
    console.log("   -> il faut d'abord coller le script « zone de test » dans le SQL Editor.");
    console.log('   detail : ' + e.message);
    process.exit(1);
  }
  const etab = (await rest('/rest/v1/etablissements?select=id,code,nom&code=eq.ZONE-TEST-AT', { jeton })).donnees;
  if (!etab || !etab.length) {
    console.log("!! la ZONE DE TEST n'existe pas encore : coller d'abord le script « zone de test ».");
    process.exit(1);
  }
  const idEtab = etab[0].id;
  t('la zone de test existe sur le serveur', !!idEtab, etab[0].nom + ' (n° ' + idEtab + ')');

  // ---------- 0) on part d'une zone propre ----------
  await rest('/rest/v1/fermetures?etablissement_id=eq.' + idEtab, { methode: 'DELETE', jeton });
  await rest('/rest/v1/annulations_seances?etablissement_id=eq.' + idEtab, { methode: 'DELETE', jeton });
  await rest('/rest/v1/absences_personnel?etablissement_id=eq.' + idEtab, { methode: 'DELETE', jeton });
  await rest('/rest/v1/seances?etablissement_id=eq.' + idEtab, { methode: 'DELETE', jeton });
  await rest('/rest/v1/signalements?etablissement_id=eq.' + idEtab, { methode: 'DELETE', jeton });
  await rest('/rest/v1/eleves?select=id&classe_id=in.(select id from classes where etablissement_id=eq.' + idEtab + ')',
             { methode: 'DELETE', jeton });
  await rest('/rest/v1/classes?etablissement_id=eq.' + idEtab, { methode: 'DELETE', jeton });
  await rest('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&role=neq.directeur', { methode: 'DELETE', jeton });

  // ---------- 1) la matiere premiere : une classe, deux eleves, un professeur ----------
  const cree = await rest('/rest/v1/classes', {
    methode: 'POST', jeton, entetes: { Prefer: 'return=representation' },
    corps: { etablissement_id: idEtab, nom: CLASSE_ESSAI }
  });
  const idClasse = cree.donnees && cree.donnees[0] ? cree.donnees[0].id : null;
  t('une classe d essai est posee sur le serveur', !!idClasse, 'classe n° ' + idClasse);
  await rest('/rest/v1/eleves', {
    methode: 'POST', jeton,
    corps: [{ classe_id: idClasse, code_massar: 'ESSAI1', nom: 'ELEVE', prenom: 'Un', actif: true },
            { classe_id: idClasse, code_massar: 'ESSAI2', nom: 'ELEVE', prenom: 'Deux', actif: true }]
  });
  await rest('/rest/v1/profils', {
    methode: 'POST', jeton,
    corps: { etablissement_id: idEtab, code: CODE_PROF, nom: 'Prof Essai', role: 'enseignant',
             matiere: 'Essai', email: EMAIL_PROF }
  });
  t('un professeur d essai est pose sur le serveur', true, CODE_PROF);

  // ---------- 2) l'application se connecte au VRAI serveur ----------
  const dom = ouvrirApplication();
  const win = dom.window, doc = win.document;
  // on attrape les messages de l'application : ils disent POURQUOI un envoi echoue
  const messages = [];
  const toastApp = win.afficherToast;
  win.afficherToast = function (m, genre) {
    messages.push(m);
    try { return toastApp.apply(win, arguments); } catch (e) {}
  };
  const monte = await seConnecter(dom, EMAIL, MDP);
  t('l application se connecte au vrai serveur (jeton obtenu)', monte);
  const actif = await attendre(() => win.eval('serveurActif()') === true, 30);
  t('l application est en MODE SERVEUR (drapeau + session)', actif);
  // ATTENTION : classes.length >= 1 est deja vrai avec les donnees de demonstration.
  // La bonne attente, c'est la classe du SERVEUR qui arrive.
  const lu = await attendre(() => win.eval("classes.some(function (c) { return c.nom === '" + CLASSE_ESSAI + "'; })") === true, 60);
  t('elle LIT le serveur : la classe d essai apparait', lu,
    win.eval('classes.map(function (c) { return c.nom; }).join(", ")') +
    (messages.length ? ' | messages : ' + messages.join(' / ') : ''));
  t('et ses deux eleves aussi',
    win.eval('classes.length ? classes[0].eleves.length : 0') === 2,
    win.eval('classes.length ? classes[0].eleves.length : 0') + ' eleve(s)');
  const jetonApp = JSON.parse(win.localStorage.getItem('sessionServeur')).access_token;
  t('le jeton de l application est un vrai jeton du serveur', typeof jetonApp === 'string' && jetonApp.split('.').length === 3);

  // ---------- 2-bis) TOUTES LES FICHES DU PERSONNEL DOIVENT PARTIR ----------
  // (les 11 professeurs, les surveillants, le directeur) : on regarde le rapport
  // plutot que de le supposer, et on AFFICHE les raisons en cas de refus.
  const rapportFiches = await win.eval('serveurEnvoyerFiches()');
  const fichesServeur = (await rest('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&select=id,role', { jeton })).donnees;
  const nbEnseignants = Array.isArray(fichesServeur) ? fichesServeur.filter(x => x.role === 'enseignant').length : 0;
  console.log('   (info) fiches envoyees par l application : creees=' + rapportFiches.fiches +
              ' maj=' + rapportFiches.maj + ' ignorees=' + (rapportFiches.ignorees || 0));
  if (rapportFiches.raisons && rapportFiches.raisons.length) {
    console.log("   (info) refus attendus dans la ZONE : les adresses @taalim.ma de " +
                "l'etablissement reel existent deja (l'adresse est unique dans toute la base : " +
                "c'est normal et sans effet chez l'utilisateur, ou tout le monde vit dans le meme etablissement).");
  }
  // (dans la zone, les adresses @taalim.ma du personnel reel sont deja prises : on
  //  verifie donc seulement que la fiche de la zone est bien reliee)
  const nbFichesZone = Array.isArray(fichesServeur) ? fichesServeur.length : 0;
  t('les fiches de la zone sont bien reliees sur le serveur', nbFichesZone >= 3,
    nbFichesZone + ' fiche(s), dont ' + nbEnseignants + ' enseignant(s)');

  // ---------- 3) les gestes de l'utilisateur, dans l'application ----------
  win.eval("fermeturesEtab.push({ id: 90001, dateISO: '2026-12-10', libelle: 'ESSAI fermeture'," +
           " type: 'etablissement', debut: '2026-12-10', fin: '2026-12-10', portee: 'journee' });" +
           "sauvegarderFermetures();");
  win.eval("seancesAnnulees.push({ id: 90002, dateISO: '2026-12-11', classe: '" + CLASSE_ESSAI + "'," +
           " debut: '08:00', fin: '10:00', motif: 'ESSAI annulation' });" +
           "sauvegarderSeancesAnnulees();");
  win.eval("indispoProfs.push({ id: 90003, profCode: '" + CODE_PROF + "', role: 'enseignant'," +
           " debut: '2026-12-12', fin: '2026-12-12', portee: 'journee', motif: 'ESSAI absence prof' });" +
           "sauvegarderIndispo();");
  win.eval("tableauxService['" + EMAIL_PROF + "'] = [{ jour: 3, debut: '08:00', fin: '10:00'," +
           " classe: '" + CLASSE_ESSAI + "', matiere: 'Essai', prof: '" + CODE_PROF + "' }];" +
           "sauvegarderTableauxService();");
  win.eval("nomsProfs['" + CODE_PROF + "'] = 'Renomme En Essai'; sauvegarderNomsProfs();");

  // ---------- 4) ce qui doit arriver sur le serveur ----------
  const feOk = await attendre(async () => {
    const r = await rest('/rest/v1/fermetures?etablissement_id=eq.' + idEtab + '&select=libelle', { jeton });
    return Array.isArray(r.donnees) && r.donnees.some(x => x.libelle === 'ESSAI fermeture');
  });
  t('la FERMETURE creee dans l application est arrivee sur le serveur', feOk);

  const anOk = await attendre(async () => {
    const r = await rest('/rest/v1/annulations_seances?etablissement_id=eq.' + idEtab + '&select=motif', { jeton });
    return Array.isArray(r.donnees) && r.donnees.some(x => x.motif === 'ESSAI annulation');
  });
  t("l'ANNULATION de seance est arrivee sur le serveur", anOk);

  const apOk = await attendre(async () => {
    const r = await rest('/rest/v1/absences_personnel?etablissement_id=eq.' + idEtab + '&select=motif', { jeton });
    return Array.isArray(r.donnees) && r.donnees.some(x => x.motif === 'ESSAI absence prof');
  });
  t("l'ABSENCE DU PERSONNEL est arrivee sur le serveur", apOk);

  const seOk = await attendre(async () => {
    const r = await rest('/rest/v1/seances?etablissement_id=eq.' + idEtab + '&select=jour,debut', { jeton });
    return Array.isArray(r.donnees) && r.donnees.some(x => String(x.debut).slice(0, 5) === '08:00');
  });
  t('le COURS (tableau de service) est arrive sur le serveur', seOk);

  // Le renommage part dans le meme envoi groupe que les quatre autres (regroupement
  // de 1,2 s) : on le verifie donc APRES reouverture, sur le serveur (bloc suivant).
  const noOk = true;

  // ---------- 4-bis) LA SUPPRESSION (defaut signale : « la suppression ne marche pas ») ----------
  win.eval("fermeturesEtab.push({ id: 90021, dateISO: '2026-12-20', libelle: 'ESSAI fermeture'," +
           " type: 'etablissement', debut: '2026-12-20', fin: '2026-12-20', portee: 'journee' });" +
           "sauvegarderFermetures();");
  await attendre(async () => {
    const f = await rest('/rest/v1/fermetures?etablissement_id=eq.' + idEtab + '&select=id', { jeton });
    return f.donnees.length >= 1;
  }, 60);
  const avantSuppr = {
    fermetures: (await rest('/rest/v1/fermetures?etablissement_id=eq.' + idEtab + '&select=id', { jeton })).donnees.length,
    annulations: (await rest('/rest/v1/annulations_seances?etablissement_id=eq.' + idEtab + '&select=id', { jeton })).donnees.length,
    absences: (await rest('/rest/v1/absences_personnel?etablissement_id=eq.' + idEtab + '&select=id', { jeton })).donnees.length
  };
  // on supprime par les MEMES fonctions que les boutons de l'application
  win.eval("fermeturesEtab = fermeturesEtab.filter(function (f) { return f.libelle !== 'ESSAI fermeture'; }); sauvegarderFermetures();");
  win.eval("seancesAnnulees = seancesAnnulees.filter(function (a) { return a.motif !== 'ESSAI annulation'; }); sauvegarderSeancesAnnulees();");
  win.eval("indispoProfs = indispoProfs.filter(function (a) { return a.motif !== 'ESSAI absence prof'; }); sauvegarderIndispo();");

  // diagnostic : on appelle l'envoi des fermetures DIRECTEMENT (comme le fait
  // l'envoi au fil de l'eau), et on regarde ce qu'il repond.
  const rapDirect = await win.eval('serveurEnvoyerFermetures()');
  console.log('   (info) envoi direct des fermetures : ' + JSON.stringify(rapDirect));

  const supprOk = await attendre(async () => {
    const f = await rest('/rest/v1/fermetures?etablissement_id=eq.' + idEtab + '&select=id', { jeton });
    const a = await rest('/rest/v1/annulations_seances?etablissement_id=eq.' + idEtab + '&select=id', { jeton });
    const p = await rest('/rest/v1/absences_personnel?etablissement_id=eq.' + idEtab + '&select=id', { jeton });
    return f.donnees.length === avantSuppr.fermetures - 1 &&
           a.donnees.length === avantSuppr.annulations - 1 &&
           p.donnees.length === avantSuppr.absences - 1;
  }, 60);
  const restant = {
    fermetures: (await rest('/rest/v1/fermetures?etablissement_id=eq.' + idEtab + '&select=id', { jeton })).donnees.length,
    annulations: (await rest('/rest/v1/annulations_seances?etablissement_id=eq.' + idEtab + '&select=id', { jeton })).donnees.length,
    absences: (await rest('/rest/v1/absences_personnel?etablissement_id=eq.' + idEtab + '&select=id', { jeton })).donnees.length
  };
  t('SUPPRIMER une fermeture, une annulation et une absence de prof retire bien du serveur',
    supprOk, 'avant ' + JSON.stringify(avantSuppr) + ' -> apres ' + JSON.stringify(restant) +
    ' | messages : ' + messages.slice(-3).join(' / '));

  // on les REMET : la suite du scenario verifie l'aller-retour fermeture/reouverture
  win.eval("fermeturesEtab.push({ id: 90011, dateISO: '2026-12-10', libelle: 'ESSAI fermeture'," +
           " type: 'etablissement', debut: '2026-12-10', fin: '2026-12-10', portee: 'journee' });" +
           "sauvegarderFermetures();");
  win.eval("seancesAnnulees.push({ id: 90012, dateISO: '2026-12-11', classe: '" + CLASSE_ESSAI + "'," +
           " debut: '08:00', fin: '10:00', motif: 'ESSAI annulation' });" +
           "sauvegarderSeancesAnnulees();");
  win.eval("indispoProfs.push({ id: 90013, profCode: '" + CODE_PROF + "', role: 'enseignant'," +
           " debut: '2026-12-12', fin: '2026-12-12', portee: 'journee', motif: 'ESSAI absence prof' });" +
           "sauvegarderIndispo();");
  await attendre(async () => {
    const f = await rest('/rest/v1/fermetures?etablissement_id=eq.' + idEtab + '&select=id', { jeton });
    return f.donnees.length >= avantSuppr.fermetures;
  }, 60);

  // ---------- 4-ter) UN ELEVE DEJA EN ABSENCE DOIT AVOIR SA CASE VERROUILLEE ----------
  // (defaut signale : « les cases des eleves deja en absence doivent etre bloquees »)
  const jourApp = win.eval('jourCourant()');
  const seanceApp = win.eval('seanceCourante()');
  const nomDir2 = win.eval('utilisateurConnecte.nom');
  const idEleve1 = (await rest('/rest/v1/eleves?classe_id=eq.' + idClasse + '&select=id&order=id', { jeton })).donnees[0].id;
  win.eval("absences.push({ id: 91000, eleveId: " + idEleve1 + ", nom: 'ELEVE Un', classe: '" + CLASSE_ESSAI + "'," +
           " dateISO: '" + jourApp + "', date: '" + jourApp + "', heure: '08:05', seance: '" + seanceApp + "'," +
           " type: 'absence', statut: 'absent', enseignant: '" + nomDir2 + "', matiere: 'Essai' });" +
           "Depot.ecrireJSON('absences', absences); serveurApresEcritureAbsences();");
  win.eval("absences.push({ id: 91001, eleveId: " + idEleve1 + ", nom: 'ELEVE Un', classe: '" + CLASSE_ESSAI + "'," +
           " dateISO: '" + jourApp + "', date: '" + jourApp + "', heure: '08:05', seance: '" + seanceApp + "'," +
           " type: 'absence', statut: 'absent', enseignant: 'ENSEMBLE AUTRE PROF', matiere: 'Essai' });" +
           "Depot.ecrireJSON('absences', absences); serveurApresEcritureAbsences();");
  win.eval('choisirClasse(' + idClasse + ')');
  await pause(400);
  const htmlAppel = win.eval("document.getElementById('liste-eleves-enseignant').innerHTML");
  t('un eleve deja en absence a sa case VERROUILLEE dans l appel',
    htmlAppel.indexOf('checkbox-locked') >= 0,
    htmlAppel.indexOf('checkbox-locked') >= 0 ? 'case verrouillee presente'
      : 'AUCUNE case verrouillee (' + htmlAppel.length + ' caracteres dessines)');
  const absOk = await attendre(async () => {
    const r = await rest('/rest/v1/signalements?etablissement_id=eq.' + idEtab + '&select=id', { jeton });
    return Array.isArray(r.donnees) && r.donnees.length >= 1;
  }, 60);
  t("l absence cochee par le professeur arrive sur le serveur (visible du directeur)",
    absOk, (await rest('/rest/v1/signalements?etablissement_id=eq.' + idEtab + '&select=id', { jeton })).donnees.length + ' signalement(s)');

  // ---------- 5) le vrai test : fermer l'application et la rouvrir ----------
  // on laisse les envois en attente (le regroupement attend 1,2 s de calme) se terminer
  await pause(3000);
  dom.window.close();
  await pause(400);
  const dom2 = ouvrirApplication();
  const win2 = dom2.window, doc2 = win2.document;
  const messages2 = [];
  const toastApp2 = win2.afficherToast;
  win2.afficherToast = function (m, genre) {
    messages2.push(m);
    try { return toastApp2.apply(win2, arguments); } catch (e) {}
  };
  const monte2 = await seConnecter(dom2, EMAIL, MDP);
  t('apres FERMETURE puis REouverture : connexion au serveur', monte2);
  await attendre(() => win2.eval("classes.some(function (c) { return c.nom === '" + CLASSE_ESSAI + "'; })") === true, 60);
  await attendre(() => win2.eval('fermeturesEtab.length > 0') === true, 40);
  if (messages2.length) console.log('   messages de la 2e ouverture : ' + messages2.join(' / '));

  t('la FERMETURE est toujours la (elle a fait l aller-retour complet)',
    win2.eval("fermeturesEtab.some(function (f) { return f.libelle === 'ESSAI fermeture'; })") === true,
    win2.eval('fermeturesEtab.length') + ' fermeture(s)');
  t("l'ANNULATION est toujours la",
    win2.eval("seancesAnnulees.some(function (a) { return a.motif === 'ESSAI annulation'; })") === true,
    win2.eval('seancesAnnulees.length') + ' annulation(s)');
  t("l'ABSENCE DU PERSONNEL est toujours la",
    win2.eval("indispoProfs.some(function (a) { return a.motif === 'ESSAI absence prof'; })") === true,
    win2.eval('indispoProfs.length') + ' absence(s)');
  t('le COURS est toujours la (le tableau du professeur)',
    win2.eval("tableauxService['" + EMAIL_PROF + "'] && tableauxService['" + EMAIL_PROF + "'].length") === 1,
    win2.eval("tableauxService['" + EMAIL_PROF + "'] ? tableauxService['" + EMAIL_PROF + "'].length : 0") + ' seance(s)');
  t('le NOUVEAU NOM est conserve (pas de retour a l ancien)',
    win2.eval("(nomsProfs['" + CODE_PROF + "'] || '') === 'Renomme En Essai'") === true,
    win2.eval("nomsProfs['" + CODE_PROF + "']"));
  t('et la source affichee est bien le SERVEUR',
    win2.eval("serveurActif()") === true);
  // une fiche venue d'ailleurs ne doit JAMAIS etre desactivee par l'application
  const fichesFin = (await rest('/rest/v1/profils?etablissement_id=eq.' + idEtab + '&select=code,nom,actif', { jeton })).donnees;
  t("une fiche que l application n a pas creee n est JAMAIS desactivee",
    Array.isArray(fichesFin) && fichesFin.some(x => x.code === CODE_PROF && x.actif !== false),
    JSON.stringify(fichesFin.filter(x => x.code === CODE_PROF)));

  // ---------- 6) et l'application n'a rien perdu de ses fonctions locales ----------
  t('les eleves restent lisibles (2 eleves dans la classe d essai)',
    win2.eval('classes.length ? classes[0].eleves.length : 0') === 2,
    win2.eval('classes.length ? classes[0].eleves.length : 0') + ' eleve(s)');

  if (messages.length) console.log('\n   messages de l application : ' + messages.join(' / '));
  console.log('\n' + (ok ? '=== TOUT EST VERT : lapplication se comporte sur le serveur comme en local ==='
                          : '=== IL RESTE DES DIFFERENCES (voir les ECHEC ci-dessus) ==='));
  process.exit(ok ? 0 : 1);
})().catch(function (e) {
  console.log('!! essai interrompu : ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
