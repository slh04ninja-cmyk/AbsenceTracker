// fichier: app/js/01-chargement.js
// ========== DEPOT — LA SEULE PORTE VERS LE STOCKAGE ==========
// Toutes les lectures et ecritures de donnees passent par ici : aucun `localStorage` ailleurs
// dans l'application (verifie par les tests). C'est CETTE porte qu'on remplacera par Supabase,
// sans toucher au reste du code : les modules continueront d'appeler Depot.lire/ecrire.
const Depot = {
  // valeur brute (chaine) ou `defaut` si absente / impossible a lire
  lire(cle, defaut) {
    try {
      const v = localStorage.getItem(cle);
      return v === null ? (defaut === undefined ? null : defaut) : v;
    } catch (e) { return defaut === undefined ? null : defaut; }
  },
  // objet ou tableau ; `defaut` si absent ou illisible (jamais d'exception)
  lireJSON(cle, defaut) {
    try {
      const v = localStorage.getItem(cle);
      if (v === null) return defaut;
      const obj = JSON.parse(v);
      return obj === null ? defaut : obj;
    } catch (e) { return defaut; }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem(cle, valeur); return true; }
    catch (e) { console.warn('Depot : ecriture impossible pour ' + cle, e); return false; }
  },
  ecrireJSON(cle, valeur) { return Depot.ecrire(cle, JSON.stringify(valeur)); },
  effacer(cle) { try { localStorage.removeItem(cle); } catch (e) {} },
  // Toute la memoire rangee (pour une sauvegarde). `ecarter` : les cles a ne pas
  // copier (les jetons de connexion, par exemple). Reste DANS cette porte : aucun
  // module ne touche au stockage directement.
  tout(ecarter) {
    const exclus = ecarter || [];
    const contenu = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const cle = localStorage.key(i);
        if (exclus.indexOf(cle) >= 0) continue;
        contenu[cle] = localStorage.getItem(cle);
      }
    } catch (e) {}
    return contenu;
  }
};
// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========
let classes = [];
let nextClasseId = 1;
let nextEleveId = 1;

const DEMO_VERSION = 'v3.0';

function chargerClasses() {
  const sauve = Depot.lire('classes', null);
  const version = Depot.lire('absenceTrackVersion', null);
  if (sauve && version === DEMO_VERSION) {
    try {
      const liste = JSON.parse(sauve);
      if (Array.isArray(liste) && liste.length > 0) {
        nextClasseId = liste.reduce((m, c) => Math.max(m, c.id), 0) + 1;
        nextEleveId = liste.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
        return liste;
      }
    } catch (e) {}
  }
  // Nouveau jeu de donnees de test : on repart de zero
  Depot.effacer('absences');
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = init.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  nextEleveId = init.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  Depot.ecrireJSON('classes', liste || classes);
  Depot.ecrire('absenceTrackVersion', DEMO_VERSION);
  serveurEnvoiArrierePlan();
}

classes = chargerClasses();

