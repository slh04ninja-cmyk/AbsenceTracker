# -*- coding: utf-8 -*-
"""v2 -> v2.1 : dashboard surveillant sans badges + absents seulement + fiche detail centree."""
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

# ---------- 1. liste = absents seulement, carte sans badge ----------
newListe = '''  const absentsListe = absencesToday.filter(a => a.statut === 'absent');
  if (absentsListe.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>Aucun élève absent aujourd\\'hui</p></div>';
    return;
  }

  absentsListe.forEach(abs => {
    const card = document.createElement('div');
    card.className = 'absence-card';
    card.onclick = () => afficherDetailAbsence(abs);
    card.innerHTML = `
      <div class="absence-card-ligne">
        <span class="absence-card-name">${abs.nom}</span>
        <span class="absence-card-classe">${abs.classe}</span>
        <i class="fas fa-chevron-right absence-card-icon"></i>
      </div>
    `;
    listContainer.appendChild(card);
  });'''
rx('1-listeAbsents', r'  if \(absencesToday\.length === 0\) \{.*?listContainer\.appendChild\(card\);\n  \}\);', newListe)

# ---------- 2. modal : carte centree ----------
plain('2-modalCentre',
      '<div id="modal-absence-detail" class="hidden fixed inset-0 modal-overlay z-50 flex items-end">\n'
      '  <div class="modal-content w-full bg-white p-6 rounded-t-3xl">',
      '<div id="modal-absence-detail" class="hidden fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">\n'
      '  <div class="w-full max-w-md bg-white p-6 rounded-3xl scale-in shadow-2xl" style="max-height: 85vh; overflow-y: auto;">')

# ---------- 3. lignes de la fiche (titre : reponse) ----------
oldRows = r'''    <div id="absence-detail-content" class="space-y-4">
      <div class="detail-item">
        <div class="detail-label">Élève</div>
        <div class="detail-value" id="detail-nom">-</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Classe</div>
        <div class="detail-value" id="detail-classe">-</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Date</div>
        <div class="detail-value" id="detail-date">-</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Heure</div>
        <div class="detail-value" id="detail-heure">-</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Professeur</div>
        <div class="detail-value" id="detail-prof">-</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Matière</div>
        <div class="detail-value" id="detail-matiere">-</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Statut</div>
        <div id="detail-statut-badge"></div>
      </div>
    </div>'''
newRows = r'''    <div id="absence-detail-content" class="space-y-3">
      <div class="detail-ligne">
        <span class="detail-titre">Élève</span>
        <span class="detail-reponse" id="detail-nom">-</span>
      </div>
      <div class="detail-ligne">
        <span class="detail-titre">Classe</span>
        <span class="detail-reponse" id="detail-classe">-</span>
      </div>
      <div class="detail-ligne">
        <span class="detail-titre">Date</span>
        <span class="detail-reponse" id="detail-date">-</span>
      </div>
      <div class="detail-ligne">
        <span class="detail-titre">Heure</span>
        <span class="detail-reponse" id="detail-heure">-</span>
      </div>
      <div class="detail-ligne">
        <span class="detail-titre">Professeur</span>
        <span class="detail-reponse" id="detail-prof">-</span>
      </div>
      <div class="detail-ligne">
        <span class="detail-titre">Matière</span>
        <span class="detail-reponse" id="detail-matiere">-</span>
      </div>
      <div class="detail-ligne">
        <span class="detail-titre">Statut</span>
        <span class="detail-reponse" id="detail-statut-badge"></span>
      </div>
    </div>'''
plain('3-lignesFiche', oldRows, newRows)

# ---------- 4. CSS cartes (sans badge) ----------
oldCss = '''    .absence-card-ligne { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .absence-card-name { font-weight: 700; color: #1e293b; font-size: 14px; flex: 1; min-width: 0; }
    .absence-card-classe { font-size: 12px; color: #475569; font-weight: 600; background: #eef2f7; padding: 5px 10px; border-radius: 8px; white-space: nowrap; }
    .absence-card-badge-statut { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #fff; letter-spacing: 0.4px; box-shadow: 0 2px 8px rgba(15,23,42,0.18); }'''
newCss = '''    .absence-card-ligne { display: flex; align-items: center; gap: 10px; }
    .absence-card-name { font-weight: 700; color: #1e293b; font-size: 14px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .absence-card-classe { font-size: 12px; color: #475569; font-weight: 600; background: #eef2f7; padding: 5px 10px; border-radius: 8px; white-space: nowrap; }'''
plain('4-cssCartes', oldCss, newCss)

# ---------- 5. CSS fiche ----------
oldFiche = '''    .detail-item { background: #f8fbff; border-radius: 12px; padding: 12px 14px; border-left: 3px solid var(--primary); }
    .detail-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
    .detail-value { font-size: 15px; font-weight: 600; color: #1e293b; }'''
newFiche = '''    .detail-ligne { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #f8fbff; border-radius: 12px; padding: 12px 14px; border-left: 3px solid var(--primary); }
    .detail-titre { font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0; }
    .detail-reponse { font-size: 15px; font-weight: 600; color: #1e293b; text-align: right; word-break: break-word; }'''
plain('5-cssFiche', oldFiche, newFiche)

# ---------- ecriture + rapport ----------
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('absence-card-badge-statut', 0), ('detail-item', 0), ('detail-ligne', 7), ('detail-reponse', 7),
                 ('absentsListe', 3), ('Aucun \\xe9l\\xe8ve absent' if False else 'absent aujourd', 1),
                 ('modal-content', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check2.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
else:
    print('NODE_CHECK skipped (node absent)')
