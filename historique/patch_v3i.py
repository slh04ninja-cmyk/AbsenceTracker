# -*- coding: utf-8 -*-
"""v3.18 -> v3.19 : bordure gauche coloree aussi en theme sombre (fin du conflit !important)."""
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

# 1. lignes eleves : plus de classes de bordure (source du conflit), bordures en inline
plain('1-lignes',
      """    const item = document.createElement('div');
    item.className = 'flex items-center px-4 py-3 border-b border-gray-100 transition-all';
    item.style = estCoche ? ('border-left: 5px solid ' + couleurBordure + '; background: ' + fond) : 'border-left: 5px solid transparent';""",
      """    const item = document.createElement('div');
    item.className = 'flex items-center px-4 py-3 transition-all';
    const bordureBas = enSombre ? '#334155' : '#f1f5f9';
    item.style = 'border-bottom: 1px solid ' + bordureBas + '; border-left: 5px solid ' + (estCoche ? couleurBordure : 'transparent') + ';' + (estCoche ? ' background: ' + fond + ';' : '');""")

plain('2-version', 'AbsenceTrack v3.18 \u2014 Prototype', 'AbsenceTrack v3.19 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('border-gray-100', 1), ('bordureBas', 2)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check51.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '_check51.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])

# test : la ligne ne doit plus porter de classe de bordure, et la bordure doit etre coloree
fns = []
for nom in ['fmtDateISO', 'jourCourant', 'seanceCourante', 'libelleEleve', 'couleursAbsRd', 'teinte', 'eclaircir', 'afficherListeEleves']:
    fns.append(re.search(r'function ' + nom + r'\(.*?\n\}', data, re.DOTALL).group(0))
cst = re.search(r"const COULEUR_ABSENCE.*?const COULEUR_RETARD = '#f59e0b';", data, re.DOTALL).group(0)
harness = """
function noeud(){ return { style:'', className:'', innerHTML:'', appendChild(c){ this.enfants=this.enfants||[]; this.enfants.push(c); } }; }
const conteneur = noeud();
const body = { classList: { _c: [], contains(c){ return this._c.indexOf(c)>=0; }, add(c){ this._c.push(c); }, remove(){} } };
const document = { body: body, getElementById(id){ return id==='liste-eleves-enseignant'?conteneur:null; }, createElement(){ return noeud(); } };
let utilisateurConnecte = { nom:'Prof. X', role:'enseignant' };
const classeSelectionnee = { id:1, nom:'3ème A', eleves:[{id:1,nom:'El Amrani',prenom:'Ahmed'},{id:2,nom:'Benali',prenom:'Fatima'}] };
let absences = [{ id:9, eleveId:1, classe:'3ème A', nom:'A', type:'retard', statut:'absent', dateISO:(new Date()).toISOString().slice(0,10), seance:'matin', heure:'08:00', enseignant:'Prof. SVT' }];
const elevesCoches = new Map(); const decochesManuellement = new Set();
""" + cst + "\n" + "\n\n".join(fns) + """
function test(theme) {
  document.body.classList._c = theme === 'sombre' ? ['role-enseignant','theme-sombre'] : ['role-enseignant'];
  conteneur.enfants = [];
  afficherListeEleves();
  const r = conteneur.enfants[0];
  console.log(theme, '| classes:', r.className, '| style:', r.style);
}
test('clair'); test('sombre');
"""
io.open('_test_rd2.js', 'w', encoding='utf-8').write(harness)
print(subprocess.run([node, '_test_rd2.js'], capture_output=True, text=True).stdout.strip())
