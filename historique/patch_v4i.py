# -*- coding: utf-8 -*-
"""AbsenceTrack v3.48 : donnees de test reelles (profs/matieres du PDF + classes TCSF-1/2/3).

1. comptes : les 11 professeurs reels (nom arabe + matiere + code {matiere}-prof{x}) remplacent les
   5 profs de demo ; les emails deviennent <code>@taalim.ma ; surveillants et directeur inchanges.
2. TABLEAUX_SERVICE_DEFAUT : emplois du temps generes (Maths 5h, PC 4h, SVT 4h, Francais 4h, Anglais 3h,
   Arabe/EPS/Info/Philo/EI/HG 2h ; max 2h/matiere/jour ; PC et SVT en seances de 2h ; samedi repos ;
   un prof le matin OU l'apres-midi par jour) pour TCSF-1, TCSF-2, TCSF-3.
3. Cle localStorage des tableaux de service -> tableauxService_v2 (pour que le nouveau jeu s'applique).
4. Injecteur de donnees de test : heures limitees a 08:00-12:00 / 14:00-18:00, profs/matieres reels,
   code du prof dans chaque enregistrement, purge de tous les anciens Ab/Rd de test (guard v3).
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-46s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ---------- 1. comptes ----------
ANCIENS_COMPTES = """const comptes = [
  { email: "pc@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Physique",       nom: "Prof. Physique" },
  { email: "math@taalim.ma", password: "12345", role: "enseignant",  matiere: "Mathématiques", nom: "Prof. Mathématiques" },
  { email: "fr@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Français",       nom: "Prof. Français" },
  { email: "ar@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Arabe",          nom: "Prof. Arabe" },
  { email: "svt@taalim.ma",  password: "12345", role: "enseignant",  matiere: "SVT",            nom: "Prof. SVT" },
  { email: "s1@taalim.ma",   password: "12345", role: "surveillant", nom: "Surveillant 1" },
  { email: "s2@taalim.ma",   password: "12345", role: "surveillant", nom: "Surveillant 2" },
  { email: "d@taalim.ma",    password: "12345", role: "directeur",   nom: "Directeur" }
];"""
NOUVEAUX_COMPTES = """// Professeurs reels (tableau des professeurs du PDF) : code = {matiere}-prof{x}
const comptes = [
  { email: "math-prof1@taalim.ma",  password: "12345", role: "enseignant", code: "math-prof1",  matiere: "Maths",           nom: "أيوب الكمرة" },
  { email: "pc-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "pc-prof1",    matiere: "PC",              nom: "غزالي صالح" },
  { email: "svt-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "svt-prof1",   matiere: "SVT",             nom: "كمال الوردي" },
  { email: "fr-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "fr-prof1",    matiere: "Français",        nom: "سامية الحاضي" },
  { email: "ang-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "ang-prof1",   matiere: "Anglais",         nom: "هشام أجامي" },
  { email: "ar-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "ar-prof1",    matiere: "Arabe",           nom: "المهدي الصلحي" },
  { email: "eps-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "eps-prof1",   matiere: "EPS",             nom: "يسرى البوسعيدي" },
  { email: "info-prof1@taalim.ma",  password: "12345", role: "enseignant", code: "info-prof1",  matiere: "Informatique",    nom: "سكينة الرازي" },
  { email: "philo-prof1@taalim.ma", password: "12345", role: "enseignant", code: "philo-prof1", matiere: "Philo",           nom: "زكية المندريلي" },
  { email: "ei-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "ei-prof1",    matiere: "Educ. islamique", nom: "محمد خليفي" },
  { email: "hg-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "hg-prof1",    matiere: "Hist-Géo",        nom: "ياسين القامة" },
  { email: "s1@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant 1" },
  { email: "s2@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant 2" },
  { email: "d@taalim.ma",  password: "12345", role: "directeur",   nom: "Directeur" }
];"""
allok &= remplace('comptes reels (11 profs + codes)', ANCIENS_COMPTES, NOUVEAUX_COMPTES)

# ---------- 2. tableaux de service par defaut ----------
debut = s.index('const TABLEAUX_SERVICE_DEFAUT = {')
fin = s.index('\n};', debut) + 3
nouveaux_tableaux = io.open('_tableaux_js.txt', encoding='utf-8').read().strip() + '\n'
print('OK   tableaux par defaut remplaces (%d -> %d caracteres)' % (fin - debut, len(nouveaux_tableaux)))
s = s[:debut] + nouveaux_tableaux + s[fin:]

# ---------- 3. cle de stockage v2 ----------
allok &= remplace('cle localStorage v2 (lecture)',
                  "    const sauve = JSON.parse(localStorage.getItem('tableauxService') || 'null');",
                  "    const sauve = JSON.parse(localStorage.getItem('tableauxService_v2') || 'null');")
allok &= remplace('cle localStorage v2 (ecriture)',
                  "  localStorage.setItem('tableauxService', JSON.stringify(tableauxService));",
                  "  localStorage.setItem('tableauxService_v2', JSON.stringify(tableauxService));")

# ---------- 4. classes a creer ----------
allok &= remplace('classes de test',
                  "const CLASSES_TABLEAUX_SERVICE = ['TCSF-4', 'TCSF-1', '2BACSPF-1', '2PC1-G1', '2PC1-G2', 'TC1-G1'];",
                  "const CLASSES_TABLEAUX_SERVICE = ['TCSF-1', 'TCSF-2', 'TCSF-3'];")
allok &= remplace('effectif des classes creees',
                  "const NB_ELEVES_CLASSE_SERVICE = 12;",
                  "const NB_ELEVES_CLASSE_SERVICE = 13;")

# ---------- 5. aide sur l'ecran de connexion ----------
ANCIENNE_AIDE = """          Prof : pc · math · fr · ar · svt @taalim.ma<br>
          Surveillants : s1 · s2 @taalim.ma · Directeur : d @taalim.ma</p>"""
NOUVELLE_AIDE = """          Profs : math-prof1 · pc-prof1 · svt-prof1 · fr-prof1 · ang-prof1 · ar-prof1 @taalim.ma<br>
          eps-prof1 · info-prof1 · philo-prof1 · ei-prof1 · hg-prof1 @taalim.ma<br>
          Surveillants : s1 · s2 @taalim.ma · Directeur : d @taalim.ma</p>"""
allok &= remplace('aide de connexion', ANCIENNE_AIDE, NOUVELLE_AIDE)

# ---------- 6. normaliserMatiere : PC / SVT / HG explicites ----------
allok &= remplace('normaliserMatiere PC',
                  "  if (t.indexOf('فيزي') >= 0 || t.indexOf('physique') >= 0 || t.indexOf('chimie') >= 0) return 'pc';",
                  "  if (t === 'pc' || t.indexOf('فيزي') >= 0 || t.indexOf('physique') >= 0 || t.indexOf('chimie') >= 0) return 'pc';")
allok &= remplace('normaliserMatiere HG',
                  "  if (t.indexOf('تاريخ') >= 0 || t.indexOf('جغراف') >= 0 || t.indexOf('histoire') >= 0) return 'hg';",
                  "  if (t === 'hg' || t.indexOf('تاريخ') >= 0 || t.indexOf('جغراف') >= 0 || t.indexOf('histoire') >= 0 || t.indexOf('géo') >= 0) return 'hg';")

if not allok:
    print('PATCH ANNULE (etapes 1-6)')
    sys.exit(1)

# ---------- 7. generateur de donnees de test ----------
d = s.index('function genererDonneesTestHistorique() {')
f = s.index("\n  localStorage.setItem('testHistoGenere_v2', '1');\n}", d) + len("\n  localStorage.setItem('testHistoGenere_v2', '1');\n}")
NOUVEAU_GEN = """function genererDonneesTestHistorique() {
  if (localStorage.getItem('testHistoGenere_v3')) return;
  const profs = comptes.filter(c => c.role === 'enseignant');
  const motifs = ['Maladie', 'Raison familiale', 'Raison personnelle', 'Transport', 'Autre'];
  const durees = ['15 min', '30 min', '1 h'];
  // Les Ab/Rd de test tombent dans les creneaux reels : 08:00-12:00 et 14:00-18:00
  const heures = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

  // Classe cible : la premiere classe qui a un tableau de service (sinon la premiere classe)
  let classeCible = classes.find(cl => Object.keys(tableauxService).some(cle =>
    (tableauxService[cle] || []).some(c => c.classe === cl.nom)));
  if (!classeCible) classeCible = classes[0];
  const cibles = [];
  if (classeCible && classeCible.eleves.length >= 2) {
    cibles.push({ eleve: classeCible.eleves[0], classe: classeCible, nombre: 12 });
    cibles.push({ eleve: classeCible.eleves[1], classe: classeCible, nombre: 17 });
  }
  // Purge de TOUS les Ab/Rd de test precedents (donnees de demonstration uniquement)
  absences = absences.filter(a => !a.test);

  // Matieres reellement enseignees dans la classe cible (pour des profs coherents)
  const matieresClasse = [];
  if (classeCible) {
    Object.keys(tableauxService).forEach(cle => (tableauxService[cle] || []).forEach(c => {
      if (c.classe === classeCible.nom && c.matiere && matieresClasse.indexOf(c.matiere) < 0) matieresClasse.push(c.matiere);
    }));
  }

  const base = new Date();
  cibles.forEach(cible => {
    for (let i = 0; i < cible.nombre; i++) {
      const matiere = matieresClasse.length ? matieresClasse[Math.floor(Math.random() * matieresClasse.length)] : '';
      const prof = (matiere && profs.find(p => p.matiere === matiere)) || profs[Math.floor(Math.random() * profs.length)];
      const d = new Date(base);
      d.setDate(d.getDate() - (1 + Math.floor(Math.random() * 25)));
      const dateISO = fmtDateISO(d);
      const heure = heures[Math.floor(Math.random() * heures.length)];
      const type = Math.random() < 0.35 ? 'retard' : 'absence';
      absences.push({
        id: Date.now() + Math.random(),
        eleveId: cible.eleve.id,
        nom: libelleEleve(cible.eleve),
        classe: cible.classe.nom,
        heure: heure,
        date: dateAffichage(dateISO),
        dateISO: dateISO,
        seance: heure < '13:00' ? 'matin' : 'apres-midi',
        type: type,
        duree: type === 'retard' ? durees[Math.floor(Math.random() * durees.length)] : '',
        statut: Math.random() < 0.6 ? 'justifie_s' : 'justifie_d',
        enseignant: prof.nom,
        matiere: prof.matiere,
        profCode: prof.code,
        motif: motifs[Math.floor(Math.random() * motifs.length)],
        justifiePar: Math.random() < 0.5 ? ('Surveillant ' + (Math.random() < 0.5 ? '1' : '2')) : 'Directeur',
        justifieLe: dateISO + ' ' + heure,
        test: true
      });
    }
  });
  localStorage.setItem('absences', JSON.stringify(absences));
  localStorage.setItem('testHistoGenere_v3', '1');
}"""
s = s[:d] + NOUVEAU_GEN + s[f:]
print('OK   generateur de donnees de test remplace')

s, c = re.subn(r'AbsenceTrack v3\.47', 'AbsenceTrack v3.48', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.48 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('code: "math-prof1"', 1), ('email: "math-prof1@taalim.ma"', 1),
                     ('email: "info-prof1@taalim.ma"', 1), ('math@taalim.ma', 0), ('pc@taalim.ma', 0),
                     ("'tableauxService_v2'", 2), ('testHistoGenere_v3', 2),
                     ("CLASSES_TABLEAUX_SERVICE = ['TCSF-1', 'TCSF-2', 'TCSF-3']", 1),
                     ('NB_ELEVES_CLASSE_SERVICE = 13', 1), ('profCode: prof.code', 1),
                     ("const heures = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];", 1),
                     ('absences = absences.filter(a => !a.test);', 1),
                     ('id="page-profil"', 1), ('id="page-dir-stats"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-52s = %d' % (cle, n))
    allok &= (n == attendu)

# les 11 profs + 3 comptes = 14 comptes
n = s.count('role: "enseignant", code:')
print(('OK   ' if n == 11 else 'ECHEC') + ' 11 professeurs avec code                      = %d' % n)
allok &= (n == 11)

o = s.count('<div'); f2 = s.count('</div>')
print(('OK   ' if o == f2 else 'ECHEC') + ' divs %d/%d' % (o, f2))
allok &= (o == f2)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
