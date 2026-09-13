# -*- coding: utf-8 -*-
"""v2 -> affichage/ergonomie : en-tete prof+matiere, resume classe, derniere saisie,
mode sombre, taille de police, cartes compactes direction."""
import re, io, os, shutil, subprocess

SRC = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
OUT = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'

data = io.open(SRC, encoding='utf-8').read()
results = []

def plain(label, old, new, n=1):
    global data
    c = data.count(old)
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = data.replace(old, new)
    return ok

def rx(label, pat, repl, n=1):
    global data
    c = len(re.findall(pat, data, re.DOTALL))
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = re.sub(pat, repl, data, flags=re.DOTALL)
    return ok

# ---------- 1. appbar enseignant : ligne prof + matiere ----------
plain('1-appbarProf',
      """      <div class="appbar-title">Prise d'absence</div>
      <div class="appbar-subtitle" id="ens-classe-name">Sélectionnez une classe</div>
    </div>""",
      """      <div class="appbar-title">Prise d'absence</div>
      <div class="appbar-subtitle" id="ens-classe-name">Sélectionnez une classe</div>
      <div class="appbar-subtitle" id="ens-prof-info" style="opacity: 0.75;"></div>
    </div>""")

# ---------- 2. carte classe : resume (X absents / 13 + derniere saisie) ----------
plain('2-resumeCarte',
      """        <select id="select-classe" onchange="changerClasse()" class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
          <option value="">-- Choisir une classe --</option>
        </select>
      </div>""",
      """        <select id="select-classe" onchange="changerClasse()" class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
          <option value="">-- Choisir une classe --</option>
        </select>
        <div id="classe-resume" class="hidden mt-3 text-sm text-gray-600 text-center"></div>
      </div>""")

# ---------- 3. cartes compactes direction ----------
plain('3-cartesMini',
      """      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="stat-card">
          <div class="stat-label text-xs">Élèves</div>
          <div class="stat-value text-2xl" id="dir-eleves">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label text-xs">Classes</div>
          <div class="stat-value text-2xl" id="dir-classes">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label text-xs">Absents</div>
          <div class="stat-value text-2xl text-red-600" id="dir-absents">0</div>
        </div>
      </div>""",
      """      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="stat-card stat-mini">
          <div class="stat-label text-xs">Élèves</div>
          <div class="stat-value text-2xl" id="dir-eleves">0</div>
        </div>
        <div class="stat-card stat-mini">
          <div class="stat-label text-xs">Classes</div>
          <div class="stat-value text-2xl" id="dir-classes">0</div>
        </div>
        <div class="stat-card stat-mini">
          <div class="stat-label text-xs">Absents</div>
          <div class="stat-value text-2xl text-red-600" id="dir-absents">0</div>
        </div>
      </div>""")

# ---------- 4. boutons de reglages d'affichage ----------
plain('4-reglagesHtml',
      '<!-- TOAST -->\n<div id="toast" class="toast hidden"></div>',
      """<!-- TOAST -->
<div id="toast" class="toast hidden"></div>

<!-- REGLAGES D'AFFICHAGE -->
<div id="reglages-affichage" class="fixed z-40" style="left: 16px; bottom: 84px; display: flex; flex-direction: column; gap: 8px;">
  <button onclick="basculerTheme()" title="Mode sombre" class="w-11 h-11 rounded-full bg-white text-blue-900 shadow-lg flex items-center justify-center" style="border: 1px solid rgba(0,0,0,0.08);"><i id="icone-theme" class="fas fa-moon"></i></button>
  <button onclick="changerPolice(1)" title="Agrandir le texte" class="w-11 h-11 rounded-full bg-white text-blue-900 shadow-lg flex items-center justify-center" style="border: 1px solid rgba(0,0,0,0.08); font-weight: 800;">A+</button>
  <button onclick="changerPolice(-1)" title="Réduire le texte" class="w-11 h-11 rounded-full bg-white text-blue-900 shadow-lg flex items-center justify-center" style="border: 1px solid rgba(0,0,0,0.08); font-weight: 800;">A-</button>
</div>""")

# ---------- 5. CSS : cartes compactes + theme sombre ----------
plain('5-css',
      '  </style>\n</head>',
      """    /* ============ CARTES COMPACTES (direction) ============ */
    .stat-mini { padding: 12px 14px; margin-bottom: 0; }
    .stat-mini .stat-label { font-size: 11px; }
    .stat-mini .stat-value { font-size: 24px; margin: 4px 0 0; }
    /* ============ THEME SOMBRE ============ */
    body.theme-sombre { background: #0f172a; }
    body.theme-sombre .page-container { background: #0f172a; }
    body.theme-sombre .appbar { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); }
    body.theme-sombre .stat-card,
    body.theme-sombre .card-material,
    body.theme-sombre .absence-card,
    body.theme-sombre .list-item,
    body.theme-sombre .bg-white,
    body.theme-sombre .modal-content,
    body.theme-sombre #reglages-affichage button { background: #1e293b !important; border-color: #334155 !important; color: #e2e8f0; }
    body.theme-sombre #page-login .bg-white.rounded-full { background: #ffffff !important; }
    body.theme-sombre .bg-opacity-20 { background: rgba(255,255,255,0.2) !important; }
    body.theme-sombre .bottom-nav { background: #1e293b !important; border-top-color: #334155; }
    body.theme-sombre .bottom-nav .nav-item { color: #94a3b8; }
    body.theme-sombre .bottom-nav .nav-item.active { color: #93c5fd; }
    body.theme-sombre select, body.theme-sombre input { background: #0f172a !important; color: #e2e8f0 !important; border-color: #334155 !important; }
    body.theme-sombre .text-gray-800, body.theme-sombre .text-gray-700, body.theme-sombre .text-gray-600 { color: #e2e8f0 !important; }
    body.theme-sombre .text-gray-500, body.theme-sombre .text-gray-400 { color: #94a3b8 !important; }
    body.theme-sombre .bg-gray-50, body.theme-sombre .bg-gray-100 { background: #273549 !important; }
    body.theme-sombre .border-gray-100, body.theme-sombre .border-gray-200 { border-color: #334155 !important; }
    body.theme-sombre .table { background: #1e293b; }
    body.theme-sombre .table th { background: #273549 !important; color: #e2e8f0; }
    body.theme-sombre .table td { color: #cbd5e1; }
    body.theme-sombre .filter-chip { background: #1e293b; color: #cbd5e1; border-color: #334155; }
    body.theme-sombre .absence-card-classe { background: #273549; color: #cbd5e1; }
    body.theme-sombre .detail-ligne { background: #273549; }
    body.theme-sombre .progress-bar { background: #334155; }
  </style>
</head>""")

# ---------- 6. JS : theme + taille de police ----------
plain('6-jsReglages',
      """  return d.getFullYear() + '-' + m + '-' + j;
}""",
      """  return d.getFullYear() + '-' + m + '-' + j;
}

// ========== REGLAGES D'AFFICHAGE (theme + taille du texte) ==========
const TAILLES_POLICE = [87.5, 100, 112.5, 125];
let indexTaillePolice = 1;
(function initPrefPolice() {
  const p = parseFloat(localStorage.getItem('prefPolice'));
  const idx = TAILLES_POLICE.indexOf(p);
  indexTaillePolice = idx >= 0 ? idx : 1;
})();

function appliquerTheme() {
  const sombre = localStorage.getItem('prefTheme') === 'sombre';
  document.body.classList.toggle('theme-sombre', sombre);
  const icone = document.getElementById('icone-theme');
  if (icone) icone.className = sombre ? 'fas fa-sun' : 'fas fa-moon';
}

function basculerTheme() {
  localStorage.setItem('prefTheme', localStorage.getItem('prefTheme') === 'sombre' ? 'clair' : 'sombre');
  appliquerTheme();
}

function appliquerPolice() {
  document.documentElement.style.fontSize = TAILLES_POLICE[indexTaillePolice] + '%';
  localStorage.setItem('prefPolice', String(TAILLES_POLICE[indexTaillePolice]));
}

function changerPolice(sens) {
  indexTaillePolice = Math.min(TAILLES_POLICE.length - 1, Math.max(0, indexTaillePolice + sens));
  appliquerPolice();
}

appliquerTheme();
appliquerPolice();""")

# ---------- 7. resume de classe + appel depuis le compteur ----------
oldCompteur = """function mettreAJourCompteur() {
  if (classeSelectionnee) {
    const todayISO = fmtDateISO(new Date());
    const absentsAuj = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const absentsPrec = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const total = Math.max(elevesCoches.size + absentsPrec, absentsAuj + absentsPrec);
    document.getElementById('count-absents').textContent = total;
    document.getElementById('count-total').textContent = classeSelectionnee.eleves.length;
  }
}"""
newCompteur = """function mettreAJourCompteur() {
  if (classeSelectionnee) {
    const todayISO = fmtDateISO(new Date());
    const absentsAuj = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const absentsPrec = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const total = Math.max(elevesCoches.size + absentsPrec, absentsAuj + absentsPrec);
    document.getElementById('count-absents').textContent = total;
    document.getElementById('count-total').textContent = classeSelectionnee.eleves.length;
  }
  mettreAJourResumeClasse();
}

function mettreAJourResumeClasse() {
  const bloc = document.getElementById('classe-resume');
  if (!bloc) return;
  if (!classeSelectionnee) {
    bloc.classList.add('hidden');
    bloc.textContent = '';
    return;
  }
  const todayISO = fmtDateISO(new Date());
  const absentsAuj = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d');
  const mesSaisies = utilisateurConnecte ? absentsAuj.filter(a => a.enseignant === utilisateurConnecte.nom) : [];
  const derniere = mesSaisies.length ? mesSaisies[mesSaisies.length - 1].heure : null;
  let txt = classeSelectionnee.eleves.length + ' élèves · ' + absentsAuj.length + (absentsAuj.length > 1 ? ' absents' : ' absent') + " aujourd'hui";
  if (derniere) txt += ' · dernière saisie à ' + derniere;
  bloc.textContent = txt;
  bloc.classList.remove('hidden');
}"""
plain('7-compteurResume', oldCompteur, newCompteur)

# ---------- 8. choisirClasse('') masque aussi le resume ----------
plain('8-resetResume',
      """    const liste = document.getElementById('liste-eleves-enseignant');
    if (liste) liste.innerHTML = '';
    return;""",
      """    const liste = document.getElementById('liste-eleves-enseignant');
    if (liste) liste.innerHTML = '';
    mettreAJourResumeClasse();
    return;""")

# ---------- 9. infos prof : fonction + appels ----------
plain('9-infosProfFn',
      'function changerClasse() {\n  choisirClasse(document.getElementById(\'select-classe\').value);\n}',
      """function afficherInfosProf() {
  const bloc = document.getElementById('ens-prof-info');
  if (!bloc) return;
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') {
    bloc.textContent = utilisateurConnecte.nom + (utilisateurConnecte.matiere ? ' · ' + utilisateurConnecte.matiere : '');
  } else {
    bloc.textContent = '';
  }
}

function changerClasse() {
  choisirClasse(document.getElementById('select-classe').value);
}""")

plain('10-infosProfLogin',
      "    afficherEcran('enseignant');\n    remplirListeClasses();\n    choisirClasse('');",
      "    afficherEcran('enseignant');\n    remplirListeClasses();\n    choisirClasse('');\n    afficherInfosProf();")

plain('11-infosProfInit',
      "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); }",
      "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); }")

plain('12-infosProfDeco',
      "  classeSelectionnee = null;\n  choisirClasse('');",
      "  classeSelectionnee = null;\n  choisirClasse('');\n  afficherInfosProf();")

# ---------- 13. version ----------
plain('13-version', 'AbsenceTrack v1.5 \u2014 Prototype', 'AbsenceTrack v1.6 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('classe-resume', 3), ('ens-prof-info', 3), ('stat-mini', 4), ('theme-sombre', 19),
                 ('basculerTheme', 2), ('changerPolice', 3), ('mettreAJourResumeClasse', 3),
                 ('afficherInfosProf', 5), ('reglages-affichage', 2), ('TAILLES_POLICE', 5)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check7.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
else:
    print('NODE_CHECK skipped (node absent)')
