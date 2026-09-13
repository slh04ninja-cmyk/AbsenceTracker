# -*- coding: utf-8 -*-
# patch_v4m.py -> v3.51
# 1. Dashboard enseignant : suppression de la 3e div "Mon tableau de service"
# 2. Page Profil : ajout d'une div "Mon tableau de service" (toutes les seances de la semaine,
#    meme presentation que celle du Dashboard)
import io, sys

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-46s occurrences=%d (attendu %d) %s' % (nom or old[:40], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok: sys.exit(1)
    s = s.replace(old, new)

# ---------- 1. suppression de la carte du Dashboard enseignant ----------
rep("""        <div class="stat-card">
          <div class="stat-label mb-3">Mon tableau de service — <span id="ens-repos-jour"></span></div>
          <div id="ens-repos-creneaux" class="space-y-2"></div>
        </div>
""", "", 1, 'dashboard : carte supprimee')

# ---------- 2. nettoyage du renderer (code mort) ----------
rep("""// ===== Application au Dashboard enseignant =====
function afficherReposEnseignant() {
  const bloc = document.getElementById('ens-repos');
  if (!bloc) return;
  bloc.classList.remove('hidden');
  const email = emailUtilisateur();
  const jour = jourSemaineCourant();
  const duJour = creneauxDuJour(email, jour);
  const elJour = document.getElementById('ens-repos-jour');
  if (elJour) {
    elJour.textContent = NOMS_JOURS[jour].charAt(0).toUpperCase() + NOMS_JOURS[jour].slice(1) +
      ' — service ' + formatDureeService(heuresServiceMinutes(email)) + ' / 20 h';
  }
  const prochain = prochainCreneau(email);
  const elProchain = document.getElementById('ens-repos-prochain');
  if (elProchain) {
    elProchain.textContent = prochain
      ? 'Prochain cours : ' + prochain.quand + ' à ' + prochain.creneau.debut + ' · ' + prochain.creneau.classe
      : 'Aucun cours programmé';
  }
  const cont = document.getElementById('ens-repos-creneaux');
  if (cont) {
    cont.innerHTML = '';
    if (duJour.length === 0) {
      cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucun cours aujourd\\'hui.</p>';
    } else {
      duJour.forEach(c => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg';
        item.innerHTML = '<span class="font-medium text-gray-700">' + c.classe + '</span>' +
          '<span class="text-sm text-gray-500">' + c.debut + '–' + c.fin + (c.salle ? ' · ' + c.salle : '') + '</span>';
        cont.appendChild(item);
      });
    }
  }
}""",
"""// ===== Application au Dashboard enseignant =====
function afficherReposEnseignant() {
  const bloc = document.getElementById('ens-repos');
  if (!bloc) return;
  bloc.classList.remove('hidden');
  const prochain = prochainCreneau(emailUtilisateur());
  const elProchain = document.getElementById('ens-repos-prochain');
  if (elProchain) {
    elProchain.textContent = prochain
      ? 'Prochain cours : ' + prochain.quand + ' à ' + prochain.creneau.debut + ' · ' + prochain.creneau.classe
      : 'Aucun cours programmé';
  }
}

// ===== Tableau de service de la semaine (page Profil) =====
// Meme presentation que l'ancienne liste du Dashboard : classe a gauche, horaire a droite,
// regroupee par jour. Masque pour les roles sans tableau de service.
function afficherTableauServiceProfil() {
  const carte = document.getElementById('profil-service-card');
  if (!carte) return;
  const estProf = utilisateurConnecte && utilisateurConnecte.role === 'enseignant';
  const email = emailUtilisateur();
  const creneaux = estProf ? creneauxUtilisateur(email) : [];
  if (creneaux.length === 0) { carte.style.display = 'none'; return; }
  carte.style.display = 'block';
  const entete = document.getElementById('profil-service-entete');
  if (entete) entete.textContent = 'service ' + formatDureeService(heuresServiceMinutes(email)) + ' / 20 h';
  const cont = document.getElementById('profil-service-creneaux');
  if (!cont) return;
  cont.innerHTML = '';
  for (let d = 1; d <= 7; d++) {
    const liste = creneaux.filter(c => c.jour === d).sort((a, b) => hhmmEnMinutes(a.debut) - hhmmEnMinutes(b.debut));
    if (liste.length === 0) continue;
    const titre = document.createElement('div');
    titre.className = 'text-xs font-bold text-gray-500 mt-3 mb-1';
    titre.textContent = NOMS_JOURS[d].charAt(0).toUpperCase() + NOMS_JOURS[d].slice(1);
    cont.appendChild(titre);
    liste.forEach(c => {
      const item = document.createElement('div');
      item.className = 'flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg';
      item.innerHTML = '<span class="font-medium text-gray-700">' + c.classe + '</span>' +
        '<span class="text-sm text-gray-500">' + c.debut + '–' + c.fin + (c.salle ? ' · ' + c.salle : '') + '</span>';
      cont.appendChild(item);
    });
  }
}""", 1, 'renderer nettoye + fonction Profil')

# ---------- 3. carte dans la page Profil ----------
rep("""      <div class="stat-card mb-4">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-key text-blue-900 mr-2"></i>Changer le mot de passe</h3>""",
"""      <div class="stat-card mb-4" id="profil-service-card" style="display: none;">
        <div class="stat-label mb-3">Mon tableau de service — <span id="profil-service-entete"></span></div>
        <div id="profil-service-creneaux" class="space-y-2"></div>
      </div>

      <div class="stat-card mb-4">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-key text-blue-900 mr-2"></i>Changer le mot de passe</h3>""",
    1, 'page Profil : carte ajoutee')

# ---------- 4. appel a l'ouverture du Profil ----------
rep("""function switchProfil(el) {
  afficherEcran('profil');""",
"""function switchProfil(el) {
  afficherEcran('profil');
  afficherTableauServiceProfil();""", 1, 'appel dans switchProfil')

# ---------- 5. version ----------
rep('AbsenceTrack v3.50', 'AbsenceTrack v3.51', 1, 'label v3.51')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
