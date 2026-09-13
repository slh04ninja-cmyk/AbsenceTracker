# -*- coding: utf-8 -*-
# patch_v4z.py -> v3.62
# 1. Cartes de la div Professeurs reglees (+ boutons de liste compacts marques .btn-inline)
# 2. Hauteur UNIQUE pour tous les boutons d'action de l'application (--btn-h)
# 3. Ouverture plus rapide : xlsx charge a la demande, Font Awesome non bloquant, polling des listes ralenti
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
# 1. PERFORMANCE : xlsx a la demande + Font Awesome non bloquant
# ══════════════════════════════════════════════════════════════════
rep("""  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>\n""",
    "", 1, 'perf : script xlsx retire du <head>')

rep("""  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">""",
"""  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" media="print" onload="this.media='all'">""",
    1, 'perf : Font Awesome non bloquant')

rep("""// ========== LIBELLES ==========""",
"""// ========== LECTEUR EXCEL (charge a la demande : l'ouverture de l'appli ne l'attend plus) ==========
let xlsxChargement = null;
function chargerXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxChargement) return xlsxChargement;
  xlsxChargement = new Promise(function (resoudre, rejeter) {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = function () { resoudre(window.XLSX); };
    sc.onerror = function () { xlsxChargement = null; rejeter(new Error('xlsx indisponible')); };
    document.head.appendChild(sc);
  });
  return xlsxChargement;
}
async function xlsxPret() {
  try { await chargerXLSX(); return true; }
  catch (e) { afficherToast('Lecteur Excel indisponible (connexion internet requise)', 'error'); return false; }
}

// ========== LIBELLES ==========""",
    1, 'perf : chargeur xlsx a la demande')

for fn, lbl in [('importerTableauxService', 'import tableaux de service'),
                ('importerTableauxEleves', 'import tableaux eleves'),
                ('importerMassar', 'import MASSAR'),
                ('exporterFicheEleve', 'export fiche eleve')]:
    rep('function %s(' % fn, 'async function %s(' % fn, 1, 'perf : %s async' % lbl)
    rep("""async function %s(""" % fn, """async function %s(""" % fn, 1, 'perf : %s (verif)' % lbl)

# insertion du garde dans le corps de chaque fonction (apres la 1re ligne "{")
for fn, lbl in [('importerTableauxService', 'import tableaux de service'),
                ('importerTableauxEleves', 'import tableaux eleves'),
                ('importerMassar', 'import MASSAR')]:
    i = s.index('async function %s(' % fn)
    j = s.index('{', i) + 1
    s = s[:j] + "\n  if (!(await xlsxPret())) return;" + s[j:]
    print('%-52s OK' % ('perf : garde xlsx dans %s' % fn))

i = s.index('async function exporterFicheEleve(')
j = s.index('{', i) + 1
s = s[:j] + "\n  if (!(await xlsxPret())) return;" + s[j:]
print('%-52s OK' % 'perf : garde xlsx dans exporterFicheEleve')

rep("  setInterval(sdRafraichirTout, 400);", "  setInterval(sdRafraichirTout, 800);", 1, 'perf : polling des listes 800 ms')

# ══════════════════════════════════════════════════════════════════
# 2. Hauteur unique des boutons d'action
# ══════════════════════════════════════════════════════════════════
rep("""    :root {
      --primary: #1e3a8a;""",
"""    :root {
      --btn-h: 44px;
      --primary: #1e3a8a;""",
    1, 'CSS : variable --btn-h')

rep("""  </style>""",
"""    /* Hauteur UNIQUE pour tous les boutons d'action de l'application */
    .btn-primary, .btn-secondary, .btn-danger, .btn-success, .btn-warning, .btn-fermer,
    .btn-outline-danger, .btn-mini-profil {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      height: var(--btn-h); min-height: var(--btn-h); max-height: var(--btn-h);
      padding-top: 0; padding-bottom: 0; box-sizing: border-box; line-height: 1;
    }
    /* Petits boutons de liste (Modifier, Retablir, corbeille) : hors gabarit */
    .btn-inline { height: auto; min-height: 0; background: none; border: 0; padding: 4px 6px; font-size: 12px; font-weight: 700; cursor: pointer; }
  </style>""",
    1, 'CSS : hauteur unique des boutons')

# ══════════════════════════════════════════════════════════════════
# 3. Cartes de la div Professeurs
# ══════════════════════════════════════════════════════════════════
rep("""      <!-- Professeurs -->
      <div class="stat-card mb-4">""",
"""      <!-- Professeurs -->
      <div class="stat-card mb-4 carte-settings">""",
    1, 'carte Professeurs : classe carte-settings')

rep("""    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.innerHTML = '<div style="min-width: 0;"><p class="font-medium text-gray-700" style="font-size: 13px;">' + (c.nom || '') + '</p>' +
      '<p class="text-xs text-gray-500">' + (c.matiere || '') + ' · ' + (c.email || '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.innerHTML = '<i class="fas fa-pen mr-1"></i>Modifier';""",
"""    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.style = 'min-height: 40px; gap: 8px;';
    item.innerHTML = '<div style="min-width: 0; overflow: hidden;">' +
      '<p class="font-medium text-gray-700" style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (c.nom || '') + '</p>' +
      '<p class="text-xs text-gray-500" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (c.matiere || '') + ' · ' + (c.email || '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.innerHTML = '<i class="fas fa-pen mr-1"></i>Modifier';""",
    1, 'liste profs : cartes reglees')

rep("""    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.textContent = 'Rétablir';""",
"""    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.textContent = 'Rétablir';""",
    1, 'bouton Retablir en btn-inline')

rep("""    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #dc2626;';
    b.innerHTML = '<i class="fas fa-trash"></i>';""",
"""    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: #dc2626;';
    b.innerHTML = '<i class="fas fa-trash"></i>';""",
    2, 'boutons corbeille en btn-inline')

# ══════════════════════════════════════════════════════════════════
# 4. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.61', 'AbsenceTrack v3.62', 1, 'label v3.62')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
