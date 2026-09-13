# -*- coding: utf-8 -*-
# patch_v5y.py — v3.85 : cascade d'ouverture sur la FICHE ELEVE (cartes + lignes + boutons)
#   Demande : « ajouter l'animation aux cartes dans le popup de l'affichage des Ab/Rd de l'eleve »
#   -> en-tete, carte infos, carte historique, puis BOUTONS en dernier ; les lignes de
#      l'historique montent l'une apres l'autre (comme la maquette fournie).
#   Deux precautions par rapport a la maquette :
#     1. les boutons ne sont pas cliquables pendant qu'ils sont invisibles (maquette : si)
#     2. le delai du pied de page est ramene a 0.30 s (maquette : 0.9 s)
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


# ---------- 1. CSS ----------
CSS = """    /* Cascade d'ouverture de la FICHE ELEVE : en-tete, carte infos, carte historique, boutons */
    #modal-fiche-eleve .fiche-anim { opacity: 0; animation: ficheMonte 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; pointer-events: none; }
    #modal-fiche-eleve .fiche-anim.pret { pointer-events: auto; }
    #modal-fiche-eleve .fiche-anim.fa-1 { animation-delay: 0.04s; }
    #modal-fiche-eleve .fiche-anim.fa-2 { animation-delay: 0.12s; }
    #modal-fiche-eleve .fiche-anim.fa-3 { animation-delay: 0.20s; }
    #modal-fiche-eleve .fiche-anim.fa-4 { animation-delay: 0.30s; }
    /* les lignes de l'historique montent l'une apres l'autre (delai pose en JS) */
    #modal-fiche-eleve .fiche-ligne { opacity: 0; animation: ficheMonte 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    @keyframes ficheMonte { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
"""
ANCRE_CSS = '    .modal-overlay { background: rgba(0,0,0,0.45); backdrop-filter: blur(8px); animation: fadeIn 0.3s ease-out; }'
rem('CSS cascade fiche', ANCRE_CSS, CSS + ANCRE_CSS)

# ---------- 2. les 4 blocs de la fiche ----------
rem('entete de la fiche',
    """    <div class="flex items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <span style="width: 32px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 text-center" id="fiche-titre" style="flex: 1;">Fiche élève</h2>""",
    """    <div class="flex items-center px-5 pt-4 pb-2 fiche-anim fa-1" style="flex-shrink: 0;">
      <span style="width: 32px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 text-center" id="fiche-titre" style="flex: 1;">Fiche élève</h2>""")

rem('carte infos',
    """    <div class="px-4 pb-3" style="flex-shrink: 0;">
      <div class="detail-carte rounded-2xl p-4 space-y-0" id="fiche-infos"></div>""",
    """    <div class="px-4 pb-3 fiche-anim fa-2" style="flex-shrink: 0;">
      <div class="detail-carte rounded-2xl p-4 space-y-0" id="fiche-infos"></div>""")

rem('carte historique',
    """    <div class="px-4 pb-3" style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
      <div class="detail-carte rounded-2xl p-4" id="fiche-historique\"""",
    """    <div class="px-4 pb-3 fiche-anim fa-3" style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
      <div class="detail-carte rounded-2xl p-4" id="fiche-historique\"""")

rem('pied de la fiche',
    """    <div class="flex gap-3 px-4 pt-2 pb-5" style="flex-shrink: 0;">
      <button onclick="fermerFicheEleve()" class="btn-fermer flex-1">Fermer</button>""",
    """    <div class="flex gap-3 px-4 pt-2 pb-5 fiche-anim fa-4" style="flex-shrink: 0;">
      <button onclick="fermerFicheEleve()" class="btn-fermer flex-1">Fermer</button>""")

# ---------- 3. JS : animation des lignes + protection des boutons ----------
JS = r'''// Cascade de la fiche eleve : les lignes de l'historique montent l'une apres l'autre, et les
// boutons restent INERTES tant qu'ils sont invisibles (un appui a l'aveugle ne doit rien faire).
let ficheAnimMinuterie = null;

function animerFicheEleve() {
  const modal = document.getElementById('modal-fiche-eleve');
  if (!modal) return;
  const cont = document.getElementById('fiche-historique');
  if (cont) {
    Array.prototype.forEach.call(cont.children, function (ligne, i) {
      ligne.classList.add('fiche-ligne');
      ligne.style.animationDelay = Math.min(0.24 + i * 0.05, 0.6).toFixed(2) + 's';
    });
  }
  const blocs = modal.querySelectorAll('.fiche-anim');
  Array.prototype.forEach.call(blocs, function (b) { b.classList.remove('pret'); });
  // relance l'animation meme si la fiche etait deja ouverte
  Array.prototype.forEach.call(blocs, function (b) { b.style.animation = 'none'; });
  void modal.offsetWidth;
  Array.prototype.forEach.call(blocs, function (b) { b.style.animation = ''; });
  if (ficheAnimMinuterie) clearTimeout(ficheAnimMinuterie);
  ficheAnimMinuterie = setTimeout(function () {
    Array.prototype.forEach.call(blocs, function (b) { b.classList.add('pret'); });
  }, 820);
}

'''
ANCRE_JS = 'function ouvrirFicheEleve(eleveId, classeId) {'
rem('JS animerFicheEleve', ANCRE_JS, JS + ANCRE_JS)

rem('appel a l ouverture de la fiche',
    """  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}""",
    """  animerFicheEleve();
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}""")

rem('nettoyage a la fermeture',
    """function fermerFicheEleve() {
  document.getElementById('modal-fiche-eleve').classList.add('hidden');""",
    """function fermerFicheEleve() {
  if (ficheAnimMinuterie) clearTimeout(ficheAnimMinuterie);
  const mf = document.getElementById('modal-fiche-eleve');
  if (mf) Array.prototype.forEach.call(mf.querySelectorAll('.fiche-anim.pret'), function (b) { b.classList.remove('pret'); });
  document.getElementById('modal-fiche-eleve').classList.add('hidden');""")

rem('label version', 'AbsenceTrack v3.84 — Prototype', 'AbsenceTrack v3.85 — Prototype')

io.open(F, 'w', encoding='utf-8').write(s)

sc = re.findall(r'<script>(.*?)</script>', s, re.S)
bloc = max(sc, key=len)
tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check_v5y.js'
io.open(tmp, 'w', encoding='utf-8').write(bloc)
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('node --check :', 'OK' if r.returncode == 0 else r.stderr[:400])
print('divs : %d / %d' % (s.count('<div'), s.count('</div>')))
print('blocs fiche-anim :', s.count('fiche-anim fa-'))
print('taille : %d -> %d' % (len(orig), len(s)))
for x in rapport:
    print(' -', x)
