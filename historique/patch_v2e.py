# -*- coding: utf-8 -*-
"""v2 -> dashboard enseignant: carte classe seule au depart + carte classe dans Stats."""
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

# ---------- 1. supprimer le label "Classe" de la carte ----------
plain('1-labelClasse',
      '        <label class="block text-sm font-bold text-blue-900 mb-2">Classe</label>\n        <select id="select-classe"',
      '        <select id="select-classe"')

# ---------- 2. ouvrir la zone masquee autour de la prise d'absence ----------
plain('2-zoneOuvre',
      '      <div id="toolbar-filtres" class="toolbar hidden">',
      '      <div id="zone-prise-absence" class="hidden">\n        <div id="toolbar-filtres" class="toolbar">')

# ---------- 3. fermer la zone avant la fin du conteneur ----------
oldTail = '''              <i class="fas fa-user-slash text-white text-xl"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="bottom-nav">
    <div class="nav-item active" onclick="switchEnsPage('enseignant', this)">'''
newTail = '''              <i class="fas fa-user-slash text-white text-xl"></i>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
  <div class="bottom-nav">
    <div class="nav-item active" onclick="switchEnsPage('enseignant', this)">'''
plain('3-zoneFerme', oldTail, newTail)

# ---------- 4. carte de choix de classe dans la page Stats ----------
plain('4-statsCarte',
      '    <div class="p-4">\n      <div class="stat-card">\n        <div class="stat-label">Taux de présence</div>',
      '''    <div class="p-4">
      <div class="stat-card mb-4">
        <select id="select-classe-stats" onchange="changerClasseStats()" class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
          <option value="">-- Choisir une classe --</option>
        </select>
      </div>
      <div class="stat-card">
        <div class="stat-label">Taux de présence</div>''')

# ---------- 5. remplissage des deux selects + choix unifie ----------
rx('5-remplirSelects', r'function remplirListeClasses\(\) \{.*?\n\}',
   '''function remplirListeClasses() {
  ['select-classe', 'select-classe-stats'].forEach(idSelect => {
    const select = document.getElementById(idSelect);
    if (!select) return;
    select.innerHTML = '<option value="">-- Choisir une classe --</option>';
    classes.forEach(classe => {
      const opt = document.createElement('option');
      opt.value = classe.id;
      opt.textContent = classe.nom + ' (' + classe.eleves.length + ' élèves)';
      select.appendChild(opt);
    });
  });
}

function choisirClasse(id) {
  id = parseInt(id);
  const selClasse = document.getElementById('select-classe');
  const selStats = document.getElementById('select-classe-stats');
  const zone = document.getElementById('zone-prise-absence');
  if (selClasse) selClasse.value = id ? String(id) : '';
  if (selStats) selStats.value = id ? String(id) : '';

  if (!id) {
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    filterActive = 'all';
    document.getElementById('ens-classe-name').textContent = 'Sélectionnez une classe';
    if (zone) zone.classList.add('hidden');
    return;
  }
  if (!classeSelectionnee || classeSelectionnee.id !== id) {
    classeSelectionnee = classes.find(c => c.id === id);
    if (classeSelectionnee) {
      elevesCoches.clear();
      decochesManuellement.clear();
      filterActive = 'all';
      const chips = document.querySelectorAll('#toolbar-filtres .filter-chip');
      chips.forEach(c => c.classList.remove('active'));
      if (chips[0]) chips[0].classList.add('active');
    }
  }
  if (!classeSelectionnee) return;
  document.getElementById('ens-classe-name').textContent = classeSelectionnee.nom;
  if (zone) zone.classList.remove('hidden');
  afficherListeEleves();
  mettreAJourCompteur();
}''')

# ---------- 6. ancien changerClasse remplace par deux wrappers ----------
rx('6-wrappers', r'function changerClasse\(\) \{.*?\n\}',
   '''function changerClasse() {
  choisirClasse(document.getElementById('select-classe').value);
}

function changerClasseStats() {
  choisirClasse(document.getElementById('select-classe-stats').value);
  afficherStatistiques();
}''')

# ---------- 7. message stats sans classe ----------
plain('7-statsMsg',
      "'<p class=\"text-gray-500 text-center py-4\">Sélectionnez une classe</p>';",
      "'<p class=\"text-gray-500 text-center py-4\">Choisissez une classe ci-dessus</p>';")

# ---------- 8. version ----------
plain('8-version', 'AbsenceTrack v1.3 \u2014 Prototype', 'AbsenceTrack v1.4 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('zone-prise-absence', 5), ('select-classe-stats', 3), ('choisirClasse', 5),
                 ('changerClasseStats', 2), ('Choisissez une classe ci-dessus', 1),
                 ('>Classe</label>', 0), ('toolbar-filtres', 3)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check5.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
else:
    print('NODE_CHECK skipped (node absent)')
