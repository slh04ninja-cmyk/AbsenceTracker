// fichier: app/js/01-chargement.js
// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========
let classes = [];
let nextClasseId = 1;
let nextEleveId = 1;

const DEMO_VERSION = 'v3.0';

function chargerClasses() {
  const sauve = localStorage.getItem('classes');
  const version = localStorage.getItem('absenceTrackVersion');
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
  localStorage.removeItem('absences');
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = init.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  nextEleveId = init.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  localStorage.setItem('classes', JSON.stringify(liste || classes));
  localStorage.setItem('absenceTrackVersion', DEMO_VERSION);
}

classes = chargerClasses();

