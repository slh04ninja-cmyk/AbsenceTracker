# -*- coding: utf-8 -*-
"""v2 -> jeu de donnees de test: 5 profs (matiere auto), 2 surveillants, 5 classes x 13 eleves."""
import re, io, os, shutil, subprocess

SRC = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
OUT = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'

data = io.open(SRC, encoding='utf-8').read()
results = []

def plain(label, old, new, n=1):
    global data
    c = data.count(old)
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = data.replace(old, new)
    return ok

def rx(label, pat, repl, n=1):
    global data
    c = len(re.findall(pat, data, re.DOTALL))
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = re.sub(pat, repl, data, flags=re.DOTALL)
    return ok

# ---------- 1. comptes : 5 profs + 2 surveillants + directeur ----------
oldComptes = '''const comptes = [
  { email: "1@taalim.ma", password: "12345", role: "enseignant", nom: "Prof. Martin" },
  { email: "2@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant Durand" },
  { email: "3@taalim.ma", password: "12345", role: "directeur", nom: "Directeur Bernard" }
];'''
newComptes = '''const comptes = [
  { email: "pc@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Physique",       nom: "Prof. Physique" },
  { email: "math@taalim.ma", password: "12345", role: "enseignant",  matiere: "Mathématiques", nom: "Prof. Mathématiques" },
  { email: "fr@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Français",       nom: "Prof. Français" },
  { email: "ar@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Arabe",          nom: "Prof. Arabe" },
  { email: "svt@taalim.ma",  password: "12345", role: "enseignant",  matiere: "SVT",            nom: "Prof. SVT" },
  { email: "s1@taalim.ma",   password: "12345", role: "surveillant", nom: "Surveillant 1" },
  { email: "s2@taalim.ma",   password: "12345", role: "surveillant", nom: "Surveillant 2" },
  { email: "3@taalim.ma",    password: "12345", role: "directeur",   nom: "Directeur" }
];'''
plain('1-comptes', oldComptes, newComptes)

# ---------- 2. classes demo : 5 classes x 13 eleves ----------
generateur = '''const prenomsDemo = ['Ahmed', 'Fatima', 'Mohamed', 'Khadija', 'Youssef', 'Salma', 'Omar', 'Aya', 'Mehdi', 'Imane', 'Karim', 'Noura', 'Hamza', 'Yassine', 'Sara', 'Anas', 'Malak', 'Reda', 'Ghita', 'Adam', 'Lina', 'Walid', 'Douae', 'Zakaria', 'Hiba', 'Bilal', 'Meriem', 'Soufiane', 'Nisrine', 'Amine', 'Ouiam', 'Taha', 'Rania', 'Ayoub', 'Kawtar', 'Ismail', 'Rim', 'Adil', 'Amal', 'Jawad'];
const nomsDemo = ['El Amrani', 'Benali', 'Alami', 'El Fassi', 'Chraibi', 'Berrada', 'El Idrissi', 'Bennani', 'Tazi', 'El Khatib', 'Ouazzani', 'Benjelloun', 'Sekkat', 'El Mansouri', 'Bouazza', 'El Ghazi', 'Tahiri', 'Naciri', 'El Harrak', 'Kabbaj', 'Zouiten', 'Bennis', 'Lamrani', 'Sefrioui', 'Benkirane', 'Fikri', 'Belkadi', 'El Moudden', 'Zniber', 'Baraka', 'El Hassani', 'Drissi', 'El Fadili', 'Ghannam', 'Haddadi', 'Jaidi', 'Kadiri', 'Laabi', 'Moutawakil', 'Nabil'];
const nomsClassesDemo = ['3ème A', '3ème B', '4ème A', '4ème B', '5ème A'];
const classesDemo = [];
let idEleveDemo = 1;
nomsClassesDemo.forEach((nomClasse, idx) => {
  const eleves = [];
  for (let i = 0; i < 13; i++) {
    eleves.push({
      id: idEleveDemo++,
      nom: nomsDemo[(idx * 13 + i * 5) % nomsDemo.length],
      prenom: prenomsDemo[(idx * 7 + i) % prenomsDemo.length]
    });
  }
  classesDemo.push({ id: idx + 1, nom: nomClasse, eleves: eleves });
});'''
rx('2-classesDemo',
   r'const classesDemo = \[.*?\];\n\n// ========== CHARGEMENT DES CLASSES \(persistees en localStorage\) ==========',
   generateur + '\n\n// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========')

# ---------- 3. chargerClasses : version de stockage + reset demo ----------
oldCharger = '''function chargerClasses() {
  const sauve = localStorage.getItem('classes');
  if (sauve) {
    try {
      const liste = JSON.parse(sauve);
      if (Array.isArray(liste) && liste.length > 0) {
        nextClasseId = liste.reduce((m, c) => Math.max(m, c.id), 0) + 1;
        nextEleveId = liste.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
        return liste;
      }
    } catch (e) {}
  }
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = 5;
  nextEleveId = 39;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  localStorage.setItem('classes', JSON.stringify(liste || classes));
}'''
newCharger = '''const DEMO_VERSION = 'v2.1';

function chargerClasses() {
  const sauve = localStorage.getItem('classes');
  const version = localStorage.getItem('absenceTrackVersion');
  if (sauve && version === DEMO_VERSION) {
    try {
      const liste = JSON.parse(sauve);
      if (Array.isArray(liste) && liste.length > 0) {
        nextClasseId = liste.reduce((m, c) => Math.max(m, c.id), 0) + 1;
        nextEleveId = liste.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
        return liste;
      }
    } catch (e) {}
  }
  // Nouveau jeu de donnees de test : on repart de zero
  localStorage.removeItem('absences');
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = init.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  nextEleveId = init.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  localStorage.setItem('classes', JSON.stringify(liste || classes));
  localStorage.setItem('absenceTrackVersion', DEMO_VERSION);
}'''
plain('3-chargerClasses', oldCharger, newCharger)

# ---------- 4. supprimer la carte Matiere (page enseignant) ----------
rx('4-carteMatiere',
   r'        <div class="mt-4">\n          <label class="block text-sm font-bold text-blue-900 mb-2">Matière</label>\n          <select id="select-matiere".*?</select>\n        </div>\n      </div>',
   '      </div>')

# ---------- 5. supprimer fonction changerMatiere ----------
plain('5-changerMatiere',
      "function changerMatiere() {\n  matiereSelectionnee = document.getElementById('select-matiere').value;\n}\n\nfunction afficherListeEleves() {",
      'function afficherListeEleves() {')

# ---------- 6. supprimer variable matiereSelectionnee ----------
rx('6-varMatiere', r'let matiereSelectionnee = \'Math[^\']*\';', '')

# ---------- 7. matiere automatique du compte enseignant ----------
plain('7-matiereAuto', 'matiere: matiereSelectionnee', 'matiere: utilisateurConnecte.matiere')

# ---------- 8. supprimer le bloc de donnees de test (seed auto) ----------
rx('8-seed', r'  // Données de test.*?\n  \}\n\n', '')

# ---------- 9. aide connexion (comptes test) ----------
oldAide = '''        <p class="text-center text-xs text-gray-400 mt-6">
          <i class="fas fa-shield-alt mr-1"></i> Connexion sécurisée
        </p>
      </div>'''
newAide = '''        <p class="text-center text-xs text-gray-400 mt-6">
          <i class="fas fa-shield-alt mr-1"></i> Connexion sécurisée
        </p>

        <div class="mt-5 pt-4 border-t border-gray-200">
          <p class="text-center text-xs text-gray-500 leading-relaxed">Comptes test — mot de passe 12345 :<br>
          Prof : pc · math · fr · ar · svt @taalim.ma<br>
          Surveillants : s1 · s2 @taalim.ma · Directeur : 3 @taalim.ma</p>
        </div>
      </div>'''
plain('9-aideLogin', oldAide, newAide)

# ---------- 10. version ----------
plain('10-version', 'AbsenceTrack v1.1 \u2014 Prototype', 'AbsenceTrack v1.2 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('matiereSelectionnee', 0), ('select-matiere', 0), ('changerMatiere', 0),
                 ('testDataLoaded', 0), ('Prof. Martin', 0),
                 ('pc@taalim.ma', 1), ('math@taalim.ma', 1), ('fr@taalim.ma', 1), ('ar@taalim.ma', 1),
                 ('svt@taalim.ma', 1), ('s1@taalim.ma', 1), ('s2@taalim.ma', 1),
                 ('DEMO_VERSION', 3), ('absenceTrackVersion', 3), ('idEleveDemo', 4),
                 ('utilisateurConnecte.matiere', 1), ('13', 1), ('5ème A', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check3.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
else:
    print('NODE_CHECK skipped (node absent)')
