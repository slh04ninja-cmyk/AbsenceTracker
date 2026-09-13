# -*- coding: utf-8 -*-
"""v2.0 -> v2.1 : page Historique surveillant (titre) + fiche eleve unifiee (Js/NJ, sans exclusion, sans seance)."""
import re, io, os, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()
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

def rfn(label, name, body, args=r'\(.*?\)'):
    return rx(label, r'function ' + re.escape(name) + args + r' \{.*?\n\}', body)

# ---------- 1. titre centre "Historique des absences" ----------
plain('1-titre',
      '''      <div class="stat-card mb-4">
        <label class="block text-sm font-bold text-blue-900 mb-2">Rechercher un élève</label>
        <input type="text" id="recherche-eleve" oninput="rechercherEleves('recherche-eleve', 'resultats-recherche')" placeholder="Nom ou code MASSAR..." class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">''',
      '''      <h2 class="text-center font-bold text-gray-800 mb-4" style="font-size: 18px;">Historique des absences</h2>
      <div class="stat-card mb-4">
        <label class="block text-sm font-bold text-blue-900 mb-2">Rechercher un élève</label>
        <input type="text" id="recherche-eleve" oninput="rechercherEleves('recherche-eleve', 'resultats-recherche')" placeholder="Nom ou code MASSAR..." class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">''')

# ---------- 2. fiche : nom centre ----------
plain('2-titreCentre',
      '''    <div class="flex justify-between items-center px-5 pt-4 pb-2">
      <h2 class="text-lg font-bold text-gray-800" id="fiche-titre">Fiche élève</h2>
      <button onclick="fermerFicheEleve()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
    </div>''',
      '''    <div class="flex items-center px-5 pt-4 pb-2">
      <span style="width: 32px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 text-center" id="fiche-titre" style="flex: 1;">Fiche élève</h2>
      <button onclick="fermerFicheEleve()" class="text-gray-400 hover:text-gray-600 leading-none" style="width: 32px; flex-shrink: 0; font-size: 24px;">&times;</button>
    </div>''')

# ---------- 3. fiche : sans exclusion, sans seance, statut Js / NJ en gras colore ----------
rfn('3-fiche', 'ouvrirFicheEleve', '''function ouvrirFicheEleve(eleveId, classeId) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  ficheEleveId = eleveId;
  ficheClasseId = classeId;
  document.getElementById('fiche-titre').textContent = libelleEleve(el);
  const lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  const nbAbs = lignes.filter(a => (a.type || 'absence') === 'absence').length;
  const nbRet = lignes.filter(a => a.type === 'retard').length;
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom arabe', el.nomArabe || el.nom || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', nbAbs + ' absence(s) · ' + nbRet + ' retard(s)');
  const hist = lignes.slice().sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')));
  const cont = document.getElementById('fiche-historique');
  if (hist.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    cont.innerHTML = hist.map(a => {
      const justifie = (a.statut === 'justifie_s' || a.statut === 'justifie_d');
      const statutTxt = justifie ? 'Js' : 'NJ';
      const statutStyle = justifie ? 'color: #10b981; font-weight: 800;' : 'color: #ef4444; font-weight: 800;';
      const info = libelleType(a.type) + (a.duree ? ' (' + a.duree + ')' : '') + ' · ' + (a.matiere || '') + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      return '<div class="p-3 bg-gray-50 rounded-lg"><div class="flex justify-between items-center"><span class="font-medium text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + statutStyle + '">' + statutTxt + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
    }).join('');
  }
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}

function ouvrirFicheEleveParNom(nom, nomClasse) {
  const cl = classes.find(c => c.nom === nomClasse);
  if (!cl) { afficherToast('Élève introuvable', 'error'); return; }
  const el = cl.eleves.find(e => libelleEleve(e) === nom);
  if (!el) { afficherToast('Élève introuvable', 'error'); return; }
  ouvrirFicheEleve(el.id, cl.id);
}''')

# ---------- 4. carte de la liste -> meme fiche eleve ----------
rfn('4-listeSurv', 'afficherClassesSurv', '''function afficherClassesSurv() {
  const div = document.getElementById('surv-classes-list');
  div.innerHTML = '';
  const justifiees = absences.filter(a => a.statut === 'justifie_s' || a.statut === 'justifie_d');
  const map = {};
  justifiees.forEach(a => {
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0 };
    map[cle].count++;
  });
  const liste = Object.values(map).sort((a, b) => b.count - a.count);
  if (liste.length === 0) {
    div.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune absence justifiée</p>';
    return;
  }
  liste.forEach(x => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center rounded-xl bg-white';
    item.style = 'margin: 4px 0; padding: 8px 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); cursor: pointer;';
    item.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
    item.innerHTML = `
      <div>
        <p class="font-bold text-gray-800 text-sm">${x.nom}</p>
        <p class="text-xs text-gray-500">${x.classe}</p>
      </div>
      <span class="text-sm font-bold text-blue-600">${x.count} absence(s)</span>
    `;
    div.appendChild(item);
  });
}''', r'\(\)')

# ---------- 5. supprimer l'ancienne popup historique eleve (devenue inutile) ----------
rx('5-supprModal',
   r'\n<!-- MODAL HISTORIQUE ELEVE \(SURVEILLANT\) -->.*?\n</div>\n\n<!-- TOAST -->',
   '\n<!-- TOAST -->')
rx('6-supprOuvrirFn', r"function ouvrirHistoriqueEleve\(nom, classe\) \{.*?\n\}\n\n", '')
rx('7-supprFermerFn', r"function fermerHistoriqueEleve\(\) \{.*?\n\}\n\n", '')

# ---------- 8. version ----------
plain('8-version', 'AbsenceTrack v2.0 \u2014 Prototype', 'AbsenceTrack v2.1 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('historique-eleve', 0), ('ouvrirHistoriqueEleve', 0), ('ouvrirFicheEleveParNom', 2),
                 ('Historique des absences', 1), ('exclusion(s)', 0), ('libelleSeance(a.seance)', 0),
                 ('badge-info', 1), ("'Js'", 1), ("'NJ'", 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check21.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '_check21.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1500])
print('DIVS', data.count('<div'), data.count('</div>'))
