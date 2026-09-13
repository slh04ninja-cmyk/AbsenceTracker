# -*- coding: utf-8 -*-
"""v3.19 -> v3.20 : page Historique enseignant = style du surveillant,
mais uniquement ses propres Ab/Rd justifies."""
import io, re, shutil, subprocess

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

# 1. HTML de la page historique enseignant
plain('1-html',
      '    <div class="p-4"><div id="historique-list" class="space-y-2"></div></div>',
      '''    <div class="p-4">
      <h2 class="text-center font-bold text-gray-800 mb-4" style="font-size: 18px;">Historique des absences</h2>
      <div class="stat-card mb-4">
        <label class="block text-sm font-bold text-blue-900 mb-2">Rechercher un élève</label>
        <input type="text" id="recherche-eleve-ens" oninput="rechercherEleves('recherche-eleve-ens', 'resultats-recherche-ens')" placeholder="Nom ou code MASSAR..." class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">
        <div id="resultats-recherche-ens" class="mt-3 space-y-2"></div>
      </div>
      <div id="historique-ens-list"></div>
    </div>''')

# 2. JS : liste des Ab/Rd marques par CE prof et justifies, en cartes eleve
plain('2-js',
      """function afficherHistorique() {
  const list = document.getElementById('historique-list');
  list.innerHTML = '';
  const mesAbsences = absences.filter(a => a.enseignant === utilisateurConnecte.nom).reverse();
  if (mesAbsences.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-inbox"></i></div><p>Aucun enregistrement</p></div>';
    return;
  }
  mesAbsences.forEach(abs => {
    const item = document.createElement('div');
    item.className = 'bg-white rounded-lg px-4 py-2 mb-2 shadow-sm flex justify-between items-center';
    item.innerHTML = `
      <div>
        <p class="font-semibold text-gray-800 text-sm">${abs.nom}</p>
        <p class="text-xs text-gray-500">${abs.classe} — ${abs.date} ${abs.heure}${abs.matiere ? ' · ' + abs.matiere : ''}</p>
      </div>
    `;
    list.appendChild(item);
  });
}""",
      """function afficherHistorique() {
  const div = document.getElementById('historique-ens-list');
  if (!div) return;
  div.innerHTML = '';
  const moi = utilisateurConnecte ? utilisateurConnecte.nom : '';
  const map = {};
  absences.forEach(a => {
    // Uniquement les Ab/Rd signales par CE prof, et justifies
    if (a.enseignant !== moi) return;
    if (a.statut !== 'justifie_s' && a.statut !== 'justifie_d') return;
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0, dernier: '' };
    map[cle].count++;
    const dt = String(a.dateISO || '') + ' ' + String(a.heure || '');
    if (dt > map[cle].dernier) map[cle].dernier = dt;
  });
  const liste = Object.values(map).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(b.dernier).localeCompare(String(a.dernier));
  });
  if (liste.length === 0) {
    div.innerHTML = '<p class="text-gray-500 text-center py-8">Aucun Ab/Rd réglé</p>';
    return;
  }
  liste.forEach(x => {
    const item = document.createElement('div');
    item.className = 'carte-eleve';
    item.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
    item.innerHTML = `
      <div class="absence-card-ligne">
        <span class="absence-card-name">${x.nom}</span>
        <span class="absence-card-classe">${x.classe}</span>
        <span class="carte-eleve-total">${x.count}</span>
        <i class="fas fa-chevron-right absence-card-icon"></i>
      </div>
    `;
    div.appendChild(item);
  });
}""")

plain('3-version', 'AbsenceTrack v3.19 \u2014 Prototype', 'AbsenceTrack v3.20 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('historique-list', 0), ('historique-ens-list', 2), ('recherche-eleve-ens', 2), ('carte-eleve', 8)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check52.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '_check52.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])
print('DIVS', data.count('<div'), data.count('</div>'))
