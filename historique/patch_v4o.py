# -*- coding: utf-8 -*-
# patch_v4o.py -> v3.53
# Titre de la carte "Mon tableau de service" (page Profil) : meme style que "Changer le mot de passe" + icone
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

rep("""        <div class="stat-label mb-3">Mon tableau de service <span id="profil-service-entete"></span></div>""",
    """        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-calendar-alt text-blue-900 mr-2"></i>Mon tableau de service <span id="profil-service-entete"></span></h3>""",
    1, 'titre : style + icone')

rep('AbsenceTrack v3.52', 'AbsenceTrack v3.53', 1, 'label v3.53')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
