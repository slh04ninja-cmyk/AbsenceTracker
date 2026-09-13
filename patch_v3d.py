# -*- coding: utf-8 -*-
"""v3.11 -> v3.12 : popup Historique (fiche) aligne sur le style du popup Dashboard."""
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

# 1. blocs de la fiche : meme fond que les blocs du dashboard
plain('1-infos',
      '<div class="bg-gray-50 rounded-2xl p-4" id="fiche-infos"></div>',
      '<div class="detail-carte rounded-2xl p-4 space-y-0" id="fiche-infos"></div>')
plain('2-historique',
      '<div class="bg-gray-50 rounded-2xl p-4" id="fiche-historique"></div>',
      '<div class="detail-carte rounded-2xl p-4" id="fiche-historique"></div>')

# 2. lignes de la fiche : format du dashboard (label gris / valeur)
plain('3-ligneFiche',
      """function ligneFiche(titre, valeur) {
  return '<div class="detail-ligne"><span class="detail-titre">' + titre + '</span><span class="detail-reponse">' + valeur + '</span></div>';
}""",
      """function ligneFiche(titre, valeur) {
  return '<div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">' + titre + '</span><span class="text-sm font-semibold text-gray-800">' + valeur + '</span></div>';
}""")

# 3. lignes d'historique : format ligne du dashboard (separateur), plus de petites cartes blanches
plain('4-histo',
      "      return '<div class=\"p-3 bg-white rounded-lg\" style=\"margin-bottom: 6px;\"><div class=\"flex justify-between items-center\"><span class=\"font-medium text-gray-800\">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style=\"' + styleMarque + '\">' + marque + '</span></div><p class=\"text-xs text-gray-500 mt-1\">' + info + '</p></div>';",
      "      return '<div class=\"py-2 border-b border-gray-200\"><div class=\"flex justify-between items-center\"><span class=\"text-sm font-semibold text-gray-800\">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style=\"' + styleMarque + '\">' + marque + '</span></div><p class=\"text-xs text-gray-500 mt-1\">' + info + '</p></div>';")

# 4. version
plain('5-version', 'AbsenceTrack v3.11 \u2014 Prototype', 'AbsenceTrack v3.12 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('detail-carte', 6), ('detail-ligne', 0), ('bg-gray-50 rounded-2xl p-4', 0)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check44.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check44.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])
print('DIVS', data.count('<div'), data.count('</div>'))
