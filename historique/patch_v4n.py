# -*- coding: utf-8 -*-
# patch_v4n.py -> v3.52
# Titre de la carte "Mon tableau de service" (page Profil) : "Mon tableau de service (15 h)"
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

rep("""        <div class="stat-label mb-3">Mon tableau de service — <span id="profil-service-entete"></span></div>""",
    """        <div class="stat-label mb-3">Mon tableau de service <span id="profil-service-entete"></span></div>""",
    1, 'titre sans tiret')

rep("""  if (entete) entete.textContent = 'service ' + formatDureeService(heuresServiceMinutes(email)) + ' / 20 h';""",
    """  if (entete) entete.textContent = '(' + formatDureeService(heuresServiceMinutes(email)) + ')';""",
    1, 'en-tete = (Xh)')

rep('AbsenceTrack v3.51', 'AbsenceTrack v3.52', 1, 'label v3.52')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
