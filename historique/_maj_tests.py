# -*- coding: utf-8 -*-
"""Adapte les tests aux nouvelles donnees (v3.48) : emails des profs reels + noms/matieres arabes."""
import io, glob

REMPLACEMENTS = [
    ("math@taalim.ma", "math-prof1@taalim.ma"),
    ("pc@taalim.ma", "pc-prof1@taalim.ma"),
    ("svt@taalim.ma", "svt-prof1@taalim.ma"),
    ("fr@taalim.ma", "fr-prof1@taalim.ma"),
    ("ar@taalim.ma", "ar-prof1@taalim.ma"),
    ("Prof. Mathématiques", "أيوب الكمرة"),
    ("Prof. Physique", "غزالي صالح"),
    ("Prof. SVT", "كمال الوردي"),
    ("Prof. Français", "سامية الحاضي"),
    ("Prof. Arabe", "المهدي الصلحي"),
    ("matiere: 'Mathématiques'", "matiere: 'Maths'"),
    ("matiere: 'Physique'", "matiere: 'PC'"),
    ("(Mathématiques)", "(Maths)"),
]

for fichier in sorted(glob.glob('test_*.js')):
    s = io.open(fichier, encoding='utf-8').read()
    avant = s
    for a, b in REMPLACEMENTS:
        s = s.replace(a, b)
    if s != avant:
        io.open(fichier, 'w', encoding='utf-8').write(s)
        print('adapte :', fichier)
print('termine')
