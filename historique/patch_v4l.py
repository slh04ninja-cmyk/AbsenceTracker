# -*- coding: utf-8 -*-
# patch_v4l.py -> v3.50 (suite)
# Donnees de test : mixer les Ab/Rd non justifies (absences ET retards) pour montrer
# dans le popup "Retard" (dans les 30 min) et "Retard -> Absence" (hors delai).
import io, sys

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-46s occurrences=%d (attendu %d) %s' % (nom or old[:40], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok: sys.exit(1)
    s = s.replace(old, new)

# 1. creer() accepte un type force (pour les non justifies)
rep("  function creer(eleve, classe, creneau, dateISO, justifie) {\n    const estRetard = Math.random() < 0.3;",
    "  function creer(eleve, classe, creneau, dateISO, justifie, typeForce) {\n    const estRetard = typeForce ? (typeForce === 'retard') : (Math.random() < 0.3);",
    1, 'creer : type force')

# 2. placerNonJustifies : types imposes un par un
rep("""  function placerNonJustifies(nombre, dateISO, jour, matinSeulement) {""",
    """  function placerNonJustifies(nombre, dateISO, jour, matinSeulement, types) {""",
    1, 'placerNonJustifies : parametre types')

rep("""      absences.push(creer(p.el, p.cl, p.cr, dateISO, false));""",
    """      absences.push(creer(p.el, p.cl, p.cr, dateISO, false, types ? types[n] : ''));""",
    1, 'placerNonJustifies : type du n-ieme')

# 3. appels : 1 absence + 1 retard hier, 2 absences + 2 retards aujourd'hui
rep("""  placerNonJustifies(2, fmtDateISO(hier), hier.getDay());
  placerNonJustifies(4, fmtDateISO(aujourdHui), aujourdHui.getDay(), true);""",
    """  placerNonJustifies(2, fmtDateISO(hier), hier.getDay(), false, ['absence', 'retard']);
  placerNonJustifies(4, fmtDateISO(aujourdHui), aujourdHui.getDay(), true, ['absence', 'retard', 'retard', 'absence']);""",
    1, 'appels : mix absence/retard')

# 4. nouveau garde : le jeu de test doit se regenerer chez l'utilisateur
rep("testHistoGenere_v5", "testHistoGenere_v6", 2, 'garde _v6')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
