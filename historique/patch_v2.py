# -*- coding: utf-8 -*-
"""AbsenceTrack-Beautiful-2 -> v2 : corrections bugs + CSS + carte surveillant."""
import re, io, shutil, subprocess, sys, os

SRC = '/storage/emulated/0/Download/AbsenceTrack-Beautiful-2.html'
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

# ---------- A. demo -> const + B. inversion nom/prenom ----------
plain('A-constDemo', 'let classes = [', 'const classesDemo = [')
rx('B-swapNames', r'\{ id: (\d+), nom: "([^"]+)", prenom: "([^"]+)" \}',
   r'{ id: \1, nom: "\3", prenom: "\2" }', 38)

# ---------- C. persistance classes ----------
oldC = ('];\n\n// Compteur auto-incr\xe9ment\xe9 pour les IDs\n'
        'let nextClasseId = 5;\nlet nextEleveId = 39;')
newC = '''];

// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========
let classes = [];
let nextClasseId = 1;
let nextEleveId = 1;

function chargerClasses() {
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
}

classes = chargerClasses();'''
if not rx('C-loadClasses', r'\];\s*\n// Compteur auto-incr[^\n]*\nlet nextClasseId = 5;\nlet nextEleveId = 39;', newC, 1):
    plain('C-loadClasses-plain', oldC, newC)

# ---------- D. variable matiere ----------
plain('D-varMatiere', 'let classeSelectionnee = null;',
      'let classeSelectionnee = null;\nlet matiereSelectionnee = \'Math\\xe9matiques\';')

# ---------- E. fmtDateISO (date locale) ----------
plain('E-fmtDateISO', 'let decochesManuellement = new Set();',
      'let decochesManuellement = new Set(); // \xc9l\xe8ves d\xe9coch\xe9s manuellement apr\xe8s sauvegarde\n\n'
      '// Date locale (evite le decalage UTC: toISOString renvoie la veille a 00h-01h au Maroc)\n'
      'function fmtDateISO(d) {\n'
      '  const m = String(d.getMonth() + 1).padStart(2, \'0\');\n'
      '  const j = String(d.getDate()).padStart(2, \'0\');\n'
      '  return d.getFullYear() + \'-\' + m + \'-\' + j;\n'
      '}')

# ---------- F..J. remplacement toISOString -> fmtDateISO ----------
plain('F-newDateISO', "new Date().toISOString().split('T')[0]", 'fmtDateISO(new Date())', 4)
plain('G-nowISO', "now.toISOString().split('T')[0]", 'fmtDateISO(now)', 3)
plain('H-ddISO', "dd.toISOString().split('T')[0]", 'fmtDateISO(dd)', 1)
plain('I-dISO', "d.toISOString().split('T')[0]", 'fmtDateISO(d)', 1)
plain('J-hierISO', "hier.toISOString().split('T')[0]", 'fmtDateISO(hier)', 1)

# ---------- K. select Matiere dans la page enseignant ----------
oldK = '''          <option value="">-- Choisir une classe --</option>
        </select>
      </div>'''
newK = '''          <option value="">-- Choisir une classe --</option>
        </select>
        <div class="mt-4">
          <label class="block text-sm font-bold text-blue-900 mb-2">Mati\xe8re</label>
          <select id="select-matiere" onchange="changerMatiere()" class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
            <option value="Math\xe9matiques">Math\xe9matiques</option>
            <option value="Physique-Chimie">Physique-Chimie</option>
            <option value="SVT">SVT</option>
            <option value="Arabe">Arabe</option>
            <option value="Fran\xe7ais">Fran\xe7ais</option>
            <option value="Anglais">Anglais</option>
            <option value="Histoire-G\xe9ographie">Histoire-G\xe9ographie</option>
            <option value="Philosophie">Philosophie</option>
            <option value="\xc9ducation islamique">\xc9ducation islamique</option>
            <option value="EPS">EPS</option>
            <option value="Informatique">Informatique</option>
          </select>
        </div>
      </div>'''
plain('K-selectMatiere', oldK, newK)

# ---------- L. fonction changerMatiere ----------
plain('L-changerMatiere', 'function afficherListeEleves() {',
      'function changerMatiere() {\n'
      '  matiereSelectionnee = document.getElementById(\'select-matiere\').value;\n'
      '}\n\n'
      'function afficherListeEleves() {')

# ---------- M. matiere reellement enregistree ----------
plain('M-matiereSave', "matiere: 'Math\xe9matiques'", 'matiere: matiereSelectionnee')

# ---------- N. matiere dans l'historique enseignant ----------
oldN = '<p class="text-xs text-gray-500">${abs.classe} \u2014 ${abs.date} ${abs.heure}</p>'
newN = '<p class="text-xs text-gray-500">${abs.classe} \u2014 ${abs.date} ${abs.heure}${abs.matiere ? \' \u00b7 \' + abs.matiere : \'\'}</p>'
plain('N-historiqueMatiere', oldN, newN)

# ---------- O. supprimerEleve purge + sauvegarde ----------
rx('O-supprimerEleve', r'function supprimerEleve\(classeId, eleveId\) \{.*?\n\}',
   '''function supprimerEleve(classeId, eleveId) {
  const classe = classes.find(c => c.id === classeId);
  if (!classe) return;
  classe.eleves = classe.eleves.filter(e => e.id !== eleveId);
  absences = absences.filter(a => !(a.eleveId === eleveId && a.classe === classe.nom));
  localStorage.setItem('absences', JSON.stringify(absences));
  sauvegarderClasses();
  afficherGestionDir();
  mettreAJourDashboardDir();
  afficherToast('Eleve supprim\xe9', 'success');
}''', 1)

# ---------- P. supprimerClasseCourante purge + sauvegarde ----------
rx('P-supprimerClasse', r'function supprimerClasseCourante\(\) \{.*?\n\}',
   '''function supprimerClasseCourante() {
  if (classeDetailCourante) {
    const cl = classes.find(c => c.id === classeDetailCourante);
    if (cl) {
      absences = absences.filter(a => a.classe !== cl.nom);
      localStorage.setItem('absences', JSON.stringify(absences));
    }
    classes = classes.filter(c => c.id !== classeDetailCourante);
    sauvegarderClasses();
    fermerDetailClasse();
    afficherGestionDir();
    mettreAJourDashboardDir();
    afficherToast('Classe supprim\xe9e', 'success');
  }
}''', 1)

# ---------- Q. sauvegarde classes apres import ----------
plain('Q-saveImport', '\n  importData = null;', '\n  sauvegarderClasses();\n  importData = null;')

# ---------- R. cartes Absences detaillees (surveillant) ----------
newR = '''absencesToday.forEach(abs => {
    const card = document.createElement('div');
    card.className = 'absence-card';
    card.onclick = () => afficherDetailAbsence(abs);

    const etat = abs.statut === 'justifie_s'
      ? { txt: 'Justifi\xe9e S', bg: '#3b82f6' }
      : abs.statut === 'justifie_d'
        ? { txt: 'Justifi\xe9e D', bg: '#10b981' }
        : { txt: 'Absent', bg: '#ef4444' };

    card.innerHTML = `
      <div class="absence-card-ligne">
        <span class="absence-card-name">${abs.nom}</span>
        <span class="absence-card-classe">${abs.classe}</span>
      </div>
      <div class="absence-card-ligne" style="margin-top: 10px;">
        <span class="absence-card-badge-statut" style="background: ${etat.bg};">${etat.txt}</span>
        <i class="fas fa-chevron-right absence-card-icon"></i>
      </div>
    `;
    listContainer.appendChild(card);
  });'''
rx('R-cartesSurv', r'absencesToday\.forEach\(abs => \{.*?listContainer\.appendChild\(card\);\n  \}\);', newR, 1)

# ---------- S/T/U/V/W. suppression emojis UI -> icones FA ----------
plain('S-alerteLabel', '<div class="stat-label mb-4">\u26a0\ufe0f Alertes importantes</div>',
      '<div class="stat-label mb-4"><i class="fas fa-exclamation-triangle text-red-500 mr-1"></i> Alertes importantes</div>')
plain('T-alerteRow', '<p class="font-bold text-red-700">\u26a0\ufe0f ${cl.nom}</p>',
      '<p class="font-bold text-red-700"><i class="fas fa-exclamation-triangle mr-1"></i> ${cl.nom}</p>')
plain('U-emptyClasse', '<div class="empty-icon">\U0001f4da</div><p class="text-gray-600">S\xe9lectionnez une classe</p>',
      '<div class="empty-icon"><i class="fas fa-school"></i></div><p class="text-gray-600">S\xe9lectionnez une classe</p>')
plain('V-emptyFiltres', "    div.innerHTML = '<div class=\"empty-state py-8\"><div class=\"empty-icon\">' + (filterActive === 'absents' ? '\u2705' : '\U0001f4cb') + '</div><p class=\"text-gray-500\">' + msg + '</p></div>';",
      "    const iconeEmpty = filterActive === 'absents' ? 'fa-user-check' : 'fa-users';\n    div.innerHTML = '<div class=\"empty-state py-8\"><div class=\"empty-icon\"><i class=\"fas ' + iconeEmpty + '\"></i></div><p class=\"text-gray-500\">' + msg + '</p></div>';")
plain('W-emptyHistorique', '<div class="empty-icon">\U0001f4ed</div><p>Aucun enregistrement</p>',
      '<div class="empty-icon"><i class="fas fa-inbox"></i></div><p>Aucun enregistrement</p>')

# ---------- X. version ----------
plain('X-version', 'AbsenceTrack v1.0 \u2014 Prototype', 'AbsenceTrack v1.1 \u2014 Prototype')

# ---------- Y/Z. CSS cartes surveillant + empty-icon ----------
rx('Y-cssCartes',
   r'\.absence-card-header \{ display: flex; justify-content: space-between; align-items: flex-start; \}.*?font-weight: 700; \}',
   '''.absence-card-ligne { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .absence-card-name { font-weight: 700; color: #1e293b; font-size: 14px; flex: 1; min-width: 0; }
    .absence-card-classe { font-size: 12px; color: #475569; font-weight: 600; background: #eef2f7; padding: 5px 10px; border-radius: 8px; white-space: nowrap; }
    .absence-card-badge-statut { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #fff; letter-spacing: 0.4px; box-shadow: 0 2px 8px rgba(15,23,42,0.18); }''', 1)
plain('Z-emptyIcon', '.empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.5; }',
      '.empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.5; color: #94a3b8; }')

# ---------- ecriture + rapport ----------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

# ---------- controles residuels ----------
for pat, att in [('\U0001f4da', 0), ('\u2705', 0), ('\U0001f4cb', 0), ('\U0001f4ed', 0), ('\u26a0', 0),
                 ("toISOString().split", 0), ("matiere: 'Math", 0),
                 ('fa-user-check', 1), ('fa-user-slash', 1), ('sauvegarderClasses(', 5), ('fmtDateISO(', 11),
                 ('select-matiere', 2), ('chargerClasses', 2)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

# ---------- syntaxe JS si node dispo ----------
node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
else:
    print('NODE_CHECK skipped (node absent)')
