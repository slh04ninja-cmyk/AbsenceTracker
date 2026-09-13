# -*- coding: utf-8 -*-
"""AbsenceTrack v3.26 : moins d'espace entre les options des listes deroulantes."""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def rep(label, a, b, n=1):
    global s
    new, c = re.subn(a, b, s, flags=re.S)
    ok = (c == n)
    print(('OK   ' if ok else 'ECHEC') + ' %-26s =%d (attendu %d)' % (label, c, n))
    if ok:
        s = new
    return ok

# 1. marge entre 2 options : 2 px -> 0
allok &= rep('marge entre options', r"    \.sd-option \+ \.sd-option \{ margin-top: 2px; \}\n",
             "")
# 2. hauteur de chaque option : padding 12px 14px -> 8px 13px, coins 10 -> 9
allok &= rep('padding option', r"      display: flex; align-items: center; justify-content: space-between; gap: 8px;\n      padding: 12px 14px; border-radius: 10px;\n",
             "      display: flex; align-items: center; justify-content: space-between; gap: 8px;\n      padding: 8px 13px; border-radius: 9px;\n")
# 3. padding interne du panneau : 6 px -> 4 px
allok &= rep('padding panneau', r"      box-shadow: 0 18px 40px rgba\(15, 23, 42, 0\.22\);\n      padding: 6px; display: none;\n",
             "      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);\n      padding: 4px 6px; display: none;\n")
# 4. distance bouton -> panneau : 6 px -> 4 px
allok &= rep('distance bouton/panneau', r"      position: absolute; left: 0; right: 0; top: calc\(100% \+ 6px\); z-index: 300;\n",
             "      position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 300;\n")
# 5. hauteur max : un peu plus courte, coherente avec des lignes plus fines
allok &= rep('hauteur max panneau', r"      max-height: 264px; overflow-y: auto;",
             "      max-height: 248px; overflow-y: auto;")

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.25', 'AbsenceTrack v3.26', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.26 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

bloc = s[s.index('/* ========== LISTES DEROULANTES PERSONNALISEES'):s.index('body.theme-sombre .sd-option.actif')]
print(('OK   ' if bloc.count('{') == bloc.count('}') else 'ECHEC') + ' accolades CSS %d/%d' % (bloc.count('{'), bloc.count('}')))
allok &= (bloc.count('{') == bloc.count('}'))
print(('OK   ' if 'margin-top: 2px' not in bloc else 'ECHEC') + ' ancienne marge supprimee')
allok &= ('margin-top: 2px' not in bloc)
print(('OK   ' if 'padding: 8px 13px' in bloc else 'ECHEC') + ' nouveau padding option')
allok &= ('padding: 8px 13px' in bloc)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:200] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
