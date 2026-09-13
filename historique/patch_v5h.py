# -*- coding: utf-8 -*-
# patch_v5h.py -> v3.70
# Nouveaux lots de couleurs du theme clair (lots 7, 8, 9) appliques aux 3 roles :
#   enseignant = lot 8 (F82667 / 33018D / F868A3 / AB1370 / 53068A)
#   surveillant = lot 7 (EEEDED / 0C829F / 68CCA1 / 828E99 / 9CC0CA)
#   directeur  = lot 9 (FFFFFF / 26395A / A1A7AD / 6E7E93 / E15F67)
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

# ══════════════════════════════════════════════════════════════════
# 1. Variables des lots par role
# ══════════════════════════════════════════════════════════════════
rep("""    body.role-enseignant { --lot-primaire: #6994CC; --lot-fonce: #363759; --lot-accent: #AAAAD0; }
    body.role-surveillant, body.role-directeur { --lot-primaire: #566C9D; --lot-fonce: #3D3E4E; --lot-accent: #EB7F69; }
    body.role-directeur { --lot-primaire: #566C9D; --lot-fonce: #3D3E4E; --lot-accent: #EB7F69; }""",
"""    /* Lots du theme clair : enseignant = lot 8, surveillant = lot 7, directeur = lot 9 */
    body.role-enseignant { --lot-fond: #FFFFFF; --lot-primaire: #F82667; --lot-fonce: #33018D; --lot-accent: #AB1370; --lot-clair: #F868A3; --lot-neutre: #53068A; }
    body.role-surveillant { --lot-fond: #EEEDED; --lot-primaire: #0C829F; --lot-fonce: #68CCA1; --lot-accent: #828E99; --lot-clair: #9CC0CA; --lot-neutre: #0C829F; }
    body.role-directeur { --lot-fond: #FFFFFF; --lot-primaire: #26395A; --lot-fonce: #6E7E93; --lot-accent: #E15F67; --lot-clair: #FFFFFF; --lot-neutre: #A1A7AD; }
    /* Fond de page du lot (theme clair) */
    body.role-enseignant:not(.theme-sombre), body.role-surveillant:not(.theme-sombre), body.role-directeur:not(.theme-sombre) { background: var(--lot-fond); }
    /* Textes secondaires (labels, aides, sous-titres des listes) avec le gris du lot */
    body.role-enseignant:not(.theme-sombre) .stat-label, body.role-surveillant:not(.theme-sombre) .stat-label,
    body.role-directeur:not(.theme-sombre) .stat-label, body.role-enseignant:not(.theme-sombre) .aide,
    body.role-surveillant:not(.theme-sombre) .aide, body.role-directeur:not(.theme-sombre) .aide,
    body.role-enseignant:not(.theme-sombre) .carte-ligne-sous, body.role-surveillant:not(.theme-sombre) .carte-ligne-sous,
    body.role-directeur:not(.theme-sombre) .carte-ligne-sous { color: var(--lot-neutre); }
    /* Fonds des listes de cartes avec la couleur claire du lot */
    body.role-enseignant:not(.theme-sombre) .js-seances-annulees, body.role-surveillant:not(.theme-sombre) .js-seances-annulees,
    body.role-directeur:not(.theme-sombre) .js-seances-annulees, body.role-enseignant:not(.theme-sombre) .js-absences-personnel,
    body.role-surveillant:not(.theme-sombre) .js-absences-personnel, body.role-directeur:not(.theme-sombre) .js-absences-personnel,
    body.role-enseignant:not(.theme-sombre) .js-fermetures, body.role-surveillant:not(.theme-sombre) .js-fermetures,
    body.role-directeur:not(.theme-sombre) .js-fermetures, body.role-enseignant:not(.theme-sombre) .js-annulations,
    body.role-surveillant:not(.theme-sombre) .js-annulations, body.role-directeur:not(.theme-sombre) .js-annulations {
      background: var(--lot-clair); border-color: var(--lot-neutre);
    }""",
    1, 'CSS : variables des lots 7 / 8 / 9')

# ══════════════════════════════════════════════════════════════════
# 2. Table LOTS_ROLE (JS)
# ══════════════════════════════════════════════════════════════════
rep("""const LOTS_ROLE = {
  enseignant:  { primaire: '#6994CC', fonce: '#363759', accent: '#AAAAD0' },
  surveillant: { primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69' },
  directeur:   { primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69' }
};""",
"""const LOTS_ROLE = {
  // lot 8
  enseignant:  { fond: '#FFFFFF', primaire: '#F82667', fonce: '#33018D', accent: '#AB1370', clair: '#F868A3', neutre: '#53068A' },
  // lot 7
  surveillant: { fond: '#EEEDED', primaire: '#0C829F', fonce: '#68CCA1', accent: '#828E99', clair: '#9CC0CA', neutre: '#0C829F' },
  // lot 9
  directeur:   { fond: '#FFFFFF', primaire: '#26395A', fonce: '#6E7E93', accent: '#E15F67', clair: '#FFFFFF', neutre: '#A1A7AD' }
};""",
    1, 'JS : LOTS_ROLE (lots 7 / 8 / 9)')

# ══════════════════════════════════════════════════════════════════
# 3. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.69', 'AbsenceTrack v3.70', 1, 'label v3.70')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
