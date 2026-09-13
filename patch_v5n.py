# -*- coding: utf-8 -*-
"""patch_v5n.py -> v3.76

La page « Rapports » du surveillant devient sa page « Stats », IDENTIQUE a celle du
directeur. Plutot que de dupliquer 30 identifiants et tout le rendu (deux copies a
maintenir, deux risques de divergence), on garde UN SEUL bloc de statistiques
(#stats-commun) et on le DEPLACE dans la page affichee :
  - directeur : #dir-stats-conteneur
  - surveillant : #surv-stats-conteneur
Une seule fonction de rendu (afficherStatistiquesDir) sert donc les deux roles :
les ecrans sont forcement identiques, aujourd'hui et apres toute modification future.

La page « Rapports » et son code mort (genererRapport, #rapport-date, #rapports-list)
sont supprimes.
"""
import io, re, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
ok = True

def sub(ancien, nouveau, label, attendu=1):
    global html, ok
    n = html.count(ancien)
    if n != attendu:
        print('!! %s : %d occurrence(s) (attendu %d)' % (label, n, attendu)); ok = False; return
    html = html.replace(ancien, nouveau)
    print('OK %s : %d' % (label, n))

# ============================================================================
# 1. Le bloc de statistiques du directeur devient un bloc COMMUN (#stats-commun)
# ============================================================================
sub("""  <div class="page-content page-with-nav page-with-appbar">
    <div class="p-4">
      <h2 class="text-center font-bold text-gray-800 mb-4" style="font-size: 18px;">Statistiques de l'établissement</h2>""",
"""  <div class="page-content page-with-nav page-with-appbar">
    <div class="p-4" id="dir-stats-conteneur">
    <!-- BLOC COMMUN avec la page Stats du surveillant : il est déplacé ici ou là
         selon l'écran affiché (un seul jeu d'identifiants, un seul rendu). -->
    <div id="stats-commun">
      <h2 class="text-center font-bold text-gray-800 mb-4" style="font-size: 18px;">Statistiques de l'établissement</h2>""",
    'ouverture du bloc commun')

sub("""        <div id="dir-top-absents" class="space-y-2"></div>
      </div>
    </div>
  </div>
  <div class="bottom-nav">""",
"""        <div id="dir-top-absents" class="space-y-2"></div>
      </div>
    </div>
    <!-- fin du bloc commun -->
    </div>
  </div>
  <div class="bottom-nav">""",
    'fermeture du bloc commun')

# ============================================================================
# 2. La page « Rapports » du surveillant devient « Stats » (conteneur vide)
# ============================================================================
sub('<div id="page-surv-rapports" class="page-container">',
    '<div id="page-surv-stats" class="page-container">',
    'renommage de la page surv-rapports -> surv-stats')

sub("""  <div class="page-content page-with-nav page-with-appbar">
    <div class="p-4">
      <div class="stat-card mb-4">
        <div class="form-group">
          <label>Date du rapport</label>
          <input type="date" id="rapport-date">
        </div>
        <button onclick="genererRapport()" class="btn-primary w-full">
          <i class="fas fa-download"></i> Générer le rapport
        </button>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Rapports récents</div>
        <div id="rapports-list" class="space-y-2">
          <p class="text-gray-500 text-center py-8">Aucun rapport généré</p>
        </div>
      </div>
    </div>
  </div>""",
"""  <div class="page-content page-with-nav page-with-appbar">
    <!-- Le contenu est celui de la page Stats du directeur : le bloc commun y est
         déplacé à l'ouverture (voir placerStatsCommun). -->
    <div class="p-4" id="surv-stats-conteneur"></div>
  </div>""",
    'contenu de la page surv-stats')

# ============================================================================
# 3. Les onglets du surveillant : « Rapports » -> « Stats » + icône graphique
# ============================================================================
nav_normal = ('<div class="nav-item" onclick="switchSurvPage(\'surv-rapports\', this)">'
              '<div class="nav-icon"><i class="fas fa-file-pdf"></i></div><span>Rapports</span></div>')
nav_nouveau = ('<div class="nav-item" onclick="switchSurvPage(\'surv-stats\', this)">'
               '<div class="nav-icon"><i class="fas fa-chart-bar"></i></div><span>Stats</span></div>')
sub(nav_normal, nav_nouveau, 'onglet Stats (nav simples)', attendu=2)

sub('<div class="nav-item active" onclick="switchSurvPage(\'surv-rapports\', this)">'
    '<div class="nav-icon"><i class="fas fa-file-pdf"></i></div><span>Rapports</span></div>',
    '<div class="nav-item active" onclick="switchSurvPage(\'surv-stats\', this)">'
    '<div class="nav-icon"><i class="fas fa-chart-bar"></i></div><span>Stats</span></div>',
    'onglet Stats (nav active)')

sub('<div class="nav-item" onclick="switchSurvPage(\'surv-rapports\')">'
    '<div class="nav-icon"><i class="fas fa-file-pdf"></i></div><span>Rapports</span></div>',
    '<div class="nav-item" onclick="switchSurvPage(\'surv-stats\')">'
    '<div class="nav-icon"><i class="fas fa-chart-bar"></i></div><span>Stats</span></div>',
    'onglet Stats (nav profil)')

# ============================================================================
# 4. JS : deplacer le bloc commun + rendre les statistiques
# ============================================================================
sub("""  if (page === 'dir-stats') afficherStatistiquesDir();""",
"""  if (page === 'dir-stats') { placerStatsCommun('dir-stats-conteneur'); afficherStatistiquesDir(); }""",
    'switchDirPage : deplacement + rendu')

sub("""  if (page === 'surv-classes') afficherHistoriqueRegles('surv-classes-list');
  if (page === 'surv-rapports') {}""",
"""  if (page === 'surv-classes') afficherHistoriqueRegles('surv-classes-list');
  if (page === 'surv-stats') { placerStatsCommun('surv-stats-conteneur'); afficherStatistiquesDir(); }""",
    'switchSurvPage : deplacement + rendu')

# la fonction de deplacement, placee avant switchDirPage
sub("""function switchDirPage(page, el) {""",
"""// Statistiques : la MEME page pour le directeur et le surveillant. Un seul bloc
// (#stats-commun) est deplace dans la page affichee, donc un seul jeu d'identifiants
// et un seul rendu : les deux ecrans ne peuvent pas diverger.
function placerStatsCommun(idConteneur) {
  const bloc = document.getElementById('stats-commun');
  const cible = document.getElementById(idConteneur);
  if (bloc && cible && bloc.parentNode !== cible) cible.appendChild(bloc);
}

function switchDirPage(page, el) {""",
    'fonction placerStatsCommun')

# ============================================================================
# 5. Suppression du code mort de l'ancienne page Rapports
# ============================================================================
m = re.search(r'\nfunction genererRapport\(\)[\s\S]*?\n\}\n', html)
if m:
    html = html.replace(m.group(0), '\n')
    print('OK supprime genererRapport() (code mort)')
else:
    print('!! genererRapport() introuvable'); ok = False

for reste in ['rapport-date', 'rapports-list', "surv-rapports", 'genererRapport']:
    n = html.count(reste)
    if n:
        print('!! residu %s : %d' % (reste, n)); ok = False
    else:
        print('OK plus aucune trace de %s' % reste)

# ============================================================================
# 6. label de version
# ============================================================================
sub('AbsenceTrack v3.75', 'AbsenceTrack v3.76', 'label v3.76')

if not ok:
    print('=== PATCH ANNULE ==='); sys.exit(1)

shutil.copyfile(F, 'AbsenceTrack-v3.75-backup.html')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)  backup AbsenceTrack-v3.75-backup.html' % (F, len(html.encode('utf-8'))))
