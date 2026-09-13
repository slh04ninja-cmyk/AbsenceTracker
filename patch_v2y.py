# -*- coding: utf-8 -*-
"""v3.4 -> v3.5 : bloc motif de justification redessine (chips) + theme sombre."""
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

# ---------- 1. HTML : nouveau bloc motif ----------
old_html = """      <div id="bloc-motif" class="px-4 pb-3">
        <div class="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <label class="block text-xs font-bold text-blue-900 mb-2"><i class="fas fa-check-circle mr-1"></i>Motif de justification</label>
          <select id="select-motif" class="w-full px-4 py-3 border-2 border-blue-300 rounded-xl font-semibold text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none">
            <option value="Maladie">Maladie</option>
            <option value="Raison familiale">Raison familiale</option>
            <option value="Raison personnelle">Raison personnelle</option>
            <option value="Transport">Transport</option>
            <option value="Sanction">Sanction</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
      </div>"""
new_html = """      <div id="bloc-motif" class="px-4 pb-3">
        <div class="motif-carte">
          <div class="motif-entete">
            <span class="motif-icone"><i class="fas fa-clipboard-check"></i></span>
            <div>
              <p class="motif-titre">Motif de justification</p>
              <p class="motif-sous-titre">Choisissez le motif puis validez</p>
            </div>
          </div>
          <input type="hidden" id="select-motif" value="Maladie">
          <div class="motif-chips" id="chips-motif">
            <button type="button" class="motif-chip actif" onclick="choisirMotif('Maladie', this)">Maladie</button>
            <button type="button" class="motif-chip" onclick="choisirMotif('Raison familiale', this)">Raison familiale</button>
            <button type="button" class="motif-chip" onclick="choisirMotif('Raison personnelle', this)">Raison personnelle</button>
            <button type="button" class="motif-chip" onclick="choisirMotif('Transport', this)">Transport</button>
            <button type="button" class="motif-chip" onclick="choisirMotif('Sanction', this)">Sanction</button>
            <button type="button" class="motif-chip" onclick="choisirMotif('Autre', this)">Autre</button>
          </div>
        </div>
      </div>"""
plain('1-html', old_html, new_html)

# ---------- 2. CSS ----------
plain('2-css', '  </style>\n</head>',
      """    /* ============ BLOC MOTIF DE JUSTIFICATION ============ */
    .motif-carte { border-radius: 20px; padding: 14px; background: linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%); border: 1px solid #bfdbfe; box-shadow: 0 4px 14px rgba(30,58,138,0.08); }
    .motif-entete { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .motif-icone { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #fff; background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); box-shadow: 0 4px 12px rgba(59,130,246,0.35); flex-shrink: 0; }
    .motif-titre { font-size: 13px; font-weight: 800; color: #1e3a8a; line-height: 1.2; }
    .motif-sous-titre { font-size: 11px; color: #64748b; margin-top: 2px; }
    .motif-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .motif-chip { border: 1.5px solid #dbeafe; background: #fff; color: #334155; font-size: 12.5px; font-weight: 600; padding: 9px 14px; border-radius: 999px; cursor: pointer; transition: all 0.2s ease; }
    .motif-chip:hover { border-color: #60a5fa; color: #1e40af; transform: translateY(-1px); }
    .motif-chip.actif { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); border-color: transparent; color: #fff; box-shadow: 0 6px 16px rgba(37,99,235,0.35); }
    body.theme-sombre .motif-carte { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-color: #334155; }
    body.theme-sombre .motif-titre { color: #bfdbfe; }
    body.theme-sombre .motif-sous-titre { color: #94a3b8; }
    body.theme-sombre .motif-chip { background: #0f172a; border-color: #334155; color: #cbd5e1; }
    body.theme-sombre .motif-chip:hover { border-color: #60a5fa; color: #bfdbfe; }
    body.theme-sombre .motif-chip.actif { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: #fff; border-color: transparent; }
  </style>
</head>""")

# ---------- 3. JS : choisirMotif ----------
plain('3-js',
      '// ========== HAUTEUR DE LA BARRE DU HAUT ==========',
      """// ========== MOTIF DE JUSTIFICATION ==========
function choisirMotif(motif, el) {
  const champ = document.getElementById('select-motif');
  if (champ) champ.value = motif;
  document.querySelectorAll('#chips-motif .motif-chip').forEach(c => c.classList.remove('actif'));
  if (el) el.classList.add('actif');
}

// ========== HAUTEUR DE LA BARRE DU HAUT ==========""")

# ---------- 4. reset du motif a l'ouverture ----------
plain('4-reset',
      "    if (blocMotif) blocMotif.style.display = 'block';",
      """    if (blocMotif) blocMotif.style.display = 'block';
    const champMotif = document.getElementById('select-motif');
    if (champMotif) champMotif.value = 'Maladie';
    document.querySelectorAll('#chips-motif .motif-chip').forEach((c, i) => c.classList.toggle('actif', i === 0));""")

# ---------- 5. version ----------
plain('5-version', 'AbsenceTrack v3.4 \u2014 Prototype', 'AbsenceTrack v3.5 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('motif-carte', 3), ('motif-chip', 12), ('choisirMotif', 7), ('select-motif', 4), ('clipart', 0)]:
    c = data.count(pat)
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check37.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check37.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])
print('DIVS', data.count('<div'), data.count('</div>'))
