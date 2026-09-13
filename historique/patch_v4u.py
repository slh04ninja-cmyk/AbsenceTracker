# -*- coding: utf-8 -*-
# patch_v4u.py -> v3.59
# Modale "Annuler une seance" : marges reduites + liste des seances annulees dans un div a defilement
import io, sys

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-52s occurrences=%d (attendu %d) %s' % (nom or old[:46], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok: sys.exit(1)
    s = s.replace(old, new)

# 1. CSS dedie a la modale d'annulation (memes regles que la carte Etablissement) + zone a defilement
rep("""    /* Carte Etablissement : compacte pour limiter le defilement */""",
"""    /* Modale Annuler une seance : compacte + liste des annulations a defilement */
    #modal-annulation .form-group { margin-bottom: 8px; }
    #modal-annulation .form-group label { font-size: 11.5px; margin-bottom: 3px; }
    #modal-annulation .form-group input, #modal-annulation .form-group select { padding: 9px 12px; font-size: 14px; border-radius: 10px; }
    #modal-annulation .sd-trigger { min-height: 38px; padding: 8px 12px; font-size: 14px; }
    #modal-annulation .btn-danger { padding: 10px 14px; margin-bottom: 10px; }
    #modal-annulation #annul-liste {
      max-height: 168px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px;
    }
    body.theme-sombre #modal-annulation #annul-liste { background: #0f172a; border-color: #334155; }
    #modal-annulation #annul-liste > div { padding: 6px 10px; margin-bottom: 4px; }
    #modal-annulation #annul-liste > div:last-child { margin-bottom: 0; }

    /* Carte Etablissement : compacte pour limiter le defilement */""",
    1, 'CSS : modale annulation compacte')

# 2. libelle de la section un peu plus compact
rep("""        <div class="stat-label mb-2">Séances annulées ce jour</div>""",
"""        <div class="stat-label" style="margin-bottom: 4px;">Séances annulées ce jour</div>""",
    1, 'libelle section compact')

# 3. Version
rep('AbsenceTrack v3.58', 'AbsenceTrack v3.59', 1, 'label v3.59')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
