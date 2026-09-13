# -*- coding: utf-8 -*-
# patch_v5x.py — v3.84 : boutons distincts en mode sombre + menu deroulant qui s'ouvre vers le haut
#   A. EN MODE SOMBRE les boutons « Générer / Réinitialiser » et « Supprimer ce surveillant »
#      prenaient le style du bouton « Fermer » : la regle
#      `body.theme-sombre .btn-fermer { background: #ea580c !important; ... }`
#      ecrasait leur style en ligne (contour bleu / rouge). -> ils passent a de vraies
#      classes de contour (.btn-outline-primaire / .btn-outline-danger) declarees dans les 2 themes.
#   B. MENU DEROULANT : quand le champ est proche des boutons (ex. « Portée » dans
#      « Ajouter une fermeture »), la liste depassait sous les boutons et devenait
#      invisible. -> mesure de la place reelle : si la liste ne tient pas en dessous et
#      qu'il y a plus de place au-dessus, elle s'ouvre vers le HAUT (.sd-haut) et sa
#      hauteur est bornee a la place visible.
import io, re, sys, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
orig = s
rapport = []


def rem(nom, ancien, nouveau, n=1):
    global s
    c = s.count(ancien)
    if c != n:
        print('ECHEC %s : %d occurrence(s) au lieu de %d' % (nom, c, n))
        sys.exit(1)
    s = s.replace(ancien, nouveau)
    rapport.append('%s : %d' % (nom, c))


# ============================================================
# A. BOUTONS — classes de contour reelles (elles resistent au mode sombre)
# ============================================================
BOUTONS_CSS = """    /* Contour bleu (mot de passe : « Générer » / « Réinitialiser ») — tient dans les 2 themes */
    .btn-outline-primaire { width: 100%; padding: 10px 14px; border-radius: 12px; border: 2px solid var(--primary); background: transparent; color: var(--primary); font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
    .btn-outline-primaire:hover { background: rgba(30, 58, 138, 0.08); }
    body.theme-sombre .btn-outline-primaire { border-color: #93c5fd; color: #93c5fd; }
    body.theme-sombre .btn-outline-primaire:hover { background: rgba(147, 197, 253, 0.12); }
"""
ANCRE = 'body.theme-sombre .btn-outline-danger { border-color: #f87171; color: #fca5a5; }'
rem('CSS contour bleu', ANCRE, ANCRE + '\n' + BOUTONS_CSS)

# hauteur UNIQUE : la nouvelle classe doit entrer dans le gabarit des boutons d'action
rem('gabarit de hauteur unique',
    '\n    .btn-outline-danger, .btn-mini-profil {',
    '\n    .btn-outline-primaire, .btn-outline-danger, .btn-mini-profil {')

# bouton du mot de passe : classe de contour au lieu de btn-fermer + style en ligne
rem('bouton mot de passe',
    '<button type="button" id="btn-mdp-action" class="w-full mb-3 btn-fermer" style="border: 2px solid var(--primary); color: var(--primary); background: transparent;" onclick="actionMotDePasse()">',
    '<button type="button" id="btn-mdp-action" class="w-full mb-3 btn-outline-primaire" onclick="actionMotDePasse()">')

# bouton de suppression du surveillant : classe contour-rouge (deja prevue pour le mode sombre)
rem('bouton supprimer surveillant',
    '<button type="button" id="renommer-supprimer" class="hidden w-full btn-fermer mb-2" style="border: 2px solid #dc2626; color: #dc2626; background: transparent;" onclick="supprimerProfilCourant()">',
    '<button type="button" id="renommer-supprimer" class="hidden w-full btn-outline-danger mb-2" onclick="supprimerProfilCourant()">')

# ============================================================
# B. MENU DEROULANT — ouverture vers le haut quand la place manque en dessous
# ============================================================
SD_CSS = """
    /* La liste s'ouvre vers le HAUT quand il n'y a pas la place en dessous (champ proche des boutons) */
    .sd.sd-haut .sd-panel { top: auto; bottom: calc(100% + 6px); }
    .sd.sd-haut.ouvert .sd-panel { animation-name: sd-apparait-haut; }
    @keyframes sd-apparait-haut { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
"""
ANCRE_SD = 'body.theme-sombre .sd-option.actif { background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%); color: #ffffff; }'
rem('CSS ouverture vers le haut', ANCRE_SD, ANCRE_SD + '\n' + SD_CSS)

SD_JS = r'''// Place la liste : en dessous s'il y a la place, sinon AU-DESSUS (jamais cachee sous les boutons).
function sdPlacer(conteneur) {
  const panneau = conteneur.querySelector('.sd-panel');
  const bouton = conteneur.querySelector('.sd-trigger');
  if (!panneau || !bouton) return;
  conteneur.classList.remove('sd-haut');
  panneau.style.maxHeight = '';
  const rb = bouton.getBoundingClientRect ? bouton.getBoundingClientRect() : null;
  if (!rb || (!rb.top && !rb.bottom)) return;          // pas de geometrie (tests jsdom) : on ne touche a rien
  const marge = 12;
  const hauteurVoulue = Math.min(panneau.scrollHeight || 264, 264);
  // limite visible : le premier ancetre qui defile (corps du formulaire), sinon la fenetre
  let bas = window.innerHeight || 800, haut = 0, zone = conteneur.parentElement;
  while (zone) {
    const st = window.getComputedStyle(zone);
    if (/(auto|scroll)/.test(st.overflowY)) {
      const rz = zone.getBoundingClientRect();
      bas = Math.min(bas, rz.bottom);
      haut = Math.max(haut, rz.top);
      break;
    }
    zone = zone.parentElement;
  }
  const placeBas = bas - rb.bottom - marge;
  const placeHaut = rb.top - haut - marge;
  if (placeBas < hauteurVoulue && placeHaut > placeBas) {
    conteneur.classList.add('sd-haut');                 // les elements de menu glissent vers le haut
    panneau.style.maxHeight = Math.max(96, Math.min(hauteurVoulue, placeHaut)) + 'px';
  } else if (placeBas < hauteurVoulue) {
    panneau.style.maxHeight = Math.max(96, placeBas) + 'px';
  }
}

'''
ANCRE_JS = 'function sdBasculer(conteneur) {'
rem('JS sdPlacer', ANCRE_JS, SD_JS + ANCRE_JS)

rem('appel de sdPlacer a l ouverture',
    """  sdMajLibelle(conteneur);
  sdConstruireOptions(conteneur);
  conteneur.classList.add('ouvert');
}""",
    """  sdMajLibelle(conteneur);
  sdConstruireOptions(conteneur);
  conteneur.classList.add('ouvert');
  sdPlacer(conteneur);                                  // <- place la liste (haut ou bas)
}""")

rem('label version', 'AbsenceTrack v3.83 — Prototype', 'AbsenceTrack v3.84 — Prototype')

io.open(F, 'w', encoding='utf-8').write(s)

sc = re.findall(r'<script>(.*?)</script>', s, re.S)
bloc = max(sc, key=len)
tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check_v5x.js'
io.open(tmp, 'w', encoding='utf-8').write(bloc)
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('node --check :', 'OK' if r.returncode == 0 else r.stderr[:400])
print('divs : %d / %d' % (s.count('<div'), s.count('</div>')))
print('btn-fermer restants :', s.count('btn-fermer'))
print('taille : %d -> %d' % (len(orig), len(s)))
for x in rapport:
    print(' -', x)
