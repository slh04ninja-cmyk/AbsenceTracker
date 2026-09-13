# -*- coding: utf-8 -*-
"""AbsenceTrack v3.42 : correction de perimetre.

Les absences non justifiees des JOURS PRECEDENTS doivent apparaitre dans les Dashboards du
DIRECTEUR et du SURVEILLANT (pas dans celui de l'enseignant, qui est termine).

- suppression du bloc enseignant #ens-absences-passees, de afficherAbsencesNonJustifieesEnseignant()
  et de ses 4 points d'appel
- le Dashboard surveillant utilise le renderer generique sans filtre du jour (aujourd'hui + jours
  precedents), comme le directeur ; afficherCartesAbsentsJour() disparait
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-46s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

def supprime_fonction(nom):
    global s
    i = s.index('function ' + nom + '(')
    # on remonte l'eventuel commentaire de la ligne precedente
    debut = i
    ligne = s.rfind('\n', 0, i) + 1
    if s[ligne:i].strip().startswith('//'):
        debut = ligne
    j = s.index('{', i); d = 0; k = j
    while True:
        if s[k] == '{': d += 1
        elif s[k] == '}':
            d -= 1
            if d == 0: k += 1; break
        k += 1
    # on avale les sauts de ligne qui suivent
    while k < len(s) and s[k] == '\n':
        k += 1
    taille = k - debut
    s = s[:debut] + s[k:]
    print('OK   fonction %-28s supprimee (%d caracteres)' % (nom, taille))
    return True

# ---------- 1. enseignant : bloc + fonction + appels ----------
allok &= remplace('bloc enseignant retire',
                  '      <div id="ens-absences-passees" class="mb-4 hidden"></div>\n', '')
allok &= supprime_fonction('afficherAbsencesNonJustifieesEnseignant')
allok &= remplace('appel switchEnsPage retire',
                  "  if (page === 'enseignant') { afficherListeEleves(); afficherAbsencesNonJustifieesEnseignant(); }",
                  "  if (page === 'enseignant') afficherListeEleves();")
allok &= remplace('appel connexion() retire',
                  "    afficherInfosProf();\n    afficherAbsencesNonJustifieesEnseignant();",
                  "    afficherInfosProf();")
allok &= remplace('appel init() retire',
                  "afficherInfosProf(); afficherAbsencesNonJustifieesEnseignant(); }",
                  "afficherInfosProf(); }")
allok &= remplace('appel apres enregistrement retire',
                  "  mettreAJourEnteteListe();\n  afficherAbsencesNonJustifieesEnseignant();",
                  "  mettreAJourEnteteListe();")

# ---------- 2. surveillant : aujourd'hui + jours precedents ----------
allok &= supprime_fonction('afficherCartesAbsentsJour')
allok &= remplace('appel du dashboard surveillant',
                  "  afficherCartesAbsentsJour('surv-absences-list');",
                  "  // Absents NON JUSTIFIES : aujourd'hui et jours precedents\n  afficherCartesAbsentsNonJustifies('surv-absences-list', { messageVide: 'Aucun élève non justifié' });")

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.41', 'AbsenceTrack v3.42', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.42 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('ens-absences-passees', 0), ('afficherAbsencesNonJustifieesEnseignant', 0),
                     ('afficherCartesAbsentsJour', 0),
                     ("afficherCartesAbsentsNonJustifies('surv-absences-list'", 1),
                     ("afficherCartesAbsentsNonJustifies('dir-absences-list'", 1),
                     ('function afficherCartesAbsentsNonJustifies', 1),
                     ('id="zone-prise-absence"', 1), ('id="page-profil"', 1),
                     ('id="page-dir-stats"', 1), ('id="page-surv-classes"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-52s = %d' % (cle, n))
    allok &= (n == attendu)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
