# -*- coding: utf-8 -*-
# patch_v4x.py -> v3.61 (partie 1/2)
# La page Profil devient "RH" pour le directeur :
#  - carte identite compacte + bouton "Profil" (a droite) -> popup (nom + mot de passe, conditions fusionnees)
#  - les reglages RH (Professeurs, Indisponibilite d'un enseignant) sont deplaces depuis Gestion
#  - mots de passe persistants (bug connu : le changement n'etait pas conserve)
import io, sys

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
# A. Deplacer les 2 cartes RH de Gestion vers la page Profil/RH
# ══════════════════════════════════════════════════════════════════
i_ind1 = s.index("      <!-- Indisponibilite d'un enseignant -->")
i_ind2 = s.index("      <!-- Importer fichier MASSAR -->")
bloc_indispo = s[i_ind1:i_ind2]
i_prof1 = s.index("      <!-- Professeurs -->")
i_prof2 = s.index("      <!-- Liste des classes -->")
bloc_profs = s[i_prof1:i_prof2]
assert 'id="indispo-card"' in bloc_indispo and 'id="dir-profs-list"' in bloc_profs, 'blocs introuvables'
print('%-52s OK' % 'blocs RH extraits (indispo + profs)')
# retrait (du plus loin au plus pres)
s = s[:i_prof1] + s[i_prof2:]
i_ind1 = s.index("      <!-- Indisponibilite d'un enseignant -->")
i_ind2 = s.index("      <!-- Importer fichier MASSAR -->")
s = s[:i_ind1] + s[i_ind2:]
print('%-52s OK' % 'cartes RH retirees de Gestion')

# ══════════════════════════════════════════════════════════════════
# B. Page Profil : carte identite compacte + bouton Profil
# ══════════════════════════════════════════════════════════════════
rep("""      <div class="stat-card mb-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="avatar" style="width: 56px; height: 56px; font-size: 24px;"><i class="fas fa-user"></i></div>
          <div>
            <p class="font-bold text-gray-800 text-lg" id="profil-nom">—</p>
            <p class="text-sm text-gray-500" id="profil-role">—</p>
          </div>
        </div>
      </div>""",
"""      <div class="stat-card mb-3 carte-settings" style="padding: 10px 14px;">
        <div class="flex items-center gap-3">
          <div class="avatar" style="width: 40px; height: 40px; font-size: 18px;"><i class="fas fa-user"></i></div>
          <div style="flex: 1; min-width: 0;">
            <p class="font-bold text-gray-800" id="profil-nom" style="font-size: 15px;">—</p>
            <p class="text-xs text-gray-500" id="profil-role">—</p>
          </div>
          <button type="button" id="btn-profil-dir" class="btn-mini-profil" style="display: none;" onclick="ouvrirProfilDir()"><i class="fas fa-user-cog"></i> Profil</button>
        </div>
      </div>""",
    1, 'carte identite compacte + bouton Profil')

# ══════════════════════════════════════════════════════════════════
# C. Fusion des champs mot de passe + conditions (formulaire de page)
# ══════════════════════════════════════════════════════════════════
rep("""      <div class="stat-card mb-4">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-key text-blue-900 mr-2"></i>Changer le mot de passe</h3>
        <div id="profil-error" class="hidden bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4 text-center"></div>
        <div id="profil-success" class="hidden bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 mb-4 text-center"></div>
        <div class="form-group">
          <label>Ancien mot de passe</label>
          <input type="password" id="profil-ancien" placeholder="••••••" autocomplete="current-password">
        </div>
        <div class="form-group">
          <label>Nouveau mot de passe</label>
          <input type="password" id="profil-nouveau" placeholder="Minimum 6 caractères" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label>Réécrire le nouveau mot de passe</label>
          <input type="password" id="profil-confirmer" placeholder="Confirmez le mot de passe" autocomplete="new-password">
        </div>
        <button onclick="changerMotDePasse()" class="btn-primary w-full btn-ripple">
          <i class="fas fa-save"></i> Enregistrer
        </button>
      </div>

      <div class="stat-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-info-circle text-blue-900 mr-2"></i>Conditions du mot de passe</h3>
        <ul class="text-sm text-gray-600 space-y-2">
          <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Minimum 6 caractères</li>
          <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Au moins une lettre (a-z, A-Z)</li>
          <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Au moins un chiffre (0-9)</li>
          <li><i class="fas fa-times-circle text-gray-400 mr-2"></i>Pas de caractères spéciaux obligatoires</li>
        </ul>
      </div>""",
"""      <div id="profil-mdp-page">
        <div class="stat-card carte-settings">
          <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-key text-blue-900 mr-2"></i>Changer le mot de passe</h3>
          <div id="profil-error" class="hidden bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2 mb-2 text-center"></div>
          <div id="profil-success" class="hidden bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg p-2 mb-2 text-center"></div>
          <div class="form-group">
            <label>Ancien mot de passe</label>
            <input type="password" id="profil-ancien" placeholder="••••••" autocomplete="current-password">
          </div>
          <div class="form-group">
            <label>Nouveau mot de passe</label>
            <input type="password" id="profil-nouveau" placeholder="Minimum 6 caractères" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label>Réécrire le nouveau mot de passe</label>
            <input type="password" id="profil-confirmer" placeholder="Confirmez le mot de passe" autocomplete="new-password">
          </div>
          <button onclick="changerMotDePasse()" class="btn-primary w-full btn-ripple">
            <i class="fas fa-save"></i> Enregistrer
          </button>
          <ul class="text-xs text-gray-600 space-y-1 mt-3">
            <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Minimum 6 caractères</li>
            <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Au moins une lettre (a-z, A-Z)</li>
            <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Au moins un chiffre (0-9)</li>
            <li><i class="fas fa-times-circle text-gray-400 mr-2"></i>Pas de caractères spéciaux</li>
          </ul>
        </div>
      </div>

      <!-- Rubriques RH (directeur) -->
      <div id="profil-rh" style="display: none;">
""" + bloc_profs + bloc_indispo + """      </div>""",
    1, 'fusion mdp + conditions + section RH')

# ══════════════════════════════════════════════════════════════════
# D. Nav du directeur : Profil -> RH
# ══════════════════════════════════════════════════════════════════
rep("""    <div class="nav-item" onclick="switchDirPage('dir-gestion')"><div class="nav-icon"><i class="fas fa-cogs"></i></div><span>Gestion</span></div>
    <div class="nav-item active" onclick="switchProfil(this)"><div class="nav-icon"><i class="fas fa-user-circle"></i></div><span>Profil</span></div>""",
"""    <div class="nav-item" onclick="switchDirPage('dir-gestion')"><div class="nav-icon"><i class="fas fa-cogs"></i></div><span>Gestion</span></div>
    <div class="nav-item active" onclick="switchProfil(this)"><div class="nav-icon"><i class="fas fa-users"></i></div><span>RH</span></div>""",
    1, 'nav directeur : Profil -> RH')

# ══════════════════════════════════════════════════════════════════
# E. CSS : bouton profil compact
# ══════════════════════════════════════════════════════════════════
rep("""    .tag-avenir {""",
"""    .btn-mini-profil { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; border: 2px solid var(--primary); background: transparent; color: var(--primary); font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
    .btn-mini-profil:hover { background: rgba(30,58,138,0.07); }
    body.theme-sombre .btn-mini-profil { border-color: #93c5fd; color: #93c5fd; }
    .tag-avenir {""",
    1, 'CSS : btn-mini-profil')

# ══════════════════════════════════════════════════════════════════
# F. Modale "Mon profil" (directeur)
# ══════════════════════════════════════════════════════════════════
rep("""<!-- MODAL ANNULATION DE SEANCE                      -->""",
"""<!-- MODAL MON PROFIL (DIRECTEUR)                     -->
<div id="modal-profil-dir" class="hidden fixed inset-0 modal-overlay flex items-center justify-center p-4" style="z-index: 300;">
  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl" style="max-height: 90vh; display: flex; flex-direction: column;">
    <div class="flex items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <span style="width: 28px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center">Mon profil</h2>
      <button onclick="fermerProfilDir()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" style="width: 28px; flex-shrink: 0; text-align: right;">&times;</button>
    </div>
    <div style="flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0;">
      <div class="px-4 pb-4 carte-settings">
        <p class="aide" id="mdpdir-email"></p>
        <div class="form-group">
          <label>Nom complet</label>
          <input type="text" id="mdpdir-nom" placeholder="Nom et prénom">
        </div>
        <hr class="my-3 border-gray-200">
        <p class="text-sm font-bold text-gray-700 sep-titre">Changer le mot de passe</p>
        <div id="mdpdir-error" class="hidden bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2 mb-2 text-center"></div>
        <div id="mdpdir-success" class="hidden bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg p-2 mb-2 text-center"></div>
        <div class="form-group">
          <label>Ancien mot de passe</label>
          <input type="password" id="mdpdir-ancien" placeholder="••••••" autocomplete="current-password">
        </div>
        <div class="form-group">
          <label>Nouveau mot de passe</label>
          <input type="password" id="mdpdir-nouveau" placeholder="Minimum 6 caractères" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label>Réécrire le nouveau mot de passe</label>
          <input type="password" id="mdpdir-confirmer" placeholder="Confirmez le mot de passe" autocomplete="new-password">
        </div>
        <ul class="text-xs text-gray-600 space-y-1 mt-1">
          <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Minimum 6 caractères</li>
          <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Au moins une lettre (a-z, A-Z)</li>
          <li><i class="fas fa-check-circle text-green-500 mr-2"></i>Au moins un chiffre (0-9)</li>
          <li><i class="fas fa-times-circle text-gray-400 mr-2"></i>Pas de caractères spéciaux</li>
        </ul>
      </div>
    </div>
    <div class="flex gap-3 px-4 pt-2 pb-5" style="flex-shrink: 0;">
      <button onclick="fermerProfilDir()" class="btn-fermer flex-1">Fermer</button>
      <button onclick="enregistrerProfilDir()" class="btn-primary flex-1"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  </div>
</div>

<!-- MODAL ANNULATION DE SEANCE                      -->""",
    1, 'modale Mon profil')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
