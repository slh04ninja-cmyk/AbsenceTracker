// fichier: app/js/16-init.js
// ========== INIT ==========
function init() {
  // relecture de la liste des surveillants AVANT de la reinjecter dans les comptes
  // (sans cette ligne, un surveillant ajoute disparaissait au redemarrage)
  surveillantsRH = chargerSurveillantsRH();
  appliquerNomsProfs();
  appliquerMotsDePasse(); appliquerListeSurveillants();
  majEtiquetteAnnee();
  majOptionsSemestres();
  genererDonneesTestHistorique();
  const saved = Depot.lire('utilisateur', null);
  if (saved) {
    try {
      const compte = JSON.parse(saved);
      if (compte && compte.serveur) {
        // Compte du SERVEUR : on le reprend tel quel tant que le jeton est encore la.
        serveurChargerSession();
        if (SERVEUR.session) { connecterReussi(compte); return; }
      } else {
        const valid = comptes.find(c => c.email === compte.email && c.role === compte.role);
        if (valid) { connecterReussi(valid); return; }
      }
    } catch(e) {}
  }
  afficherEcran('login');
}

// Enter key pour login
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('page-login').classList.contains('active')) {
    connexion();
  }
});

init();

