# -*- coding: utf-8 -*-
# patch_v5w.py — v3.83 (suite) : les 3 CSS fournis par l'utilisateur, couleurs du theme
#   1. NOTIFICATIONS : mouvement demande (.notify -> translate(-50%,-160%), cubic-bezier(.18,1.25,.4,1),
#      0.55s) + disparition apres ~2.2 s ; les 6 tons (couleur = nature de l'action) restent
#   2. TOGGLE clair/sombre : le bouton rond devient un interrupteur (piste + pouce) avec
#      soleil (clair) / lune (sombre) en icones Font Awesome, couleurs du theme
#   3. CHECKBOXES : la case native (accent-color) devient la case dessinee (bord, coche
#      animee, remplissage qui monte) adaptee aux couleurs du theme
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
# 1. NOTIFICATIONS — mouvement fourni par l'utilisateur
# ============================================================
NOTIF_OLD = """    #toast { position: fixed; top: calc(var(--appbar-h, 56px) + 10px); left: 50%; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 24px); padding: 11px 14px 11px 11px; border-radius: 14px; color: #fff; font-size: 13px; font-weight: 600; line-height: 1.32; text-align: left; background: linear-gradient(135deg, var(--t1, #334155), var(--t2, #64748b)); box-shadow: 0 12px 26px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16); transform: translate(-50%, -220%); opacity: 0; z-index: 1200; pointer-events: none; transition: transform 0.34s cubic-bezier(0.18, 0.89, 0.32, 1.15), opacity 0.26s ease; }
    #toast.affiche { transform: translate(-50%, 0); opacity: 1; }
    #toast.sortie { transform: translate(-50%, -220%); opacity: 0; }"""
NOTIF_NEW = """    /* Mouvement demande : elle descend du haut et remonte en partant (.show) */
    #toast { position: fixed; top: calc(var(--appbar-h, 56px) + 10px); left: 50%; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 24px); padding: 11px 14px 11px 11px; border-radius: 14px; color: #fff; font-size: 13px; font-weight: 600; line-height: 1.32; text-align: left; background: linear-gradient(135deg, var(--t1, #334155), var(--t2, #64748b)); box-shadow: 0 12px 26px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16); transform: translate(-50%, -160%); opacity: 0; z-index: 1200; pointer-events: none; transition: transform 0.55s cubic-bezier(0.18, 1.25, 0.4, 1), opacity 0.3s; }
    #toast.show { transform: translate(-50%, 0); opacity: 1; }"""
rem('CSS notification (mouvement)', NOTIF_OLD, NOTIF_NEW)

# disparition : .show retire apres 2.2 s (au lieu de la classe .sortie a 3 s)
rem('JS : sortie apres 2.2 s', """  void toast.offsetWidth;                       // force le navigateur a jouer la transition
  toast.classList.add('affiche');
  toastMinuterie = setTimeout(function () {
    toast.classList.remove('affiche');
    toast.classList.add('sortie');
    toastMinuterieSortie = setTimeout(function () { toast.className = 'toast hidden'; }, 340);
  }, 3000);""",
"""  void toast.offsetWidth;                       // force le navigateur a jouer la transition
  toast.classList.add('show');
  toastMinuterie = setTimeout(function () {
    toast.classList.remove('show');
    toastMinuterieSortie = setTimeout(function () { toast.className = 'toast hidden'; }, 600);
  }, 2200);""")

# ============================================================
# 2. INTERRUPTEUR clair / sombre
# ============================================================
SWITCH_CSS = """    /* Interrupteur (mode clair / sombre) : piste + pouce, soleil et lune dessines */
    .switch { position: relative; display: inline-flex; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .switch input { position: absolute; opacity: 0; width: 0; height: 0; }
    .switch .track { position: relative; width: 52px; height: 28px; border-radius: 9999px; background: #8fb4d9; box-shadow: inset 0 1px 3px rgba(15,23,42,0.28); transition: background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
    .switch .thumb { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #f59e0b; box-shadow: 0 1px 3px rgba(15,23,42,0.35); display: flex; align-items: center; justify-content: center; font-size: 11px; transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s ease; }
    .switch .thumb .ic { position: absolute; transition: opacity 0.3s ease, transform 0.3s ease; }
    .switch .thumb .ic-clair { color: #7c4a00; opacity: 1; transform: scale(1); }
    .switch .thumb .ic-sombre { color: #0f172a; opacity: 0; transform: scale(0.6); }
    .switch input:checked + .track { background: #0f172a; }
    .switch input:checked + .track .thumb { transform: translateX(24px); background: #e2e8f0; }
    .switch input:checked + .track .thumb .ic-clair { opacity: 0; transform: scale(0.6); }
    .switch input:checked + .track .thumb .ic-sombre { opacity: 1; transform: scale(1); }
    .switch input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
    /* dans la barre de titre (fond bleu fonce) : piste translucide lisible dans les 2 themes */
    .appbar .switch .track { background: rgba(255,255,255,0.3); box-shadow: inset 0 1px 3px rgba(0,0,0,0.25); }
    .appbar .switch input:checked + .track { background: rgba(15,23,42,0.85); }
    body.theme-sombre .appbar .switch input:checked + .track { background: #0b1220; }
"""
ANCRE_CSS = "    /* Notification : elle DESCEND du haut, sa couleur dit la NATURE de l'action */"
rem('CSS interrupteur', ANCRE_CSS, SWITCH_CSS + ANCRE_CSS)

SW_MARKUP = ('<label class="switch sw-theme icone-theme-bascule" title="Mode sombre">'
             '<input type="checkbox" tabindex="-1" onchange="basculerTheme()">'
             '<span class="track"><span class="thumb">'
             '<i class="fas fa-sun ic ic-clair"></i><i class="fas fa-moon ic ic-sombre"></i>'
             '</span></span></label>')

# les 11 boutons des barres de titre
APPBAR_OLD = '<button onclick="basculerTheme()" title="Mode sombre" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition justify-self-start">\n      <i class="icone-theme fas fa-moon text-xl"></i>\n    </button>'
c = s.count(APPBAR_OLD)
if c < 10:
    print('ECHEC boutons appbar : %d trouves' % c)
    sys.exit(1)
s = s.replace(APPBAR_OLD, SW_MARKUP)
rapport.append('interrupteur dans les barres de titre : %d' % c)

# le bouton de la page de connexion (position fixe)
LOGIN_OLD = '<button onclick="basculerTheme()" title="Mode sombre" style="position: fixed; top: 16px; right: 16px; z-index: 60; width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; display: flex; align-items: center; justify-content: center; border: none;"><i class="icone-theme fas fa-moon text-xl"></i></button>'
LOGIN_NEW = SW_MARKUP.replace('<label class="switch sw-theme icone-theme-bascule" title="Mode sombre">',
                              '<label class="switch sw-theme icone-theme-bascule" title="Mode sombre" style="position: fixed; top: 16px; right: 16px; z-index: 60;">')
rem('interrupteur page de connexion', LOGIN_OLD, LOGIN_NEW)

# la colonne de gauche de la barre doit accueillir 52 px
GRID_OLD = 'grid-template-columns: 48px 1fr 48px;'
c = s.count(GRID_OLD)
s = s.replace(GRID_OLD, 'grid-template-columns: 56px 1fr 56px;')
rapport.append('largeur des colonnes de la barre : %d' % c)

# appliquerTheme synchronise l'interrupteur
THEME_OLD = """function appliquerTheme() {
  const sombre = localStorage.getItem('prefTheme') === 'sombre';
  document.body.classList.toggle('theme-sombre', sombre);
  document.querySelectorAll('.icone-theme').forEach(function (ic) {
    ic.className = 'icone-theme fas text-xl ' + (sombre ? 'fa-sun' : 'fa-moon');
  });
}"""
THEME_NEW = """function appliquerTheme() {
  const sombre = localStorage.getItem('prefTheme') === 'sombre';
  document.body.classList.toggle('theme-sombre', sombre);
  // l'interrupteur suit l'etat reel (et change de libelle pour l'accessibilite)
  document.querySelectorAll('.sw-theme').forEach(function (sw) {
    const coche = sw.querySelector('input');
    if (coche) coche.checked = sombre;
    sw.title = sombre ? 'Passer en mode clair' : 'Passer en mode sombre';
  });
  document.querySelectorAll('.icone-theme').forEach(function (ic) {
    ic.className = 'icone-theme fas text-xl ' + (sombre ? 'fa-sun' : 'fa-moon');
  });
}"""
rem('appliquerTheme', THEME_OLD, THEME_NEW)

# ============================================================
# 3. CHECKBOXES dessinees
# ============================================================
CHECK_CSS = """    /* Case a cocher dessinee (bord, coche animee, remplissage qui monte) */
    .check { position: relative; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; -webkit-tap-highlight-color: transparent; --case-on: var(--lot-primaire, var(--primary)); }
    .check input { position: absolute; opacity: 0; width: 0; height: 0; }
    .check .box { position: relative; width: 22px; height: 22px; flex: none; border: 2px solid #94a3b8; border-radius: 6px; background: transparent; overflow: hidden; transition: background 0.25s ease, border-color 0.25s ease; }
    .check .box::before { content: ""; position: absolute; inset: 0; z-index: 0; background: var(--case-on); transform: translateY(100%); transition: transform 0.3s ease; }
    .check .box::after { content: ""; position: absolute; left: 6px; top: 2px; z-index: 1; width: 6px; height: 11px; border: solid #ffffff; border-width: 0 2px 2px 0; transform: rotate(45deg) scale(0); transform-origin: center; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
    .check input:checked + .box { border-color: var(--case-on); background: transparent; }
    .check input:checked + .box::before { transform: translateY(0); }
    .check input:checked + .box::after { transform: rotate(45deg) scale(1); }
    .check input:focus-visible + .box { outline: 2px solid var(--accent); outline-offset: 2px; }
    .check input:disabled + .box { border-color: #cbd5e1; cursor: not-allowed; }
    .check input:disabled:checked + .box { border-color: #94a3b8; }
    .check input:disabled:checked + .box::before { background: #94a3b8; }
    body.theme-sombre .check .box { border-color: #64748b; }
    body.theme-sombre .check input:disabled + .box { border-color: #475569; }
"""
rem('CSS case a cocher', '    /* Case a cocher dessinee (bord, coche animee, remplissage qui monte) */' if False else '    .checkbox-locked {',
    CHECK_CSS + '    .checkbox-locked {')

# les cases sont construites en JS : on garde l'input (les tests le manipulent) dans le label
rem('case absence',
    "? '<input type=\"checkbox\" ' + (cocheAbsent ? 'checked' : '') + ' disabled class=\"checkbox-locked\">'",
    "? '<label class=\"check\"><input type=\"checkbox\" ' + (cocheAbsent ? 'checked' : '') + ' disabled class=\"checkbox-locked\"><span class=\"box\"></span></label>'")
rem('case retard',
    "? '<input type=\"checkbox\" ' + (cocheRetard ? 'checked' : '') + ' disabled class=\"checkbox-locked\">'",
    "? '<label class=\"check\"><input type=\"checkbox\" ' + (cocheRetard ? 'checked' : '') + ' disabled class=\"checkbox-locked\"><span class=\"box\"></span></label>'")
rem('case absence active',
    "' onchange=\"basculerMarque(' + id + ', &quot;absence&quot;, this.checked)\" class=\"checkbox-material\">'",
    "' onchange=\"basculerMarque(' + id + ', &quot;absence&quot;, this.checked)\" class=\"checkbox-material\"><span class=\"box\"></span></label>'")
rem('case retard active',
    "' onchange=\"basculerMarque(' + id + ', &quot;retard&quot;, this.checked)\" class=\"checkbox-material\">'",
    "' onchange=\"basculerMarque(' + id + ', &quot;retard&quot;, this.checked)\" class=\"checkbox-material\"><span class=\"box\"></span></label>'")
# l'ouverture du label pour les 2 cases actives
rem('ouverture label case absence',
    ": '<input type=\"checkbox\" ' + (cocheAbsent ? 'checked' : '') + ' onchange=\"basculerMarque(' + id + ', &quot;absence&quot;",
    ": '<label class=\"check\"><input type=\"checkbox\" ' + (cocheAbsent ? 'checked' : '') + ' onchange=\"basculerMarque(' + id + ', &quot;absence&quot;")
rem('ouverture label case retard',
    ": '<input type=\"checkbox\" ' + (cocheRetard ? 'checked' : '') + ' onchange=\"basculerMarque(' + id + ', &quot;retard&quot;",
    ": '<label class=\"check\"><input type=\"checkbox\" ' + (cocheRetard ? 'checked' : '') + ' onchange=\"basculerMarque(' + id + ', &quot;retard&quot;")

rem('label version', 'AbsenceTrack v3.83 — Prototype', 'AbsenceTrack v3.83 — Prototype')

io.open(F, 'w', encoding='utf-8').write(s)

sc = re.findall(r'<script>(.*?)</script>', s, re.S)
bloc = max(sc, key=len)
tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check_v5w.js'
io.open(tmp, 'w', encoding='utf-8').write(bloc)
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('node --check :', 'OK' if r.returncode == 0 else r.stderr[:400])
print('divs : %d / %d' % (s.count('<div'), s.count('</div>')))
print('labels <label class="check"> :', s.count('<label class="check">'))
print('interrupteurs :', s.count('switch sw-theme'), '| anciens boutons restants :', s.count('onclick="basculerTheme()"'))
print('taille : %d -> %d' % (len(orig), len(s)))
for x in rapport:
    print(' -', x)
