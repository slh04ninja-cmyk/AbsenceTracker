# -*- coding: utf-8 -*-
"""AbsenceTrack v3.25 : listes deroulantes personnalisees (le panneau ouvert est style
comme l'application, plus comme le navigateur).
Principe : le <select> natif est masque (mais garde sa valeur), un bouton + un panneau
maison prennent sa place ; au clic on ecrit dans le <select> et on declenche 'change',
donc tout le JS existant (onchange, getElementById(...).value) continue de marcher.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

CSS = """
    /* ========== LISTES DEROULANTES PERSONNALISEES ========== */
    .sd { position: relative; width: 100%; }
    .sd > select {
      position: absolute !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important; height: 100% !important;
      margin: 0 !important; padding: 0 !important;
      border: 0 !important; opacity: 0 !important;
      pointer-events: none !important;
    }
    .sd-trigger {
      width: 100%; min-height: 46px;
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 12px 16px; background: #ffffff;
      border: 2px solid #1e3a8a; border-radius: 12px;
      font-family: inherit; font-size: inherit; font-weight: 600;
      color: #1e3a8a; text-align: left; cursor: pointer;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      transition: box-shadow 0.18s ease, border-color 0.18s ease;
    }
    .sd-trigger > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sd-trigger .sd-fleche { flex-shrink: 0; font-size: 12px; transition: transform 0.22s ease; }
    .sd.ouvert .sd-trigger { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.30); }
    .sd.ouvert .sd-fleche { transform: rotate(180deg); }
    .sd-panel {
      position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 300;
      max-height: 264px; overflow-y: auto; -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      background: #ffffff; border: 2px solid #1e3a8a; border-radius: 14px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
      padding: 6px; display: none;
    }
    .sd.ouvert .sd-panel { display: block; animation: sd-apparait 0.16s ease; }
    @keyframes sd-apparait { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .sd-option {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 12px 14px; border-radius: 10px;
      font-weight: 600; color: #1e293b; cursor: pointer;
    }
    .sd-option + .sd-option { margin-top: 2px; }
    .sd-option:active { background: #eff6ff; }
    .sd-option .fa-check { display: none; font-size: 12px; }
    .sd-option.actif { color: #ffffff; background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); }
    .sd-option.actif .fa-check { display: inline-block; }
    .sd-option.vide { color: #94a3b8; font-weight: 500; }
    .sd-option.vide.actif { color: #e2e8f0; }
    body:not(.theme-sombre).role-enseignant .sd-trigger { border-color: var(--lot-primaire); color: var(--lot-fonce); }
    body:not(.theme-sombre).role-enseignant .sd-panel { border-color: var(--lot-primaire); }
    body:not(.theme-sombre).role-enseignant .sd-option.actif { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); }
    body:not(.theme-sombre).role-surveillant .sd-trigger { border-color: var(--lot-primaire); color: var(--lot-fonce); }
    body:not(.theme-sombre).role-surveillant .sd-panel { border-color: var(--lot-primaire); }
    body:not(.theme-sombre).role-surveillant .sd-option.actif { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); }
    body.theme-sombre .sd-trigger { background: #0f172a; border-color: #334155; color: #e2e8f0; }
    body.theme-sombre .sd.ouvert .sd-trigger { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.22); }
    body.theme-sombre .sd-panel { background: #1e293b; border-color: #334155; box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45); }
    body.theme-sombre .sd-option { color: #e2e8f0; }
    body.theme-sombre .sd-option:active { background: #273549; }
    body.theme-sombre .sd-option.actif { background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%); color: #ffffff; }
"""

JS = """
// ========== LISTES DEROULANTES PERSONNALISEES ==========
function sdOptionCourante(select) { return select.options[select.selectedIndex] || null; }

function sdMajLibelle(conteneur) {
  const select = conteneur.querySelector('select');
  const bouton = conteneur.querySelector('.sd-trigger');
  const span = conteneur.querySelector('.sd-trigger > span');
  if (!select || !bouton || !span) return;
  const opt = sdOptionCourante(select);
  const texte = opt ? opt.textContent : '---';
  if (span.textContent !== texte) span.textContent = texte;
  if (bouton.disabled !== !!select.disabled) bouton.disabled = !!select.disabled;
  const desactive = select.disabled ? '0.55' : '1';
  if (bouton.style.opacity !== desactive) bouton.style.opacity = desactive;
}

function sdFermerTout() {
  const ouverts = document.querySelectorAll('.sd.ouvert');
  for (let i = 0; i < ouverts.length; i++) ouverts[i].classList.remove('ouvert');
}

function sdConstruireOptions(conteneur) {
  const select = conteneur.querySelector('select');
  const panneau = conteneur.querySelector('.sd-panel');
  panneau.innerHTML = '';
  Array.prototype.forEach.call(select.options, function (opt, index) {
    const ligne = document.createElement('div');
    ligne.className = 'sd-option' + (index === select.selectedIndex ? ' actif' : '') + (opt.value === '' ? ' vide' : '');
    ligne.innerHTML = '<span>' + opt.textContent + '</span><i class="fas fa-check"></i>';
    ligne.addEventListener('click', function (ev) {
      ev.stopPropagation();
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sdFermerTout();
      sdMajLibelle(conteneur);
    });
    panneau.appendChild(ligne);
  });
  const actif = panneau.querySelector('.sd-option.actif');
  if (actif && actif.scrollIntoView) { try { actif.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
}

function sdBasculer(conteneur) {
  const etaitOuvert = conteneur.classList.contains('ouvert');
  sdFermerTout();
  if (etaitOuvert) return;
  sdMajLibelle(conteneur);
  sdConstruireOptions(conteneur);
  conteneur.classList.add('ouvert');
}

function initialiserListesDeroulantes() {
  const selects = document.querySelectorAll('select');
  Array.prototype.forEach.call(selects, function (select) {
    if (select.closest('.sd')) return;
    const conteneur = document.createElement('div');
    conteneur.className = 'sd' + (select.classList.contains('w-full') ? ' w-full' : '');
    select.parentNode.insertBefore(conteneur, select);
    conteneur.appendChild(select);

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'sd-trigger';
    bouton.innerHTML = '<span></span><i class="fas fa-chevron-down sd-fleche"></i>';
    conteneur.appendChild(bouton);

    const panneau = document.createElement('div');
    panneau.className = 'sd-panel';
    conteneur.appendChild(panneau);

    bouton.addEventListener('click', function (ev) { ev.stopPropagation(); sdBasculer(conteneur); });
    sdMajLibelle(conteneur);
  });
  document.addEventListener('click', sdFermerTout);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sdFermerTout(); });
  setInterval(function () {
    const tous = document.querySelectorAll('.sd');
    for (let i = 0; i < tous.length; i++) sdMajLibelle(tous[i]);
  }, 400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiserListesDeroulantes);
} else {
  initialiserListesDeroulantes();
}
"""

new, c = re.subn(r'\n  </style>', '\n' + CSS + '  </style>', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' insertion CSS   occurrences=%d' % c)
allok &= (c == 1)
s = new if c == 1 else s

new, c = re.subn(r'\n</script>', '\n' + JS + '</script>', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' insertion JS    occurrences=%d' % c)
allok &= (c == 1)
s = new if c == 1 else s

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.24', 'AbsenceTrack v3.25', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.25 occurrences=%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

for lib, motif, attendu in [('fonctions sd', r'function sd[A-Za-z]+\(', 5),
                            ('init appel', r'initialiserListesDeroulantes', 3),
                            ('regles .sd', r'\n    \.sd', 8)]:
    n = len(re.findall(motif, s))
    print(('OK   ' if n >= attendu else 'ECHEC') + ' %-16s = %d (>= %d)' % (lib, n, attendu))
    allok &= (n >= attendu)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
node = shutil.which('node') or shutil.which('nodejs')
r = subprocess.run([node, '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

bloc = s[s.index('/* ========== LISTES DEROULANTES'):s.index('body.theme-sombre .sd-option.actif')]
print(('OK   ' if bloc.count('{') == bloc.count('}') else 'ECHEC') + ' accolades CSS %d/%d' % (bloc.count('{'), bloc.count('}')))
allok &= (bloc.count('{') == bloc.count('}'))

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
