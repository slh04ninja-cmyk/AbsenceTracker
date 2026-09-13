# -*- coding: utf-8 -*-
"""AbsenceTrack v3.33 : page Absences du directeur SUPPRIMEE, remplacee par une page
Historique identique a celle du surveillant, en 2e position du nav (juste apres Dashboard).

- HTML : bloc page-dir-absences -> bloc page-dir-historique (memes elements que page-surv-classes,
  ids prefixees dir- : dir-recherche-eleve / dir-resultats-recherche / dir-historique-list)
- navs du directeur (page-directeur, page-dir-gestion, profil-nav-dir) : Dashboard | Historique |
  Gestion | Profil
- JS : afficherClassesSurv() devient generique afficherHistoriqueRegles(idConteneur) ; suppression du
  code mort afficherAbsencesDir / filterDirAbsences / filterDirActive ; justifierAbsence ne lit plus
  que les chips du popup (le select #dir-motif disparait avec la page)

PIEGE EVITE (v1 de ce script) : un regex du type "ligne Gestion .* ligne Absences" traverse les pages
et a supprime la page Profil. Ici les remplacements sont des chaines EXACTES de deux lignes adjacentes.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-42s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

def ligne_lien(page, icone, label, actif=False, this=True):
    return ('    <div class="nav-item%s" onclick="switchDirPage(\'%s\'%s)">'
            '<div class="nav-icon"><i class="fas fa-%s"></i></div><span>%s</span></div>\n'
            % (' active' if actif else '', page, ', this' if this else '', icone, label))

# ---------- 1. la page Absences devient la page Historique ----------
deb = s.index("<!-- PAGE ABSENCES (DIRECTEUR)")
fin = s.index("<!-- PAGE PROFILE (commune")
assert 'id="page-dir-absences"' in s[deb:fin] and 'dir-absences-body' in s[deb:fin]
print('OK   bloc page-dir-absences = %d caracteres' % (fin - deb))
assert 'id="page-profil"' in s[fin:], 'la page Profil doit rester apres la zone remplacee'

BLOC_HISTO = """<!-- PAGE HISTORIQUE (DIRECTEUR)                 -->
<!-- ============================================ -->
<div id="page-dir-historique" class="page-container">
  <div class="appbar">
    <button onclick="basculerTheme()" title="Mode sombre" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition justify-self-start">
      <i class="icone-theme fas fa-moon text-xl"></i>
    </button>
    <div class="appbar-title">Gestion d'absence</div>
    <button onclick="deconnexion()" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition justify-self-end">
      <i class="fas fa-sign-out-alt text-xl"></i>
    </button>
  </div>
  <div class="page-content page-with-nav page-with-appbar">
    <div class="p-4">
      <h2 class="text-center font-bold text-gray-800 mb-4" style="font-size: 18px;">Historique des absences</h2>
      <div class="stat-card mb-4">
        <label class="block text-sm font-bold text-blue-900 mb-2">Rechercher un élève</label>
        <input type="text" id="dir-recherche-eleve" oninput="rechercherEleves('dir-recherche-eleve', 'dir-resultats-recherche')" placeholder="Nom ou code MASSAR..." class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">
        <div id="dir-resultats-recherche" class="mt-3 space-y-2"></div>
      </div>
      <div id="dir-historique-list"></div>
    </div>
  </div>
  <div class="bottom-nav">
    <div class="nav-item" onclick="switchDirPage('directeur', this)"><div class="nav-icon"><i class="fas fa-home"></i></div><span>Dashboard</span></div>
    <div class="nav-item active" onclick="switchDirPage('dir-historique', this)"><div class="nav-icon"><i class="fas fa-history"></i></div><span>Historique</span></div>
    <div class="nav-item" onclick="switchDirPage('dir-gestion', this)"><div class="nav-icon"><i class="fas fa-cogs"></i></div><span>Gestion</span></div>
  
    <div class="nav-item" onclick="switchProfil(this)"><div class="nav-icon"><i class="fas fa-user-circle"></i></div><span>Profil</span></div>
  </div>
</div>

"""
s = s[:deb] + BLOC_HISTO + s[fin:]
assert s.count('id="page-profil"') == 1, 'page Profil perdue a l etape 1'

# ---------- 2. navs du directeur : Historique juste apres Dashboard ----------
# les deux lignes Gestion/Absences de chaque nav sont remplacees par Historique/Gestion,
# par chaines exactes (aucune regex qui puisse traverser une page)
navs = [
    ('nav page-directeur',  ligne_lien('dir-gestion', 'cogs', 'Gestion', False, True)),
    ('nav page-dir-gestion', ligne_lien('dir-gestion', 'cogs', 'Gestion', True,  True)),
    ('nav profil-nav-dir',  ligne_lien('dir-gestion', 'cogs', 'Gestion', False, False)),
]
for label, gest in navs:
    this = ', this' if 'this' in gest else ''
    absences = ('    <div class="nav-item" onclick="switchDirPage(\'dir-absences\'%s)">'
                '<div class="nav-icon"><i class="fas fa-clipboard-check"></i></div><span>Absences</span></div>\n' % this)
    histo = ligne_lien('dir-historique', 'history', 'Historique', False, bool(this))
    allok &= remplace(label, gest + absences, histo + gest)

assert s.count('id="page-profil"') == 1, 'page Profil perdue a l etape 2'

# ---------- 3. JS ----------
allok &= remplace('signature afficherHistoriqueRegles',
                  "function afficherClassesSurv() {\n  const div = document.getElementById('surv-classes-list');",
                  "function afficherHistoriqueRegles(idConteneur) {\n  const div = document.getElementById(idConteneur);")
allok &= remplace('appel surveillant',
                  "  if (page === 'surv-classes') afficherClassesSurv();",
                  "  if (page === 'surv-classes') afficherHistoriqueRegles('surv-classes-list');")
allok &= remplace('appel directeur (switchDirPage)',
                  "  if (page === 'dir-absences') afficherAbsencesDir();",
                  "  if (page === 'dir-historique') afficherHistoriqueRegles('dir-historique-list');")
allok &= remplace('motif = chips du popup',
                  "  const modalOuvert = !document.getElementById('modal-absence-detail').classList.contains('hidden');\n  const idMotif = (modalOuvert || source === 'surv') ? 'select-motif' : 'dir-motif';\n  const sel = document.getElementById(idMotif);",
                  "  const sel = document.getElementById('select-motif');")
allok &= remplace('rafraichissement apres justification dir',
                  "  if (source === 'dir') { afficherAbsencesDir(); mettreAJourDashboardDir(); }",
                  "  if (source === 'dir') mettreAJourDashboardDir();")

# ---------- 4. code mort ----------
d2 = s.index('// ========== DIRECTEUR — ABSENCES & JUSTIFICATION ==========')
f2 = s.index('// ========== DIRECTEUR — IMPORT MASSAR EXCEL ==========')
mort = s[d2:f2]
print('OK   code mort = %d caracteres' % len(mort))
assert 'afficherAbsencesDir' in mort and 'filterDirAbsences' in mort and 'dir-motif' not in mort
s = s[:d2] + s[f2:]
allok &= remplace('variable filterDirActive', "let filterDirActive = 'all';\n", "")
assert s.count('id="page-profil"') == 1, 'page Profil perdue a l etape 4'

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.32', 'AbsenceTrack v3.33', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.33 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('id="page-dir-absences"', 0), ('dir-absences-body', 0), ('id="dir-motif"', 0),
                     ('afficherAbsencesDir', 0), ('filterDirAbsences', 0), ('filterDirActive', 0),
                     ("switchDirPage('dir-absences'", 0), ('id="page-dir-historique"', 1),
                     ('id="dir-historique-list"', 1), ("rechercherEleves('dir-recherche-eleve'", 1),
                     ('id="dir-resultats-recherche"', 1), ('function afficherHistoriqueRegles', 1),
                     ("afficherHistoriqueRegles('dir-historique-list')", 1),
                     ("afficherHistoriqueRegles('surv-classes-list')", 1),
                     ("switchDirPage('dir-gestion'", 3), ('dir-absences-list', 2),
                     ('id="page-profil"', 1), ('profil-nom', 2), ('id="profil-nav-dir"', 1),
                     ('id="profil-nav-ens"', 1), ('id="profil-nav-surv"', 1),
                     ('id="page-surv-classes"', 1), ('id="page-dir-gestion"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-48s = %d' % (cle, n))
    allok &= (n == attendu)

# ordre du nav de chaque page directeur + page profil
for page, suivant in [('page-directeur', 'page-dir-gestion'), ('page-dir-gestion', 'page-dir-historique'),
                      ('page-dir-historique', 'page-profil'), ('page-profil', 'MODAL CONFIRMATION')]:
    i = s.index('id="%s"' % page)
    j = s.index(suivant if suivant.startswith('MODAL') else 'id="%s"' % suivant, i + 10)
    nav = s[i:j]
    ordre = [m.group(1) for m in re.finditer(r"switchDirPage\('(dir-[a-z]+|directeur)'", nav)]
    attendu = ['directeur', 'dir-historique', 'dir-gestion']
    print(('OK   ' if ordre == attendu else 'ECHEC') + ' ordre nav %-20s = %s' % (page, ordre))
    allok &= (ordre == attendu)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
