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
      const valid = comptes.find(c => c.email === compte.email && c.role === compte.role);
      if (valid) {
        utilisateurConnecte = valid;
        appliquerRoleTheme();
        if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); appliquerTableauService(); }
        else if (valid.role === 'surveillant') { afficherEcran('surveillant'); mettreAJourDashboardSurv(); afficherSeancesAnnulees(); }
        else if (valid.role === 'directeur') { afficherEcran('directeur'); mettreAJourDashboardDir(); afficherSeancesAnnulees(); }
        return;
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

