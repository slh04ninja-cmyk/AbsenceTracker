# -*- coding: utf-8 -*-
"""patch_v5o.py -> v3.77

CORRECTIF : la liste des surveillants ne survivait pas au redemarrage.
`chargerSurveillantsRH()` (relire la liste enregistree) avait ete ecrite mais JAMAIS
appelee : `surveillantsRH` restait a null et `appliquerListeSurveillants()` sortait
immediatement. Un surveillant ajoute disparaissait donc au rechargement de l'app.

Le test de non-regression correspondant recharge l'application avec le meme stockage
local (test_v377.js) : c'est ce qui manquait pour attraper ce bug.
"""
import io, re, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
ok = True

ancien = """function init() {
  appliquerNomsProfs();
  appliquerMotsDePasse(); appliquerListeSurveillants();"""
nouveau = """function init() {
  // relecture de la liste des surveillants AVANT de la reinjecter dans les comptes
  // (sans cette ligne, un surveillant ajoute disparaissait au redemarrage)
  surveillantsRH = chargerSurveillantsRH();
  appliquerNomsProfs();
  appliquerMotsDePasse(); appliquerListeSurveillants();"""
n = html.count(ancien)
if n != 1:
    print('!! init() : %d occurrence(s) (attendu 1)' % n); ok = False
else:
    html = html.replace(ancien, nouveau, 1)
    print('OK init() : chargement de la liste des surveillants')

# label
n = html.count('AbsenceTrack v3.76')
if n != 1:
    print('!! label : %d' % n); ok = False
else:
    html = html.replace('AbsenceTrack v3.76', 'AbsenceTrack v3.77', 1)
    print('OK label v3.77')

# controle : la fonction de relecture est desormais bien appelee
appels = len(re.findall(r'chargerSurveillantsRH\(\)', html))
print('chargerSurveillantsRH() : %d occurrence(s) (definition + appel attendu = 2)' % appels)
if appels != 2:
    ok = False

if not ok:
    print('=== PATCH ANNULE ==='); sys.exit(1)

shutil.copyfile(F, 'AbsenceTrack-v3.76-backup.html')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)  backup AbsenceTrack-v3.76-backup.html' % (F, len(html.encode('utf-8'))))
