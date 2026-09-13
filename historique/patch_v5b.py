# -*- coding: utf-8 -*-
# patch_v5b.py -> v3.64
# 1. Le controle segmente (.mode-segments) devient un composant generique reutilisable (basculerSegments)
#    et sert dans la carte Personnel (RH) : vue Professeurs / vue Surveillants
# 2. La liste affiche 6 cartes avant defilement (cartes de 44px + max-height 286px)
# 3. Correction : l'onglet RH s'affiche sur TOUTES les pages du directeur (plus "Profil" ailleurs)
import io, sys, re

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-52s occurrences=%d (attendu %d) %s' % (nom or old[:46], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok: sys.exit(1)
    s = s.replace(old, new)

# ══════════════════════════════════════════════════════════════════
# 1. Onglet RH sur toutes les pages du directeur
# ══════════════════════════════════════════════════════════════════
rep("""<span>Gestion</span></div>
  
    <div class="nav-item" onclick="switchProfil(this)"><div class="nav-icon"><i class="fas fa-user-circle"></i></div><span>Profil</span></div>""",
"""<span>Gestion</span></div>
  
    <div class="nav-item" onclick="switchProfil(this)"><div class="nav-icon"><i class="fas fa-users"></i></div><span>RH</span></div>""",
    4, 'onglet RH sur les 4 pages du directeur')

# ══════════════════════════════════════════════════════════════════
# 2. Carte "Personnel" avec segments Professeurs / Surveillants
# ══════════════════════════════════════════════════════════════════
rep("""      <!-- Professeurs -->
      <div class="stat-card mb-4 carte-settings">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-chalkboard-teacher text-blue-900 mr-2"></i>Professeurs</h3>
        <p class="text-sm text-gray-500 mb-3">Corriger le nom d'un enseignant : il est mis à jour partout, y compris dans l'historique des signalements.</p>
        <div id="dir-profs-list" class="liste-reglages"></div>
      </div>""",
"""      <!-- Personnel : professeurs + surveillants -->
      <div class="stat-card mb-4 carte-settings" id="personnel-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-users text-blue-900 mr-2"></i>Personnel</h3>
        <p class="aide">Corriger le nom d'un compte, définir ou générer son mot de passe de connexion : la modification s'applique partout, y compris dans l'historique des signalements.</p>
        <div class="mode-segments" id="seg-personnel">
          <button type="button" id="seg-profs" class="mode-btn actif" onclick="basculerSegments('seg-personnel', 'seg-profs')"><i class="fas fa-chalkboard-teacher"></i> Professeurs</button>
          <button type="button" id="seg-surveillants" class="mode-btn" onclick="basculerSegments('seg-personnel', 'seg-surveillants')"><i class="fas fa-user-shield"></i> Surveillants</button>
        </div>
        <div id="vue-profs" class="seg-vue">
          <div id="dir-profs-list" class="liste-reglages"></div>
        </div>
        <div id="vue-surveillants" class="seg-vue" style="display: none;">
          <div id="dir-surveillants-list" class="liste-reglages"></div>
        </div>
      </div>""",
    1, 'carte Personnel + segments')

# ══════════════════════════════════════════════════════════════════
# 3. CSS : 6 cartes visibles avant defilement
# ══════════════════════════════════════════════════════════════════
rep("""    #annul-card #annul-liste {""",
"""    /* 6 cartes visibles avant defilement (6 x (44 + 4) = 288 -> 286 pour couper juste apres la 6e) */
    #dir-profs-list, #dir-surveillants-list { max-height: 286px; }
    #annul-card #annul-liste {""",
    1, 'CSS : 6 cartes avant scrolling')

# ══════════════════════════════════════════════════════════════════
# 4. JS : composant segmente generique + cartes de comptes
# ══════════════════════════════════════════════════════════════════
rep("""// ========== PROFESSEURS (liste + renommage, directeur) ==========
let profARenommer = null;
function afficherListeProfs() {
  const cont = document.getElementById('dir-profs-list');
  if (!cont) return;
  cont.innerHTML = '';
  comptes.filter(c => c.role === 'enseignant').forEach(c => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.style = 'min-height: 40px; gap: 8px;';
    item.innerHTML = '<div style="min-width: 0; overflow: hidden;">' +
      '<p class="font-medium text-gray-700" style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (c.nom || '') + '</p>' +
      '<p class="text-xs text-gray-500" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (c.matiere || '') + ' · ' + (c.email || '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.innerHTML = '<i class="fas fa-pen mr-1"></i>Modifier';
    b.onclick = () => ouvrirRenommageProf(c.code);
    item.appendChild(b);
    cont.appendChild(item);
  });
}""",
"""// ========== COMPOSANT SEGMENTE (reutilisable) ==========
// Les boutons .mode-btn de #<idConteneur> pilotent les vues #vue-<suffixe> de la meme carte.
function basculerSegments(idConteneur, idActif) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;
  const racine = conteneur.parentElement || document;
  const boutons = conteneur.querySelectorAll('.mode-btn');
  for (let i = 0; i < boutons.length; i++) boutons[i].classList.toggle('actif', boutons[i].id === idActif);
  const suffixe = String(idActif || '').replace(/^seg-/, '');
  const vues = racine.querySelectorAll('.seg-vue');
  for (let i = 0; i < vues.length; i++) vues[i].style.display = 'none';
  const cible = document.getElementById('vue-' + suffixe);
  if (cible) cible.style.display = 'block';
}

// ========== PERSONNEL : professeurs + surveillants (liste + modification, directeur) ==========
let profARenommer = null;
// Une carte de compte : hauteur fixe (6 cartes visibles avant defilement)
function carteCompte(c) {
  const item = document.createElement('div');
  item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
  item.style = 'height: 44px; box-sizing: border-box; padding: 0 10px; gap: 8px;';
  const sousTitre = (c.matiere ? c.matiere + ' · ' : '') + (c.email || '');
  item.innerHTML = '<div style="min-width: 0; overflow: hidden;">' +
    '<p class="font-medium text-gray-700" style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (c.nom || '') + '</p>' +
    '<p class="text-xs text-gray-500" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + sousTitre + '</p></div>';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-inline flex-shrink-0';
  b.style = 'color: #1d4ed8;';
  b.innerHTML = '<i class="fas fa-pen mr-1"></i>Modifier';
  b.onclick = () => ouvrirRenommageProf(c.code || c.email);
  item.appendChild(b);
  return item;
}
function afficherComptes(idConteneur, role) {
  const cont = document.getElementById(idConteneur);
  if (!cont) return;
  cont.innerHTML = '';
  const liste = comptes.filter(c => c.role === role);
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-500 text-center py-1">Aucun compte.</p>';
    return;
  }
  liste.forEach(c => cont.appendChild(carteCompte(c)));
}
function afficherListeProfs() {
  afficherComptes('dir-profs-list', 'enseignant');
  afficherComptes('dir-surveillants-list', 'surveillant');
}""",
    1, 'JS : segments generiques + cartes de comptes')

# 5. ouvrirRenommageProf / confirmerRenommageProf : cle = code ou email (surveillants inclus)
rep("""function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code);
  if (!c) return;
  profARenommer = code;
  const champ = document.getElementById('renommer-nom');
  if (champ) champ.value = c.nom || '';
  const info = document.getElementById('renommer-info');
  if (info) info.textContent = (c.matiere || '') + ' · ' + code;""",
"""function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code || x.email === code);
  if (!c) return;
  profARenommer = c.code || c.email;
  const titre = document.getElementById('renommer-titre');
  if (titre) titre.textContent = c.role === 'surveillant' ? 'Nom du surveillant' : "Nom de l'enseignant";
  const champ = document.getElementById('renommer-nom');
  if (champ) champ.value = c.nom || '';
  const info = document.getElementById('renommer-info');
  if (info) info.textContent = (c.matiere ? c.matiere + ' · ' : '') + (c.role === 'surveillant' ? 'Surveillant' : c.code || '');""",
    1, 'ouvrirRenommageProf : surveillants')

rep("""  const prof = comptes.find(c => c.code === code);
  const ancien = prof ? prof.nom : '';
  nomsProfs[code] = nouveau;
  sauvegarderNomsProfs();
  if (prof) prof.nom = nouveau;""",
"""  const prof = comptes.find(c => c.code === code || c.email === code);
  const ancien = prof ? prof.nom : '';
  nomsProfs[prof ? (prof.code || prof.email) : code] = nouveau;
  sauvegarderNomsProfs();
  if (prof) prof.nom = nouveau;""",
    1, 'confirmerRenommageProf : cle code ou email')

rep("""  absences.forEach(a => {
    if (a.profCode === code || (ancien && a.enseignant === ancien)) { a.enseignant = nouveau; maj++; }
  });""",
"""  const codeProf = prof ? prof.code : code;
  absences.forEach(a => {
    if ((codeProf && a.profCode === codeProf) || (ancien && a.enseignant === ancien)) { a.enseignant = nouveau; maj++; }
  });""",
    1, 'confirmerRenommageProf : propagation par code')

# titre dynamique dans la modale
rep("""      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center">Nom de l'enseignant</h2>""",
"""      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center" id="renommer-titre">Nom de l'enseignant</h2>""",
    1, 'modale : titre dynamique')

# ══════════════════════════════════════════════════════════════════
# 6. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.63', 'AbsenceTrack v3.64', 1, 'label v3.64')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
