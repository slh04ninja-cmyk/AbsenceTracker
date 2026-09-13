# -*- coding: utf-8 -*-
"""patch_v5r.py -> v3.79

UN SEUL bouton pour le mot de passe, meme place et meme taille, dont le libelle et
l'action dependent de la situation :
  - CREATION (ajouter un surveillant)      -> « Generer »      (remplit le champ)
  - MODIFICATION (depuis une carte)        -> « Reinitialiser »  (nouveau mot de passe
    applique tout de suite, affiche en grand, avec fiche PDF)

L'ancien petit bouton « Generer » a cote du champ est supprime : il faisait doublon.
Le bouton unique garde le meme identifiant, donc la meme position et la meme taille dans
les deux cas ; seul son contenu change (libelle + icone).
"""
import io, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
ok = True

def sub(ancien, nouveau, label, attendu=1):
    global html, ok
    n = html.count(ancien)
    if n != attendu:
        print('!! %s : %d occurrence(s) (attendu %d)' % (label, n, attendu)); ok = False; return
    html = html.replace(ancien, nouveau)
    print('OK %s' % label)

# ============================================================================
# 1. HTML — on retire le petit bouton « Générer » à côté du champ
# ============================================================================
sub("""        <div class="flex gap-2">
          <input type="text" id="renommer-mdp" placeholder="8 caractères (lettres + chiffres)" style="flex: 1; min-width: 0;">
          <button type="button" onclick="genererMotDePasseProf()" class="btn-mini-profil" style="border-color: #059669; color: #059669;"><i class="fas fa-dice"></i> Générer</button>
        </div>""",
"""        <input type="text" id="renommer-mdp" placeholder="8 caractères (lettres + chiffres)" style="width: 100%;">""",
    'suppression du petit bouton Générer')

# ============================================================================
# 2. HTML — le bouton unique (même place, même taille dans les deux situations)
# ============================================================================
sub("""      <button type="button" class="w-full mb-3 btn-fermer" style="border: 2px solid var(--primary); color: var(--primary); background: transparent;" onclick="reinitialiserMotDePasse()">
        <i class="fas fa-rotate-right"></i> Réinitialiser le mot de passe
      </button>""",
"""      <!-- Bouton UNIQUE du mot de passe : « Générer » à la création, « Réinitialiser » à
           la modification. Même place, même taille ; seul le libellé change. -->
      <button type="button" id="btn-mdp-action" class="w-full mb-3 btn-fermer" style="border: 2px solid var(--primary); color: var(--primary); background: transparent;" onclick="actionMotDePasse()">
        <i class="fas fa-rotate-right"></i> Réinitialiser
      </button>""",
    'bouton unique avec identifiant')

# ============================================================================
# 3. JS — aiguillage + libellé selon la situation
# ============================================================================
code = r'''
// ========== BOUTON UNIQUE DU MOT DE PASSE ==========
// « Générer » à la CRÉATION (il n'y a rien à réinitialiser) : il remplit le champ.
// « Réinitialiser » à la MODIFICATION : il applique un nouveau mot de passe.
// Un seul bouton, même place et même taille — seul le libellé change.
function libelleActionMdp() {
  const b = document.getElementById('btn-mdp-action');
  if (!b) return;
  b.innerHTML = creationProfil
    ? '<i class="fas fa-dice"></i> Générer'
    : '<i class="fas fa-rotate-right"></i> Réinitialiser';
}
function actionMotDePasse() {
  if (creationProfil) { genererMotDePasseProf(); return; }
  reinitialiserMotDePasse();
}
'''
sub("""// ========== RÉINITIALISATION D'UN MOT DE PASSE (oubli) ==========""",
    code.strip() + "\n\n// ========== RÉINITIALISATION D'UN MOT DE PASSE (oubli) ==========",
    'aiguillage du bouton unique')

# le libellé suit la situation à l'ouverture de la fenêtre
sub("""  // on repart d'un affichage vierge : pas de mot de passe réinitialisé de la fois d'avant
  dernierReset = null;""",
"""  libelleActionMdp();          // « Réinitialiser » (on modifie une personne existante)
  // on repart d'un affichage vierge : pas de mot de passe réinitialisé de la fois d'avant
  dernierReset = null;""",
    'libellé en mode modification')

sub("""  const rb = document.getElementById('renommer-reset');  if (rb) rb.classList.add('hidden');""",
"""  const rb = document.getElementById('renommer-reset');  if (rb) rb.classList.add('hidden');
  libelleActionMdp();          // « Générer » (on crée une personne : rien à réinitialiser)""",
    'libellé en mode création')

# ============================================================================
# 4. label
# ============================================================================
sub('AbsenceTrack v3.78', 'AbsenceTrack v3.79', 'label v3.79')

if not ok:
    print('=== PATCH ANNULE ==='); sys.exit(1)

shutil.copyfile(F, 'AbsenceTrack-v3.78-backup.html')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)  backup AbsenceTrack-v3.78-backup.html' % (F, len(html.encode('utf-8'))))
