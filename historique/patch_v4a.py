# -*- coding: utf-8 -*-
"""AbsenceTrack v3.39 : page Gestion du directeur.

1. Carte « Rechercher un élève » supprimee.
2. Import MASSAR multi-fichiers : on peut selectionner/deposer plusieurs .xlsx d'un coup, tous les
   fichiers sont lus (toutes feuilles) et fusionnes en une seule preview avant confirmation.
3. La liste des eleves d'une classe n'apparait plus dans la carte de la classe : la carte ne montre
   que le nom + le nombre d'eleves + chevron, et le clic ouvre le popup de classe (deja existant).
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-42s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ---------- 1. supprimer la carte de recherche ----------
CARTE_RECHERCHE = """      <div class="stat-card mb-4">
        <label class="block text-sm font-bold text-blue-900 mb-2">Rechercher un élève</label>
        <input type="text" id="recherche-eleve-dir" oninput="rechercherEleves('recherche-eleve-dir', 'resultats-recherche-dir')" placeholder="Nom ou code MASSAR..." class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">
        <div id="resultats-recherche-dir" class="mt-3 space-y-2"></div>
      </div>
"""
allok &= remplace('carte de recherche supprimee', CARTE_RECHERCHE, '')

# ---------- 2. carte d'import : multi-fichiers ----------
allok &= remplace('titre import',
                  '<h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-file-excel text-green-600 mr-2"></i>Importer un fichier MASSAR</h3>',
                  '<h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-file-excel text-green-600 mr-2"></i>Importer des fichiers MASSAR</h3>')
allok &= remplace('texte import',
                  '<p class="text-sm text-gray-500 mb-3">Uploadez un fichier Excel MASSAR (export_notesCC) : toutes les feuilles (classes) sont importées en une fois. Colonnes : C = code MASSAR, D = nom arabe, E = nom français.</p>',
                  '<p class="text-sm text-gray-500 mb-3">Uploadez un ou plusieurs fichiers Excel MASSAR (export_notesCC) : tous les fichiers et toutes leurs feuilles (classes) sont importés en une seule fois. Colonnes : C = code MASSAR, D = nom arabe, E = nom français.</p>')
allok &= remplace('zone de depot',
                  '<p class="text-gray-600 font-medium">Cliquez ou glissez un fichier ici</p>',
                  '<p class="text-gray-600 font-medium">Cliquez ou glissez un ou plusieurs fichiers ici</p>')
allok &= remplace('input multiple',
                  '<input type="file" id="file-massar" accept=".xlsx,.xls" class="hidden" onchange="importerMassar(this)">',
                  '<input type="file" id="file-massar" accept=".xlsx,.xls" class="hidden" multiple onchange="importerMassar(this)">')
allok &= remplace('bouton de confirmation',
                  '<button onclick="confirmerImport()" class="btn-primary w-full mt-3"><i class="fas fa-download"></i> Importer cette classe</button>',
                  '<button onclick="confirmerImport()" class="btn-primary w-full mt-3"><i class="fas fa-download"></i> Importer les classes détectées</button>')

# ---------- 3. indice sur la carte des classes ----------
allok &= remplace('indice liste des classes',
                  '<h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-list text-blue-900 mr-2"></i>Classes existantes</h3>\n        <div id="dir-classes-list" class="space-y-3"></div>',
                  '<h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-list text-blue-900 mr-2"></i>Classes existantes</h3>\n        <p class="text-sm text-gray-500 mb-3">Cliquez sur une classe pour voir la liste de ses élèves.</p>\n        <div id="dir-classes-list" class="space-y-3"></div>')

# ---------- 4. la carte de classe ne montre plus les eleves ----------
ANCIEN = """  classes.forEach(cl => {
    const item = document.createElement('div');
    item.className = 'bg-gray-50 rounded-xl p-4';
    const elevesHTML = cl.eleves.map(e =>
      `<div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
        <div>
          <span class="text-gray-700">${libelleEleve(e)}</span>
          ${e.massar ? '<span class="text-xs text-gray-400 ml-2">' + e.massar + '</span>' : ''}
        </div>
        <button onclick="supprimerEleve(${cl.id}, ${e.id})" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-times"></i></button>
      </div>`
    ).join('');
    item.innerHTML = `
      <div class="flex justify-between items-center mb-2 cursor-pointer" onclick="ouvrirDetailClasse(${cl.id})">
        <div>
          <p class="font-bold text-gray-800">${cl.nom}</p>
          <p class="text-sm text-gray-500">${cl.eleves.length} élèves</p>
        </div>
        <i class="fas fa-chevron-right text-gray-400"></i>
      </div>
      ${elevesHTML}
    `;
    listDiv.appendChild(item);
  });"""
NOUVEAU = """  // Carte = nom de la classe + effectif ; les eleves s'affichent dans le popup (clic)
  classes.forEach(cl => {
    const item = document.createElement('div');
    item.className = 'bg-gray-50 rounded-xl p-4 cursor-pointer';
    item.setAttribute('onclick', 'ouvrirDetailClasse(' + cl.id + ')');
    item.innerHTML =
      '<div class="flex justify-between items-center">' +
        '<div>' +
          '<p class="font-bold text-gray-800">' + cl.nom + '</p>' +
          '<p class="text-sm text-gray-500">' + cl.eleves.length + ' élèves</p>' +
        '</div>' +
        '<i class="fas fa-chevron-right text-gray-400"></i>' +
      '</div>';
    listDiv.appendChild(item);
  });"""
allok &= remplace('carte de classe sans la liste des eleves', ANCIEN, NOUVEAU)

# ---------- 5. import multi-fichiers (JS) ----------
ANCIEN_JS_DEBUT = "function importerMassar(input) {"
i = s.index(ANCIEN_JS_DEBUT)
# fin de processMassarFile : 'reader.readAsArrayBuffer(file);\n}\n'
fin_marker = "  reader.readAsArrayBuffer(file);\n}\n"
j = s.index(fin_marker, i) + len(fin_marker)
ancien_js = s[i:j]
assert 'processMassarFile' in ancien_js and 'FileReader' in ancien_js
print('OK   ancien code d import = %d caracteres' % len(ancien_js))

NOUVEAU_JS = """function importerMassar(input) {
  const fichiers = Array.prototype.slice.call(input.files || []);
  input.value = '';
  processMassarFiles(fichiers);
}

// Lecture d'un fichier MASSAR -> Promise { fichier, classes, erreur }
function lireFichierMASSAR(file) {
  return new Promise(function (resolve) {
    if (!file.name.match(/\\.xlsx?$/i)) {
      resolve({ fichier: file.name, classes: [], erreur: 'format non supporté (xlsx attendu)' });
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const classesTrouvees = [];
        workbook.SheetNames.forEach(nomFeuille => {
          const parsed = analyserFeuilleMASSAR(workbook.Sheets[nomFeuille]);
          if (parsed) classesTrouvees.push(parsed);
        });
        resolve({ fichier: file.name, classes: classesTrouvees, erreur: classesTrouvees.length ? '' : 'aucune classe détectée' });
      } catch (err) {
        resolve({ fichier: file.name, classes: [], erreur: err.message });
      }
    };
    reader.onerror = function () { resolve({ fichier: file.name, classes: [], erreur: 'lecture impossible' }); };
    reader.readAsArrayBuffer(file);
  });
}

// Un ou plusieurs fichiers : tous sont lus puis fusionnes en une seule preview
function processMassarFiles(fichiers) {
  const errorDiv = document.getElementById('import-error');
  const previewDiv = document.getElementById('import-preview');
  errorDiv.classList.add('hidden');
  previewDiv.classList.add('hidden');
  if (!fichiers || fichiers.length === 0) return;

  Promise.all(fichiers.map(lireFichierMASSAR)).then(function (resultats) {
    const classesTrouvees = [];
    const erreurs = [];
    resultats.forEach(function (r) {
      if (r.erreur) erreurs.push(r.fichier + ' : ' + r.erreur);
      r.classes.forEach(function (c) { classesTrouvees.push(c); });
    });
    if (classesTrouvees.length === 0) {
      errorDiv.textContent = 'Aucune classe détectée. Vérifiez le format MASSAR (nom de classe en I9, élèves à partir de la ligne 18, colonnes C = code, D = nom arabe, E = nom français).' + (erreurs.length ? ' Détail : ' + erreurs.join(' · ') : '');
      errorDiv.classList.remove('hidden');
      return;
    }
    importData = { classes: classesTrouvees };
    const total = classesTrouvees.reduce(function (acc, c) { return acc + c.eleves.length; }, 0);
    document.getElementById('preview-classe-nom').textContent = classesTrouvees.length + ' classe(s) détectée(s) dans ' + fichiers.length + ' fichier(s)';
    document.getElementById('preview-eleves-count').textContent = total + ' élève(s) au total';
    document.getElementById('preview-eleves-list').innerHTML = classesTrouvees.map(function (c) {
      return '<div class="flex justify-between py-1 border-b border-green-100"><span class="font-medium">' + c.nom + '</span><span class="text-xs text-gray-400">' + c.eleves.length + ' élèves</span></div>';
    }).join('') + (erreurs.length ? '<p class="text-xs text-red-600 pt-2">Ignoré : ' + erreurs.join(' · ') + '</p>' : '');
    previewDiv.classList.remove('hidden');
  });
}
"""
s = s[:i] + NOUVEAU_JS + s[j:]

allok &= remplace('glisser-deposer multi-fichiers',
                  """    const file = e.dataTransfer.files[0];
    if (file) processMassarFile(file);""",
                  """    const fichiers = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (fichiers.length) processMassarFiles(fichiers);""")

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.38', 'AbsenceTrack v3.39', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.39 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('recherche-eleve-dir', 0), ('resultats-recherche-dir', 0),
                     ('processMassarFile', 0), ('function processMassarFiles', 1),
                     ('function lireFichierMASSAR', 1), ('multiple onchange="importerMassar(this)"', 1),
                     ('Importer des fichiers MASSAR', 1), ('Importer les classes détectées', 1),
                     ('Cliquez sur une classe pour voir la liste', 1), ('id="file-massar"', 1),
                     ('id="modal-classe-detail"', 1), ('dir-classes-list', 1),
                     ('id="page-profil"', 1), ('id="page-dir-stats"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-40s = %d' % (cle, n))
    allok &= (n == attendu)

# la carte de classe ne contient plus de liste d'eleves
i = s.index('function afficherGestionDir(')
j = s.index('function importerMassar(')
bloc = s[i:j]
print(('OK   ' if 'supprimerEleve(' not in bloc else 'ECHEC') + ' plus de supprimerEleve dans la carte de classe')
allok &= ('supprimerEleve(' not in bloc)
print(('OK   ' if 'ouvrirDetailClasse(' in bloc else 'ECHEC') + ' clic -> popup de classe')
allok &= ('ouvrirDetailClasse(' in bloc)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
