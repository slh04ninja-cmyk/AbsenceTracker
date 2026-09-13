# -*- coding: utf-8 -*-
"""Petit correctif : mesurer la hauteur d'une appbar VISIBLE (les cachees valent 0)."""
import re, io, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()

old = """function ajusterHauteurAppbar() {
  const barre = document.querySelector('.appbar');
  if (!barre) return;
  const h = barre.offsetHeight;
  if (h > 0) document.documentElement.style.setProperty('--appbar-h', h + 'px');
}"""
new = """function ajusterHauteurAppbar() {
  // Les barres des pages masquees ont une hauteur de 0 : on prend la plus grande
  let h = 0;
  document.querySelectorAll('.appbar').forEach(b => { if (b.offsetHeight > h) h = b.offsetHeight; });
  if (h > 0) document.documentElement.style.setProperty('--appbar-h', h + 'px');
}"""
c = data.count(old)
print('occurrences', c)
if c == 1:
    data = data.replace(old, new)
    io.open(F, 'w', encoding='utf-8').write(data)
    print('OK')
node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check28.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check28.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])
