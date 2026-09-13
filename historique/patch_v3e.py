# -*- coding: utf-8 -*-
"""v3.13 -> v3.14 : theme par role dans une seule appli.
Enseignant = lot 6 (#6994CC/#AAAAD0/#363759/#74759C/#D93C78)
Surveillant = lot 5 (#566C9D/#EB7F69/#3D3E4E/#A6A6A8)
Theme clair uniquement (le sombre reste d'origine)."""
import io, re, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()
results = []

def plain(label, old, new, n=1):
    global data
    c = data.count(old)
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = data.replace(old, new)
    return ok

# ---------- 1. CSS des lots par role ----------
plain('1-css', '  </style>\n</head>',
      """    /* ===== LOTS PAR ROLE (clair) : enseignant = lot 6, surveillant = lot 5 ===== */
    body.role-enseignant { --lot-primaire: #6994CC; --lot-fonce: #363759; --lot-accent: #AAAAD0; --lot-abs: #D93C78; --lot-rd: #74759C; }
    body.role-surveillant { --lot-primaire: #566C9D; --lot-fonce: #3D3E4E; --lot-accent: #EB7F69; --lot-abs: #EB7F69; --lot-rd: #566C9D; }
    body:not(.theme-sombre).role-enseignant .appbar, body:not(.theme-sombre).role-surveillant .appbar { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
    body:not(.theme-sombre).role-enseignant .btn-primary, body:not(.theme-sombre).role-surveillant .btn-primary { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
    body:not(.theme-sombre).role-enseignant .btn-success, body:not(.theme-sombre).role-surveillant .btn-success { background: var(--lot-primaire); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    body:not(.theme-sombre).role-enseignant .btn-fermer, body:not(.theme-sombre).role-surveillant .btn-fermer { background: var(--lot-accent); box-shadow: 0 6px 18px rgba(0,0,0,0.15); }
    body:not(.theme-sombre).role-enseignant .btn-fermer:hover, body:not(.theme-sombre).role-surveillant .btn-fermer:hover { filter: brightness(0.93); }
    body:not(.theme-sombre).role-enseignant .filter-chip.active, body:not(.theme-sombre).role-surveillant .filter-chip.active { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
    body:not(.theme-sombre).role-enseignant .motif-chip.actif, body:not(.theme-sombre).role-surveillant .motif-chip.actif { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
    body:not(.theme-sombre).role-enseignant .motif-icone, body:not(.theme-sombre).role-surveillant .motif-icone { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); }
    body:not(.theme-sombre).role-enseignant .nav-item.active, body:not(.theme-sombre).role-surveillant .nav-item.active { color: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .nav-item.active::before, body:not(.theme-sombre).role-surveillant .nav-item.active::before { background: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .checkbox-material, body:not(.theme-sombre).role-surveillant .checkbox-material { accent-color: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .progress-fill, body:not(.theme-sombre).role-surveillant .progress-fill { background: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .chart-bar .bar, body:not(.theme-sombre).role-surveillant .chart-bar .bar { background: linear-gradient(180deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); }
    body:not(.theme-sombre).role-enseignant .bar-value, body:not(.theme-sombre).role-surveillant .bar-value { color: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .stat-value, body:not(.theme-sombre).role-surveillant .stat-value { color: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .stat-card-absences, body:not(.theme-sombre).role-surveillant .stat-card-absences { background: linear-gradient(135deg, var(--lot-accent) 0%, var(--lot-fonce) 100%); box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
    body:not(.theme-sombre).role-enseignant .carte-eleve-total, body:not(.theme-sombre).role-surveillant .carte-eleve-total { color: var(--lot-abs); background: rgba(0,0,0,0.06); }
    body:not(.theme-sombre).role-enseignant .text-blue-900, body:not(.theme-sombre).role-surveillant .text-blue-900 { color: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .text-blue-600, body:not(.theme-sombre).role-surveillant .text-blue-600 { color: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .text-gray-800, body:not(.theme-sombre).role-surveillant .text-gray-800,
    body:not(.theme-sombre).role-enseignant .text-gray-700, body:not(.theme-sombre).role-surveillant .text-gray-700 { color: var(--lot-fonce); }
    body:not(.theme-sombre).role-enseignant .text-gray-500, body:not(.theme-sombre).role-surveillant .text-gray-500,
    body:not(.theme-sombre).role-enseignant .text-gray-400, body:not(.theme-sombre).role-surveillant .text-gray-400 { color: var(--lot-rd); }
    body:not(.theme-sombre).role-enseignant input:focus, body:not(.theme-sombre).role-enseignant select:focus,
    body:not(.theme-sombre).role-surveillant input:focus, body:not(.theme-sombre).role-surveillant select:focus { border-color: var(--lot-primaire); }
  </style>
</head>""")

# ---------- 2. JS : helpers ----------
plain('2-js',
      '// ========== MOTIF DE JUSTIFICATION ==========',
      """// ========== LOTS DE COULEURS PAR ROLE (thème clair) ==========
const LOTS_ROLE = {
  enseignant:  { primaire: '#6994CC', fonce: '#363759', accent: '#AAAAD0', abs: '#D93C78', rd: '#74759C' },
  surveillant: { primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69', abs: '#EB7F69', rd: '#566C9D' }
};

function appliquerRoleTheme() {
  const b = document.body.classList;
  b.remove('role-enseignant', 'role-surveillant', 'role-directeur');
  if (utilisateurConnecte && utilisateurConnecte.role) b.add('role-' + utilisateurConnecte.role);
}

function couleursAbsRd() {
  const lot = utilisateurConnecte ? LOTS_ROLE[utilisateurConnecte.role] : null;
  return lot ? { abs: lot.abs, rd: lot.rd } : { abs: '#ef4444', rd: '#f59e0b' };
}

function teinte(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b2 = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + v + ',' + b2 + ',' + alpha + ')';
}

// ========== MOTIF DE JUSTIFICATION ==========""")

# ---------- 3. appels ----------
plain('3-connexion',
      "  utilisateurConnecte = compte;\n  localStorage.setItem('utilisateur', JSON.stringify(compte));",
      "  utilisateurConnecte = compte;\n  localStorage.setItem('utilisateur', JSON.stringify(compte));\n  appliquerRoleTheme();")
plain('4-deco', 'function deconnexion() {\n  utilisateurConnecte = null;', 'function deconnexion() {\n  utilisateurConnecte = null;\n  appliquerRoleTheme();')
plain('5-init', '        utilisateurConnecte = valid;', '        utilisateurConnecte = valid;\n        appliquerRoleTheme();')

# ---------- 4. couleurs Ab/Rd dans le JS ----------
plain('6-liste',
      """    const couleur = cocheRetard ? '#f59e0b' : '#ef4444';
    const fond = cocheRetard ? '#fffbeb' : '#fef2f2';""",
      """    const palAbsRd = couleursAbsRd();
    const couleur = cocheRetard ? palAbsRd.rd : palAbsRd.abs;
    const fond = teinte(couleur, 0.10);""")
plain('7-chip',
      "    const styleChip = cocheRetard ? 'background: #f59e0b; color: #fff;' : (estCoche ? 'background: #ef4444; color: #fff;' : 'background: #dbeafe; color: #1e3a8a;');",
      "    const styleChip = estCoche ? ('background: ' + couleur + '; color: #fff;') : 'background: #dbeafe; color: #1e3a8a;';")
plain('8-nom',
      "    const styleNom = cocheRetard ? 'color: #b45309; font-weight: 600;' : (estCoche ? 'color: #b91c1c; font-weight: 600;' : 'color: #1f2937;');",
      "    const styleNom = estCoche ? ('color: ' + couleur + '; font-weight: 600;') : 'color: #1f2937;';")
plain('9-type',
      "  const couleurType = estRetard ? '#f59e0b' : (estExclusion ? '#64748b' : '#ef4444');",
      "  const palType = couleursAbsRd();\n  const couleurType = estRetard ? palType.rd : (estExclusion ? '#64748b' : palType.abs);")
plain('10-marque',
      "      const styleMarque = retard ? 'color: #f59e0b; font-weight: 800;' : 'color: #ef4444; font-weight: 800;';",
      "      const palM = couleursAbsRd();\n      const styleMarque = 'color: ' + (retard ? palM.rd : palM.abs) + '; font-weight: 800;';")

# ---------- 5. version ----------
plain('11-version', 'AbsenceTrack v3.13 \u2014 Prototype', 'AbsenceTrack v3.14 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('appliquerRoleTheme', 4), ('couleursAbsRd', 4), ('role-enseignant', 17), ('role-surveillant', 18), ('LOTS_ROLE', 3)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_check47.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '/data/data/com.termux/files/home/AbsenceTrack-dev/_check47.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])
print('DIVS', data.count('<div'), data.count('</div>'))
