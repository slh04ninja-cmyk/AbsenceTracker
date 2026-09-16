// fichier: app/js/01-chargement.js
// ========== DEPOT — LA SEULE PORTE VERS LE STOCKAGE ==========
// Toutes les lectures et ecritures de donnees passent par ici : aucun `localStorage` ailleurs
// dans l'application (verifie par les tests). C'est CETTE porte qu'on remplacera par Supabase,
// sans toucher au reste du code : les modules continueront d'appeler Depot.lire/ecrire.
// DEUX ESPACES SEPARES : le PROTOTYPE (page ouverte seule) garde ses donnees dans
// l'espace d'origine ; l'APPLICATION ANDROID reliee a la base ecrit dans SON espace
// (prefixe « app: »). L'application ne modifie donc jamais les donnees du prototype,
// et le prototype ne touche jamais aux siennes. En lecture, l'application retombe une
// fois sur l'ancien emplacement (rien ne disparait en passant).
function atPrefixeStockage() {
  try { return localStorage.getItem('installationServeur') === '1' ? 'app:' : ''; } catch (e) { return ''; }
}
const Depot = {
  // valeur brute (chaine) ou `defaut` si absente / impossible a lire
  lire(cle, defaut) {
    const rien = (defaut === undefined ? null : defaut);
    try {
      const pre = atPrefixeStockage();
      if (pre) {
        const v = localStorage.getItem(pre + cle);
        if (v !== null) return v;
        const ancien = localStorage.getItem(cle);        // reprise unique de l'ancien emplacement
        return ancien !== null ? ancien : rien;
      }
      const v0 = localStorage.getItem(cle);
      return v0 === null ? rien : v0;
    } catch (e) { return rien; }
  },
  // objet ou tableau ; `defaut` si absent ou illisible (jamais d'exception)
  lireJSON(cle, defaut) {
    const v = Depot.lire(cle, null);
    if (v === null) return defaut;
    try {
      const obj = JSON.parse(v);
      return obj === null ? defaut : obj;
    } catch (e) { return defaut; }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem(atPrefixeStockage() + cle, valeur); return true; }
    catch (e) { console.warn('Depot : ecriture impossible pour ' + cle, e); return false; }
  },
  ecrireAncien(cle, valeur) {
    try { localStorage.setItem(cle, valeur); return true; }
    catch (e) { console.warn('Depot : ecriture impossible pour ' + cle, e); return false; }
  },
  ecrireJSON(cle, valeur) {
    const r = Depot.ecrire(cle, JSON.stringify(valeur));
    // Toute liste de TRAVAIL qui change sur le telephone part dans la base (22-sync.js).
    if (['absences', 'classes', 'indispoProfs', 'seancesAnnulees', 'fermeturesEtab', 'tableauxService_v2'].indexOf(cle) >= 0) {
      if (typeof atSynchroAuto === 'function') atSynchroAuto(cle === 'tableauxService_v2' ? 'seances' : cle);
    }
    return r;
  },
  effacer(cle) { try { localStorage.removeItem(atPrefixeStockage() + cle); localStorage.removeItem(cle); } catch (e) {} },
  effacerTout() { try { localStorage.clear(); } catch (e) {} }     // « repartir du serveur »
};
// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========
let classes = [];
let nextClasseId = 1;
let nextEleveId = 1;

const DEMO_VERSION = 'v3.0';

// Les donnees de DEMONSTRATION (classes + historique) ne se chargent QUE si on le demande :
//   - le telephone de l'utilisateur qui veut une demo : Depot.ecrire('modeDemonstration', '1') ;
//   - une ecole livree n'a AUCUNE donnee de test : elle commence vide et importe ses listes.
function modeDemonstration() { return Depot.lire('modeDemonstration', null) === '1'; }

function chargerClasses() {
  const sauve = Depot.lire('classes', null);
  const version = Depot.lire('absenceTrackVersion', null);
  if (sauve) {
    try {
      const liste = JSON.parse(sauve);
      if (Array.isArray(liste) && liste.length > 0) {
        // REGLE : ce qui est enregistre n'est JAMAIS perdu. On ne remplace l'enregistrement
        // que sur le telephone de demonstration, quand la demonstration elle-meme a change.
        if (!modeDemonstration() || version === DEMO_VERSION) {
          nextClasseId = liste.reduce((m, c) => Math.max(m, c.id), 0) + 1;
          nextEleveId = liste.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
          return liste;
        }
      }
    } catch (e) {}
  }
  // Rien a reprendre : ecole (on part VIDE) ou telephone de demonstration (on pose le jeu de test)
  if (!modeDemonstration()) return [];
  Depot.effacer('absences');
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = init.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  nextEleveId = init.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  if (typeof etiqueterSiVierge === 'function') etiqueterSiVierge();
  Depot.ecrireJSON('classes', liste || classes);
  Depot.ecrire('absenceTrackVersion', DEMO_VERSION);
}

classes = chargerClasses();

