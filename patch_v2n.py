# -*- coding: utf-8 -*-
"""v2.3 -> v2.4 : correction du scroll des popups (fiche eleve + detail signalement)."""
import re, io, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()
results = []

def rx(label, pat, repl, n=1):
    global data
    c = len(re.findall(pat, data, re.DOTALL))
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = re.sub(pat, repl, data, flags=re.DOTALL)
    return ok

def plain(label, old, new, n=1):
    global data
    c = data.count(old)
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = data.replace(old, new)
    return ok

# ---------- 1. popup "Details du signalement" : scroll interne ----------
nouveau_detail = '''<div id="modal-absence-detail" class="hidden fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl" style="max-height: 90vh; display: flex; flex-direction: column;">
    <div class="flex justify-between items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <h2 class="text-lg font-bold text-gray-800">Détails du signalement</h2>
      <button onclick="fermerDetailAbsence()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
    </div>
    <div style="flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
      <div class="px-4 pb-3">
        <div class="bg-gray-50 rounded-2xl p-4 space-y-0" id="absence-detail-content">
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Élève</span><span class="text-sm font-semibold text-gray-800" id="detail-nom">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Classe</span><span class="text-sm font-semibold text-gray-800" id="detail-classe">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Date</span><span class="text-sm font-semibold text-gray-800" id="detail-date">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Heure</span><span class="text-sm font-semibold text-gray-800" id="detail-heure">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Professeur</span><span class="text-sm font-semibold text-gray-800" id="detail-prof">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Matière</span><span class="text-sm font-semibold text-gray-800" id="detail-matiere">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Type</span><span class="text-sm font-semibold text-gray-800" id="detail-type">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200" id="row-duree"><span class="text-xs font-bold text-gray-500">Durée</span><span class="text-sm font-semibold text-gray-800" id="detail-duree">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Statut</span><span class="text-sm font-semibold" id="detail-statut-badge"></span></div>
          <div class="flex justify-between py-2 border-b border-gray-200" id="row-motif"><span class="text-xs font-bold text-gray-500">Motif</span><span class="text-sm font-semibold text-gray-800" id="detail-motif">-</span></div>
          <div class="flex justify-between py-2 border-b border-gray-200" id="row-justifie-par"><span class="text-xs font-bold text-gray-500">Justifié par</span><span class="text-sm font-semibold text-gray-800" id="detail-justifie-par">-</span></div>
          <div class="flex justify-between py-2" id="row-justifie-le"><span class="text-xs font-bold text-gray-500">Justifié le</span><span class="text-sm font-semibold text-gray-800" id="detail-justifie-le">-</span></div>
        </div>
      </div>
      <div id="bloc-motif" class="px-4 pb-3">
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
      </div>
    </div>
    <div class="flex gap-3 px-4 pt-2 pb-5" style="flex-shrink: 0;">
      <button onclick="fermerDetailAbsence()" class="btn-secondary flex-1">Fermer</button>
      <button id="btn-justifier-absence" class="btn-success flex-1" style="display: none;">Justifier</button>
    </div>
  </div>
</div>'''
rx('1-modalDetail',
   r'<div id="modal-absence-detail".*?\n<!-- FICHE ELEVE -->',
   nouveau_detail + '\n\n<!-- FICHE ELEVE -->')

# ---------- 2. popup "Fiche eleve" : scroll interne ----------
nouvelle_fiche = '''<div id="modal-fiche-eleve" class="hidden fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl" style="max-height: 90vh; display: flex; flex-direction: column;">
    <div class="flex items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <span style="width: 32px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 text-center" id="fiche-titre" style="flex: 1;">Fiche élève</h2>
      <button onclick="fermerFicheEleve()" class="text-gray-400 hover:text-gray-600 leading-none" style="width: 32px; flex-shrink: 0; font-size: 24px;">&times;</button>
    </div>
    <div class="px-4 pb-3" style="flex-shrink: 0;">
      <div class="bg-gray-50 rounded-2xl p-4" id="fiche-infos"></div>
    </div>
    <div class="px-4 pb-3" style="flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
      <div class="bg-gray-50 rounded-2xl p-4" id="fiche-historique"></div>
    </div>
    <div class="flex gap-3 px-4 pt-2 pb-5" style="flex-shrink: 0;">
      <button onclick="fermerFicheEleve()" class="btn-secondary flex-1">Fermer</button>
      <button onclick="exporterFicheEleve()" class="btn-primary flex-1"><i class="fas fa-file-excel"></i> Exporter</button>
    </div>
  </div>
</div>'''
rx('2-modalFiche',
   r'<div id="modal-fiche-eleve".*?\n<!-- TOAST -->',
   nouvelle_fiche + '\n\n<!-- TOAST -->')

# ---------- 3. version ----------
plain('3-version', 'AbsenceTrack v2.3 \u2014 Prototype', 'AbsenceTrack v2.4 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('max-height: 90vh', 2), ('-webkit-overflow-scrolling: touch', 2),
                 ('overscroll-behavior: contain', 2), ('🏥', 0), ('modal-absence-detail', 2),
                 ('modal-fiche-eleve', 3), ('select-motif', 2)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check24.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '_check24.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1500])
print('DIVS', data.count('<div'), data.count('</div>'))
