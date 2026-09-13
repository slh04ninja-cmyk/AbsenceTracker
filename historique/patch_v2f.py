# -*- coding: utf-8 -*-
"""v2 -> reset complet de l'ecran enseignant a la deconnexion/connexion."""
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

# ---------- 1. choisirClasse('') vide aussi la liste HTML ----------
oldEmpty = '''  if (!id) {
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    filterActive = 'all';
    document.getElementById('ens-classe-name').textContent = 'Sélectionnez une classe';
    if (zone) zone.classList.add('hidden');
    return;
  }'''
newEmpty = '''  if (!id) {
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    filterActive = 'all';
    document.getElementById('ens-classe-name').textContent = 'Sélectionnez une classe';
    if (zone) zone.classList.add('hidden');
    const liste = document.getElementById('liste-eleves-enseignant');
    if (liste) liste.innerHTML = '';
    return;
  }'''
plain('1-resetListe', oldEmpty, newEmpty)

# ---------- 2. deconnexion : reinitialiser la page enseignant ----------
oldDeco = '''function deconnexion() {
  utilisateurConnecte = null;
  elevesCoches.clear();
  decochesManuellement.clear();
  classeSelectionnee = null;
  localStorage.removeItem('utilisateur');'''
newDeco = '''function deconnexion() {
  utilisateurConnecte = null;
  elevesCoches.clear();
  decochesManuellement.clear();
  classeSelectionnee = null;
  choisirClasse('');
  localStorage.removeItem('utilisateur');'''
plain('2-resetDeco', oldDeco, newDeco)

# ---------- 3. connexion enseignant : page propre a l'arrivee ----------
plain('3-resetLogin',
      "  if (compte.role === 'enseignant') {\n    afficherEcran('enseignant');\n    remplirListeClasses();",
      "  if (compte.role === 'enseignant') {\n    afficherEcran('enseignant');\n    remplirListeClasses();\n    choisirClasse('');")

# ---------- 4. version ----------
plain('4-version', 'AbsenceTrack v1.4 \u2014 Prototype', 'AbsenceTrack v1.5 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('choisirClasse(\'\')', 2), ('choisirClasse(\"\"', 0), ('liste-eleves-enseignant', 4)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check6.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
else:
    print('NODE_CHECK skipped (node absent)')
