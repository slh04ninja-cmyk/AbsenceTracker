// fichier: app/js/20-ecole.js
// ========== A QUELLE ECOLE APPARTIENNENT LES DONNEES DU TELEPHONE ==========
// Defaut signale par l'utilisateur (v4.07) : sur le compte d'une NOUVELLE ecole, les
// eleves de l'AUTRE ecole s'affichaient. Cause : l'application lisait toujours les
// listes du telephone, sans se demander a quelle ecole elles appartiennent.
//
// REGLE : les listes de travail du telephone portent une ETIQUETTE — l'ecole a laquelle
// elles appartiennent. Une ecole ouverte ne montre QUE les listes qui portent son
// etiquette. Des donnees sans etiquette n'appartiennent a aucune ecole : elles ne
// s'affichent pas tant qu'elles n'ont pas ete envoyees a une ecole.
//
// L'etiquette se pose une fois : sur un telephone vierge, des qu'une ecole ouverte
// enregistre des donnees, ou a l'envoi vers le serveur. Une simple connexion ne la
// reecrit jamais : c'est ce qui evite le melange des ecoles.

function etiquetteEcole() {
  const parCode = Depot.lire('etabDonnees', '');      // etiquette d'origine (par code)
  if (parCode) return String(parCode);
  const parId = Depot.lire('etiquetteEcole', '');
  if (parId) return String(parId);
  // telephones d'avant la v4.08 : la memoire de l'espace serveur portait l'etablissement
  try {
    const v = JSON.parse(Depot.lire('espaceServeur', '{}'));
    if (v && v.etablissementId) return String(v.etablissementId);
  } catch (err) {}
  return '';
}

function poserEtiquetteEcole(etab) {
  if (!etab) return;
  Depot.ecrire('etiquetteEcole', String(etab.id || etab));
  if (etab.code) Depot.ecrire('etabDonnees', String(etab.code));
}

// L'ecole ouverte sur ce telephone (celle du compte connecte).
function ecoleOuverte() {
  // 1. la reference posee par le SERVEUR a la connexion (la plus fiable)
  const idServeur = Depot.lire('ecoleOuverteId', '');
  const codeServeur = Depot.lire('ecoleOuverteCode', '');
  if (idServeur || codeServeur) return { id: String(idServeur || ''), code: String(codeServeur || '') };
  // 2. a defaut, le compte connecte. (Lecture prudente : au tout debut du chargement,
  //    ces variables n'existent pas encore — defaut trouve par test_v403_temoin.)
  let id = '', code = '';
  try { const u = utilisateurConnecte || {}; if (u.etablissementId) id = String(u.etablissementId); } catch (err) {}
  try { if (typeof etablissement !== 'undefined' && etablissement && etablissement.code) code = String(etablissement.code); } catch (err) {}
  if (id || code) return { id: id, code: code };
  try {
    const v = JSON.parse(Depot.lire('utilisateur', '{}'));
    return { id: v && v.etablissementId ? String(v.etablissementId) : '', code: '' };
  } catch (e) { return { id: '', code: '' }; }
}

// Les listes du telephone sont-elles celles de l'ecole ouverte ?
function donneesDuTelephoneVisibles() {
  if (typeof estModeEcole !== 'function' || !estModeEcole()) return true;   // telephone libre
  const ici = ecoleOuverte();
  if (!ici.id && !ici.code) return true;              // aucune ecole ouverte : rien a cloisonner
  const mien = etiquetteEcole();
  if (!mien) return false;                            // donnees sans etiquette : aucune ecole
  return mien === ici.id || (ici.code !== '' && mien === ici.code);
}

// A appeler AVANT d'enregistrer des donnees dans une ecole ouverte : sur un telephone
// vierge, les premieres donnees enregistrees appartiennent a l'ecole ouverte.
function etiqueterSiVierge() {
  if (typeof estModeEcole !== 'function' || !estModeEcole()) return;
  if (etiquetteEcole()) return;                       // deja etiquete : on ne touche pas
  const ici = ecoleOuverte();
  if (ici.code) Depot.ecrire('etabDonnees', ici.code);
  else if (ici.id) Depot.ecrire('etiquetteEcole', ici.id);
}

// A appeler au demarrage et apres chaque connexion : l'application ne garde alors en
// memoire que les listes de l'ecole ouverte.
function appliquerEcoleAuxListes() {
  // IMPORTANT : on MASQUE, on n'EFFACE JAMAIS. Les donnees d'une autre ecole restent
  // enregistrees sur le telephone ; elles disparaissent seulement de l'ecran. Une
  // donnee de travail ne se supprime que sur une demande claire de l'utilisateur.
  const visibles = donneesDuTelephoneVisibles();
  const liste = function (cle, depart) {
    if (typeof chargerListe !== 'function') return depart;
    try { return chargerListe(cle) || depart; } catch (e) { return depart; }
  };
  try {
    classes = visibles ? chargerClasses() : [];
  } catch (e) { classes = visibles ? classes : []; }
  try { absences = visibles ? liste('absences', []) : []; } catch (e) {}
  try { indispoProfs = visibles ? liste('indispoProfs', []) : []; } catch (e) {}
  try { seancesAnnulees = visibles ? liste('seancesAnnulees', []) : []; } catch (e) {}
  try { fermeturesEtab = visibles ? liste('fermeturesEtab', []) : []; } catch (e) {}
  try { tableauxService = visibles ? chargerTableauxService() : {}; } catch (e) {}
  try { if (typeof verifierBlocageAbsence === 'function') verifierBlocageAbsence(); } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.donneesDuTelephoneVisibles = donneesDuTelephoneVisibles;
  window.appliquerEcoleAuxListes = appliquerEcoleAuxListes;
  window.etiquetteEcole = etiquetteEcole;
}
