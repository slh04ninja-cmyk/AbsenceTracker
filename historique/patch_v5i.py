# -*- coding: utf-8 -*-
# patch_v5i.py -> v3.71
# Un seul theme clair (identique pour les 3 roles), elegant et lisible :
#   - fonds de listes teintes + bordures visibles, cartes blanches a l'interieur
#   - bleu nuit (#26395A) + corail (#E15F67) + teal (#0C829F) + fonds doux
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
# 1. Une seule palette pour le theme clair (les 3 roles)
# ══════════════════════════════════════════════════════════════════
rep("""    /* Lots du theme clair : enseignant = lot 8, surveillant = lot 7, directeur = lot 9 */
    body.role-enseignant { --lot-fond: #FFFFFF; --lot-primaire: #F82667; --lot-fonce: #33018D; --lot-accent: #AB1370; --lot-clair: #F868A3; --lot-neutre: #53068A; }
    body.role-surveillant { --lot-fond: #EEEDED; --lot-primaire: #0C829F; --lot-fonce: #68CCA1; --lot-accent: #828E99; --lot-clair: #9CC0CA; --lot-neutre: #0C829F; }
    body.role-directeur { --lot-fond: #FFFFFF; --lot-primaire: #26395A; --lot-fonce: #6E7E93; --lot-accent: #E15F67; --lot-clair: #FFFFFF; --lot-neutre: #A1A7AD; }""",
"""    /* Theme clair UNIQUE (identique pour les 3 roles) : bleu nuit + corail + teal + fonds doux */
    body.role-enseignant, body.role-surveillant, body.role-directeur {
      --lot-fond: #F4F6FA;          /* fond de page */
      --lot-primaire: #26395A;      /* bleu nuit : barres, boutons, textes forts */
      --lot-fonce: #6E7E93;         /* fin du degrade */
      --lot-accent: #E15F67;        /* corail : bouton Fermer, carte des compteurs */
      --lot-clair: #EDF1F7;         /* fond des listes de cartes */
      --lot-bordure: #D7E0EA;       /* bordures visibles */
      --lot-neutre: #6E7E93;        /* libelles et textes secondaires */
      --lot-secondaire: #0C829F;    /* teal : pastilles et touches */
    }""",
    1, 'CSS : palette claire unique')

# ══════════════════════════════════════════════════════════════════
# 2. Listes : fond teinte, bordure visible, cartes blanches dedans
# ══════════════════════════════════════════════════════════════════
rep("""      background: var(--lot-clair); border-color: var(--lot-neutre);
    }""",
"""      background: var(--lot-clair); border-color: var(--lot-bordure);
    }
    /* Les cartes a l'interieur des listes sont blanches : elles ressortent sur le fond teinte */
    body.role-enseignant:not(.theme-sombre) .js-seances-annulees > div, body.role-surveillant:not(.theme-sombre) .js-seances-annulees > div,
    body.role-directeur:not(.theme-sombre) .js-seances-annulees > div, body.role-enseignant:not(.theme-sombre) .js-absences-personnel > div,
    body.role-surveillant:not(.theme-sombre) .js-absences-personnel > div, body.role-directeur:not(.theme-sombre) .js-absences-personnel > div,
    body.role-enseignant:not(.theme-sombre) .js-fermetures > div, body.role-surveillant:not(.theme-sombre) .js-fermetures > div,
    body.role-directeur:not(.theme-sombre) .js-fermetures > div, body.role-enseignant:not(.theme-sombre) .js-annulations > div,
    body.role-surveillant:not(.theme-sombre) .js-annulations > div, body.role-directeur:not(.theme-sombre) .js-annulations > div {
      background: #FFFFFF; border: 1px solid var(--lot-bordure);
    }
    /* Pastilles : teal du theme */
    body.role-enseignant:not(.theme-sombre) .tag-avenir, body.role-surveillant:not(.theme-sombre) .tag-avenir,
    body.role-directeur:not(.theme-sombre) .tag-avenir { color: var(--lot-secondaire); background: rgba(12, 130, 159, 0.12); }
    /* Cartes eleves de l'historique : degrade doux du theme */
    body.role-enseignant:not(.theme-sombre) .carte-eleve, body.role-surveillant:not(.theme-sombre) .carte-eleve,
    body.role-directeur:not(.theme-sombre) .carte-eleve {
      background: linear-gradient(135deg, var(--lot-clair) 0%, #FFFFFF 60%); border-color: var(--lot-bordure);
    }""",
    1, 'CSS : listes + cartes blanches + pastilles')

# ══════════════════════════════════════════════════════════════════
# 3. LOTS_ROLE (JS) : palette unique
# ══════════════════════════════════════════════════════════════════
rep("""const LOTS_ROLE = {
  // lot 8
  enseignant:  { fond: '#FFFFFF', primaire: '#F82667', fonce: '#33018D', accent: '#AB1370', clair: '#F868A3', neutre: '#53068A' },
  // lot 7
  surveillant: { fond: '#EEEDED', primaire: '#0C829F', fonce: '#68CCA1', accent: '#828E99', clair: '#9CC0CA', neutre: '#0C829F' },
  // lot 9
  directeur:   { fond: '#FFFFFF', primaire: '#26395A', fonce: '#6E7E93', accent: '#E15F67', clair: '#FFFFFF', neutre: '#A1A7AD' }
};""",
"""// Theme clair unique (les 3 roles partagent la meme palette)
const LOT_CLAIR = {
  fond: '#F4F6FA', primaire: '#26395A', fonce: '#6E7E93', accent: '#E15F67',
  clair: '#EDF1F7', bordure: '#D7E0EA', neutre: '#6E7E93', secondaire: '#0C829F'
};
const LOTS_ROLE = { enseignant: LOT_CLAIR, surveillant: LOT_CLAIR, directeur: LOT_CLAIR };""",
    1, 'JS : palette claire unique')

# ══════════════════════════════════════════════════════════════════
# 4. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.70', 'AbsenceTrack v3.71', 1, 'label v3.71')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
