# -*- coding: utf-8 -*-
"""patch_v5p.py (complete v3.77) — menage dans le code mort

Trouve en cherchant les fonctions declarees mais jamais citees (2 cas) :

1. `afficherIndispos()` n'etait JAMAIS appelee, alors que son corps (les deux appels
   a afficherAbsencesPersonnel) etait RECOPIE a l'identique a 4 endroits.
   -> on la met a contribution : les 3 copies hors definition deviennent un appel.

2. `supprimerAbsence(id)` + `vraimentSupprimerAbsence(id)` : personne ne les appelle
   (vestige de l'ancienne suppression de signalement cote enseignant, retiree depuis).
   -> supprimees, comme le veut la regle du projet (supprimer le code mort plutot que
   le reparer).
"""
import io, re, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
ok = True

# ---------------------------------------------------------------------------
# 1. afficherIndispos() : dedupliquer son corps
# ---------------------------------------------------------------------------
# l'indentation varie selon l'endroit (dans switchProfil les appels sont plus imbriques)
motif_paire = re.compile(
    r"afficherAbsencesPersonnel\('indispo-liste', 'enseignant'\);\s*\n\s*"
    r"afficherAbsencesPersonnel\('abs-surv-liste', 'surveillant'\);")
occ = [m for m in motif_paire.finditer(html)]
print('copies du couple de rafraichissement : %d' % len(occ))
if len(occ) != 4:
    print('!! 4 copies attendues (definition + 3 appels)'); ok = False

position_def = html.index('function afficherIndispos()')
corps_def = [m for m in occ if position_def < m.start() < position_def + 120]
if len(corps_def) != 1:
    print('!! corps de afficherIndispos introuvable (%d)' % len(corps_def)); ok = False

cibles = [m for m in occ if m.start() not in [c.start() for c in corps_def]]
print('appels a remplacer : %d' % len(cibles))
if len(cibles) != 3:
    print('!! 3 appels attendus'); ok = False

for m in sorted(cibles, key=lambda x: x.start(), reverse=True):
    html = html[:m.start()] + 'afficherIndispos();' + html[m.end():]
if ok:
    print('OK afficherIndispos() utilise desormais a %d endroits'
          % len(re.findall(r'afficherIndispos\(\)', html)))

# ---------------------------------------------------------------------------
# 2. supprimer le couple mort supprimerAbsence / vraimentSupprimerAbsence
# ---------------------------------------------------------------------------
for nom in ['supprimerAbsence', 'vraimentSupprimerAbsence']:
    m = re.search(r'\nfunction ' + nom + r'\([^)]*\)\s*\{[\s\S]*?\n\}\n', html)
    if not m:
        print('!! %s introuvable' % nom); ok = False; continue
    html = html.replace(m.group(0), '\n')
    print('OK supprime %s() (code mort)' % nom)

for reste in ['supprimerAbsence', 'vraimentSupprimerAbsence']:
    n = len(re.findall(re.escape(reste), html))
    if n:
        print('!! residu %s : %d' % (reste, n)); ok = False
    else:
        print('OK plus aucune trace de %s' % reste)

if not ok:
    print('=== PATCH ANNULE ==='); sys.exit(1)

shutil.copyfile(F, F + '.avant-menage')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)' % (F, len(html.encode('utf-8'))))
