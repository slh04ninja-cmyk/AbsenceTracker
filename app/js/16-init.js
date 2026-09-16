// fichier: app/js/16-init.js
// ========== INIT ==========
function init() {
  if (typeof appliquerModeEcole === 'function') appliquerModeEcole();
  // Cloisonnement des ecoles : les listes de travail d'une AUTRE ecole ne s'affichent pas ici.
  if (typeof appliquerEcoleAuxListes === 'function') appliquerEcoleAuxListes();
  // nettoyage des restes des versions precedentes (seances deduites enregistrees a tort)
  if (typeof purgerAnnulationsDeduitesEnregistrees === 'function') purgerAnnulationsDeduitesEnregistrees();
  // Rafraichissement automatique : telephone et base restent d'accord (toutes les 5 s).
  if (typeof demarrerRafraichissementAuto === 'function') demarrerRafraichissementAuto(5);
  // relecture de la liste des surveillants AVANT de la reinjecter dans les comptes
  // (sans cette ligne, un surveillant ajoute disparaissait au redemarrage)
  surveillantsRH = chargerSurveillantsRH();
  appliquerNomsProfs();
  appliquerMotsDePasse(); appliquerListeSurveillants();
  majEtiquetteAnnee();
  majOptionsSemestres();
  // L'historique de demonstration ne se fabrique que sur un telephone de demonstration.
  // Une ecole livree commence VIDE.
  if (modeDemonstration()) genererDonneesTestHistorique();
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
  // en mode ecole, une session deja ouverte se rouvre toute seule (on voit la page du role)
  if (typeof estModeEcole === 'function' && estModeEcole()) {
    afficherEcran('login');
    rouvrirSessionSiBesoin();
    return;
  }
  afficherEcran('login');
}

// Enter key pour login
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('page-login').classList.contains('active')) {
    connexion();
  }
});

// init() est appele par le DERNIER module (18-connexion.js) : lance ici, il tombait avant
// que les fonctions du serveur soient declarees (defaut trouve par le banc v4.03).

