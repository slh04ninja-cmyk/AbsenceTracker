# -*- coding: utf-8 -*-
"""v2.5 -> v2.6 : fiche = liste unique triee par datetime decroissant, sans separateur."""
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

rx('1-fiche', r'function ouvrirFicheEleve\(.*?\n\}', '''function ouvrirFicheEleve(eleveId, classeId) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  ficheEleveId = eleveId;
  ficheClasseId = classeId;
  document.getElementById('fiche-titre').textContent = libelleEleve(el);
  const lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  const nbAbs = lignes.filter(a => (a.type || 'absence') !== 'retard').length;
  const nbRet = lignes.filter(a => a.type === 'retard').length;
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom arabe', el.nomArabe || el.nom || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', nbAbs + ' absence(s) · ' + nbRet + ' retard(s)');

  const cont = document.getElementById('fiche-historique');
  if (lignes.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    // Tri par datetime decroissant (date puis heure)
    const tri = lignes.slice().sort((a, b) => {
      const da = String(a.dateISO || '');
      const db = String(b.dateISO || '');
      if (da !== db) return db.localeCompare(da);
      return String(b.heure || '').localeCompare(String(a.heure || ''));
    });
    cont.innerHTML = tri.map(a => {
      const retard = a.type === 'retard';
      const marque = retard ? 'Rd' : 'Ab';
      const styleMarque = retard ? 'color: #f59e0b; font-weight: 800;' : 'color: #ef4444; font-weight: 800;';
      const info = (a.duree ? '(' + a.duree + ') ' : '') + (a.matiere || '') + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      return '<div class="p-3 bg-white rounded-lg" style="margin-bottom: 6px;"><div class="flex justify-between items-center"><span class="font-medium text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + styleMarque + '">' + marque + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
    }).join('');
  }
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}''')

plain('2-version', 'AbsenceTrack v2.5 \u2014 Prototype', 'AbsenceTrack v2.6 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('border-top: 1px solid #94a3b8', 0), ('ligneHisto', 0), ('absencesEl', 0),
                 ('retardsEl', 0), ("'Ab'", 1), ("'Rd'", 1), ('datetime decroissant', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check26.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check26.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])

# test reel du tri
test = '''
const lignes = [
  {dateISO:'2026-09-10',heure:'08:00',type:'absence'},
  {dateISO:'2026-09-10',heure:'16:00',type:'retard'},
  {dateISO:'2026-09-02',heure:'09:00',type:'retard'},
  {dateISO:'2026-09-10',heure:'14:00',type:'absence'},
  {dateISO:'2026-08-30',heure:'11:00',type:'absence'}
];
const tri = lignes.slice().sort((a, b) => {
  const da = String(a.dateISO || ''), db = String(b.dateISO || '');
  if (da !== db) return db.localeCompare(da);
  return String(b.heure || '').localeCompare(String(a.heure || ''));
});
console.log(tri.map(x => x.dateISO + ' ' + x.heure + ' ' + x.type).join(' | '));
'''
io.open('_test_tri.js', 'w', encoding='utf-8').write(test)
print('TRI:', subprocess.run([node, '_test_tri.js'], capture_output=True, text=True).stdout.strip())
print('DIVS', data.count('<div'), data.count('</div>'))
