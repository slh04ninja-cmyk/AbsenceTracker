# -*- coding: utf-8 -*-
"""v2.6 -> v2.7 : carte rouge surveillant (espacements, taille, libelles) + popup (date sans seance, bouton Fermer orange, polices)."""
import re, io, shutil, subprocess

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

def rx(label, pat, repl, n=1):
    global data
    c = len(re.findall(pat, data, re.DOTALL))
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = re.sub(pat, repl, data, flags=re.DOTALL)
    return ok

# ---------- 1. CSS : espacements egaux + carte plus basse ----------
plain('1a-carte', 'padding: 20px; margin-bottom: 20px;', 'padding: 12px 16px; margin: 0 0 16px;')
plain('1b-item', '.absence-item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 12px; }',
      '.absence-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 8px; }')
plain('1c-value', '.absence-value { font-size: 32px;', '.absence-value { font-size: 26px;')
plain('1d-divider', '.absence-divider { width: 1px; height: 50px;', '.absence-divider { width: 1px; height: 38px;')
plain('1e-subtext', '.absence-subtext { font-size: 10px;', '.absence-subtext { font-size: 9px;')
plain('1f-appbarVar', '.page-with-appbar { padding-top: 56px; }', '.page-with-appbar { padding-top: var(--appbar-h, 56px); }')

# ---------- 2. CSS : bouton Fermer orange-rouge + polices des boutons du popup ----------
plain('2-cssBouton', '  </style>\n</head>',
      '''    .btn-fermer { background: #ea580c; color: #fff; border: none; font-weight: 700; box-shadow: 0 6px 18px rgba(234,88,12,0.35); }
    .btn-fermer:hover { background: #c2410c; }
    body.theme-sombre .btn-fermer { background: #ea580c !important; color: #fff !important; border-color: #ea580c !important; }
    #modal-absence-detail .btn-fermer, #modal-absence-detail #btn-justifier-absence { font-size: 17px; font-weight: 800; padding: 15px 20px; }
  </style>
</head>''')

# ---------- 3. carte rouge : libelles Nouveau / Non justifiee / Total ----------
rx('3-carteHtml', r'      <div class="stat-card-absences">.*?\n      </div>\n',
   '''      <div class="stat-card-absences">
        <div class="absences-grid">
          <div class="absence-item">
            <div class="absence-label">NOUVEAU</div>
            <div class="absence-value" id="surv-nouveaux">0</div>
            <div class="absence-subtext">heure actuelle</div>
          </div>
          <div class="absence-divider"></div>
          <div class="absence-item">
            <div class="absence-label">NON JUSTIFIÉE</div>
            <div class="absence-value" id="surv-total-unjustified">0</div>
            <div class="absence-subtext">aujourd'hui</div>
          </div>
          <div class="absence-divider"></div>
          <div class="absence-item">
            <div class="absence-label">TOTAL</div>
            <div class="absence-value" id="surv-total-absents">0</div>
            <div class="absence-subtext">du jour</div>
          </div>
        </div>
      </div>
''')

# ---------- 4. JS : valeurs de la carte ----------
plain('4-valeurs',
      """  const totalUnjustified = absences.filter(a => a.statut === 'absent').length;

  document.getElementById('surv-nouveaux').textContent = nouveauxCetteHeure.length;
  document.getElementById('surv-total-absents').textContent = absencesToday.length;
  document.getElementById('surv-total-unjustified').textContent = totalUnjustified;""",
      """  const nonJustifieesJour = absencesToday.filter(a => a.statut === 'absent').length;

  document.getElementById('surv-nouveaux').textContent = nouveauxCetteHeure.length;
  document.getElementById('surv-total-unjustified').textContent = nonJustifieesJour;
  document.getElementById('surv-total-absents').textContent = absencesToday.length;""")

# ---------- 5. popup : date sans seance ----------
plain('5-date',
      "document.getElementById('detail-date').textContent = abs.date + (abs.seance ? ' · ' + libelleSeance(abs.seance) : '');",
      "document.getElementById('detail-date').textContent = abs.date;")

# ---------- 6. popup : bouton Fermer orange-rouge ----------
plain('6-fermer', '<button onclick="fermerDetailAbsence()" class="btn-secondary flex-1">Fermer</button>',
      '<button onclick="fermerDetailAbsence()" class="btn-fermer flex-1">Fermer</button>')

# ---------- 7. hauteur reelle de l'appbar -> pas de recouvrement, espacements egaux ----------
plain('7-appbarJs', '// ========== DONNEES DE TEST',
      '''// ========== HAUTEUR DE LA BARRE DU HAUT ==========
function ajusterHauteurAppbar() {
  const barre = document.querySelector('.appbar');
  if (!barre) return;
  const h = barre.offsetHeight;
  if (h > 0) document.documentElement.style.setProperty('--appbar-h', h + 'px');
}
window.addEventListener('resize', ajusterHauteurAppbar);
window.addEventListener('orientationchange', ajusterHauteurAppbar);

// ========== DONNEES DE TEST''')

plain('8-appbarAppel',
      """  const page = document.getElementById('page-' + nomPage);
  if (page) page.classList.add('active');
}""",
      """  const page = document.getElementById('page-' + nomPage);
  if (page) page.classList.add('active');
  ajusterHauteurAppbar();
}""")

# ---------- 9. version ----------
plain('9-version', 'AbsenceTrack v2.6 \u2014 Prototype', 'AbsenceTrack v2.7 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('btn-fermer', 4), ('--appbar-h', 2), ('ajusterHauteurAppbar', 4),
                 ('NON JUSTIFIÉE', 1), ('id="surv-total-unjustified"', 1), ("libelleSeance(abs.seance)", 0),
                 ('padding: 12px 16px; margin: 0 0 16px', 1), ('font-size: 26px', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check27.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check27.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])
print('DIVS', data.count('<div'), data.count('</div>'))
