// fichier: app/js/14-theme-lots.js
// ========== LOTS DE COULEURS PAR ROLE (thème clair) ==========
// Theme clair unique (les 3 roles partagent la meme palette)
const LOT_CLAIR = {
  fond: '#F4F6FA', primaire: '#26395A', fonce: '#6E7E93', accent: '#E15F67',
  clair: '#EDF1F7', bordure: '#D7E0EA', neutre: '#6E7E93', secondaire: '#0C829F'
};
const LOTS_ROLE = { enseignant: LOT_CLAIR, surveillant: LOT_CLAIR, directeur: LOT_CLAIR };

// Absence = toujours ROUGE, Retard = toujours ORANGE (+ degradations)
const COULEUR_ABSENCE = '#ef4444';
const COULEUR_RETARD = '#f59e0b';

function appliquerRoleTheme() {
  const b = document.body.classList;
  b.remove('role-enseignant', 'role-surveillant', 'role-directeur');
  if (utilisateurConnecte && utilisateurConnecte.role) b.add('role-' + utilisateurConnecte.role);
}

function couleursAbsRd() {
  return { abs: COULEUR_ABSENCE, rd: COULEUR_RETARD };
}

function eclaircir(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const melange = c => Math.round(c + (255 - c) * ratio);
  return '#' + [melange(r), melange(v), melange(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function teinte(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b2 = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + v + ',' + b2 + ',' + alpha + ')';
}

// ========== MOTIF DE JUSTIFICATION ==========
function choisirMotif(motif, el) {
  const champ = document.getElementById('select-motif');
  if (champ) champ.value = motif;
  document.querySelectorAll('#chips-motif .motif-chip').forEach(c => c.classList.remove('actif'));
  if (el) el.classList.add('actif');
}

// ========== HAUTEUR DE LA BARRE DU HAUT ==========
function ajusterHauteurAppbar() {
  // Les barres des pages masquees ont une hauteur de 0 : on prend la plus grande
  let h = 0;
  document.querySelectorAll('.appbar').forEach(b => { if (b.offsetHeight > h) h = b.offsetHeight; });
  if (h > 0) document.documentElement.style.setProperty('--appbar-h', h + 'px');
}
window.addEventListener('resize', ajusterHauteurAppbar);
window.addEventListener('orientationchange', ajusterHauteurAppbar);

