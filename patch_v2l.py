# -*- coding: utf-8 -*-
"""v2.1 -> v2.2 : fiche historique Ab/Rd + separateur, compteur Ab+Rd dans la liste."""
import re, io, shutil, subprocess

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

# ---------- 1. fiche : Ab / Rd + separateur absences / retards ----------
rfn('1-fiche', 'ouvrirFicheEleve', '''function ouvrirFicheEleve(eleveId, classeId) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  ficheEleveId = eleveId;
  ficheClasseId = classeId;
  document.getElementById('fiche-titre').textContent = libelleEleve(el);
  const lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  const absencesEl = lignes.filter(a => (a.type || 'absence') !== 'retard');
  const retardsEl = lignes.filter(a => a.type === 'retard');
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom arabe', el.nomArabe || el.nom || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', absencesEl.length + ' absence(s) · ' + retardsEl.length + ' retard(s)');

  function ligneHisto(a, marque, styleMarque) {
    const info = (a.duree ? '(' + a.duree + ') ' : '') + (a.matiere || '') + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
    return '<div class="p-3 bg-white rounded-lg" style="margin-bottom: 6px;"><div class="flex justify-between items-center"><span class="font-medium text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + styleMarque + '">' + marque + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
  }

  const cont = document.getElementById('fiche-historique');
  if (lignes.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    const trier = arr => arr.slice().sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')));
    let html = '';
    if (absencesEl.length) {
      html += trier(absencesEl).map(a => ligneHisto(a, 'Ab', 'color: #ef4444; font-weight: 800;')).join('');
    }
    if (absencesEl.length && retardsEl.length) {
      html += '<div style="border-top: 1px solid #94a3b8; margin: 12px 0;"></div>';
    }
    if (retardsEl.length) {
      html += trier(retardsEl).map(a => ligneHisto(a, 'Rd', 'color: #f59e0b; font-weight: 800;')).join('');
    }
    cont.innerHTML = html;
  }
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}''')

# ---------- 2. liste : compteur = nombre de Ab + Rd ----------
rfn('2-liste', 'afficherClassesSurv', '''function afficherClassesSurv() {
  const div = document.getElementById('surv-classes-list');
  div.innerHTML = '';
  const map = {};
  absences.forEach(a => {
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0 };
    map[cle].count++;
  });
  const liste = Object.values(map).sort((a, b) => b.count - a.count);
  if (liste.length === 0) {
    div.innerHTML = '<p class="text-gray-500 text-center py-8">Aucun historique</p>';
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
      <span class="text-sm font-bold text-blue-600">${x.count}</span>
    `;
    div.appendChild(item);
  });
}''', r'\(\)')

# ---------- 3. version ----------
plain('3-version', 'AbsenceTrack v2.1 \u2014 Prototype', 'AbsenceTrack v2.2 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [("'Js'", 0), ("'NJ'", 0), ("'Ab'", 1), ("'Rd'", 1),
                 ('border-top: 1px solid #94a3b8', 1), ('absence(s)</span>', 0),
                 ('Aucun historique', 1), ('absencesEl', 5)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check22.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '_check22.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1500])
print('DIVS', data.count('<div'), data.count('</div>'))
