# -*- coding: utf-8 -*-
"""apercu_identifiants.py — MAQUETTE du PDF « Identifiants » à partir d'un vrai
jeu de noms arabes, pour valider la présentation AVANT de coder le bouton.

Chaîne : police arabe embarquée (/system/fonts/NotoNaskhArabic) + arabic_reshaper
(mise en forme des lettres) + python-bidi (sens droite→gauche). C'est la seule
façon d'obtenir de l'arabe lisible dans un PDF.
"""
import io, os, random, shutil, datetime

import arabic_reshaper
from bidi.algorithm import get_display
from fpdf import FPDF

SORTIE = 'apercu_identifiants.pdf'
POLICE = '/data/data/com.termux/files/home/AbsenceTrack-dev/fonts/NotoNaskhArabic-Regular.ttf'

# --- la police arabe d'Android est en lecture seule : on la copie ---
src = '/system/fonts/NotoNaskhArabic-Regular.ttf'
os.makedirs(os.path.dirname(POLICE), exist_ok=True)
if not os.path.exists(POLICE):
    shutil.copyfile(src, POLICE)

def ar(t):
    """Arabe prêt à écrire : mise en forme des lettres + sens droite→gauche."""
    return get_display(arabic_reshaper.reshape(str(t)))

# --- les 11 enseignants (noms réels du prototype) ---
PROFS = [
    ('أيوب الكمرة',        'Maths'),
    ('غزالي صالح',         'PC'),
    ('كمال الوردي',        'SVT'),
    ('سامية الحاضي',       'Français'),
    ('هشام أجامي',         'Anglais'),
    ('المهدي الصلحي',      'Arabe'),
    ('يسرى البوسعيدي',     'EPS'),
    ('سكينة الرازي',       'Informatique'),
    ('زكية المندريلي',     'Philo'),
    ('محمد خليفي',         'Éduc. islamique'),
    ('ياسين القامة',       'Hist-Géo'),
]

def abrev_matiere(m):
    """La MÊME règle que abrevMatiere() dans l'application."""
    s = str(m).strip().lower()
    for cle, code in [('math', 'MATH'), ('physique', 'PC'), ('pc', 'PC'), ('fran', 'FR'),
                      ('arabe', 'AR'), ('ar', 'AR'), ('svt', 'SVT'), ('science', 'SVT'),
                      ('anglais', 'ANG'), ('histoire', 'HG'), ('géo', 'HG'), ('philo', 'PHILO'),
                      ('islam', 'EI'), ('ducation', 'EI'), ('eps', 'EPS'), ('sport', 'EPS'),
                      ('info', 'INFO')]:
        if cle in s or s == cle:
            return code
    return str(m).strip().upper()

def mot_de_passe(rng):
    """8 caractères, lettres + chiffres, au moins une lettre et un chiffre
    (règle de l'application : pas de caractère spécial)."""
    lettres = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'  # sans l ni O ni I
    chiffres = '23456789'
    while True:
        mdp = [rng.choice(lettres) for _ in range(5)] + [rng.choice(chiffres) for _ in range(3)]
        rng.shuffle(mdp)
        mdp = ''.join(mdp)
        if any(c.isalpha() for c in mdp) and any(c.isdigit() for c in mdp):
            return mdp

rng = random.Random(20260912)   # figé : l'aperçu est reproductible
compteurs = {}
lignes = []
for nom, matiere in PROFS:
    ab = abrev_matiere(matiere)
    compteurs[ab] = compteurs.get(ab, 0) + 1
    lignes.append((nom, '%s-prof%d@taalim.ma' % (ab.lower(), compteurs[ab]), mot_de_passe(rng)))

# ---------- le PDF ----------
pdf = FPDF(orientation='P', unit='mm', format='A4')
pdf.add_font('Noto', '', POLICE)
pdf.set_auto_page_break(False)
pdf.add_page()
pdf.set_margins(12, 12, 12)

# en-tête
pdf.set_font('Helvetica', 'B', 15)
pdf.set_text_color(38, 57, 90)
pdf.cell(0, 9, 'Identifiants de connexion - AbsenceTrack', align='C', new_x='LMARGIN', new_y='NEXT')
pdf.set_font('Noto', '', 12)
pdf.set_text_color(90, 90, 90)
pdf.cell(0, 7, ar('الثانوية القصبية الإعدادية'), align='C', new_x='LMARGIN', new_y='NEXT')
pdf.set_font('Helvetica', '', 10)
pdf.cell(0, 5, 'Annee scolaire 2026-2027 - document a remettre a chaque enseignant', align='C',
         new_x='LMARGIN', new_y='NEXT')
pdf.ln(4)

# largeur des colonnes : 186 mm utiles
larg = [66, 72, 48]          # Nom / Email / Mot de passe  (colonnes larges)
entetes = ['Nom de l enseignant', 'Email de connexion', 'Mot de passe']
hauteur = 10

# en-tête du tableau
pdf.set_font('Helvetica', 'B', 10.5)
pdf.set_fill_color(38, 57, 90)
pdf.set_text_color(255, 255, 255)
x0 = pdf.get_x()
y0 = pdf.get_y()
for i, h in enumerate(entetes):
    pdf.cell(larg[i], hauteur, h, border=1, align='C', fill=True)
pdf.ln(hauteur)

# lignes
pdf.set_font('Helvetica', '', 10.5)
for n, (nom, email, mdp) in enumerate(lignes):
    if n % 2 == 1:
        pdf.set_fill_color(244, 246, 250)
    else:
        pdf.set_fill_color(255, 255, 255)
    x = pdf.get_x(); y = pdf.get_y()
    # nom en arabe (police arabe, aligné à droite comme dans un document arabe)
    pdf.set_font('Noto', '', 12)
    pdf.set_text_color(35, 35, 35)
    pdf.cell(larg[0], hauteur, ar(nom), border=1, align='R', fill=True)
    # email + mot de passe en latin (police latine : lisible, copiable)
    pdf.set_font('Helvetica', '', 10.5)
    pdf.cell(larg[1], hauteur, email, border=1, align='L', fill=True)
    pdf.set_font('Courier', 'B', 11.5)
    pdf.cell(larg[2], hauteur, mdp, border=1, align='C', fill=True)
    pdf.ln(hauteur)

# pied
pdf.ln(6)
pdf.set_font('Helvetica', 'I', 9)
pdf.set_text_color(120, 120, 120)
pdf.cell(0, 5, 'Document confidentiel - genere le %s - chaque enseignant change son mot de passe dans Profil.'
         % datetime.date.today().strftime('%d/%m/%Y'), align='C')

pdf.output(SORTIE)
print('ecrit', SORTIE, os.path.getsize(SORTIE), 'octets')
print()
for nom, email, mdp in lignes:
    print('%-22s %-28s %s' % (nom, email, mdp))
