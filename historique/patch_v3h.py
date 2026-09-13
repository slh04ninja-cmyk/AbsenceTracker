# -*- coding: utf-8 -*-
"""v3.17 -> v3.18 : Ab toujours ROUGE, Rd toujours ORANGE (independamment des lots de role)."""
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

# 1. lots de role : on retire abs/rd (ils restent pour l'habillage)
plain('1-lots',
      """const LOTS_ROLE = {
  enseignant:  { primaire: '#6994CC', fonce: '#363759', accent: '#AAAAD0', abs: '#D93C78', rd: '#74759C' },
  surveillant: { primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69', abs: '#EB7F69', rd: '#566C9D' }
};""",
      """const LOTS_ROLE = {
  enseignant:  { primaire: '#6994CC', fonce: '#363759', accent: '#AAAAD0' },
  surveillant: { primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69' }
};

// Absence = toujours ROUGE, Retard = toujours ORANGE (+ degradations)
const COULEUR_ABSENCE = '#ef4444';
const COULEUR_RETARD = '#f59e0b';""")

plain('2-couleursAbsRd',
      """function couleursAbsRd() {
  const lot = utilisateurConnecte ? LOTS_ROLE[utilisateurConnecte.role] : null;
  return lot ? { abs: lot.abs, rd: lot.rd } : { abs: '#ef4444', rd: '#f59e0b' };
}""",
      """function couleursAbsRd() {
  return { abs: COULEUR_ABSENCE, rd: COULEUR_RETARD };
}""")

# 2. variables de role : plus besoin de --lot-abs / --lot-rd
plain('3-varsEns',
      'body.role-enseignant { --lot-primaire: #6994CC; --lot-fonce: #363759; --lot-accent: #AAAAD0; --lot-abs: #D93C78; --lot-rd: #74759C; }',
      'body.role-enseignant { --lot-primaire: #6994CC; --lot-fonce: #363759; --lot-accent: #AAAAD0; }')
plain('4-varsSurv',
      'body.role-surveillant { --lot-primaire: #566C9D; --lot-fonce: #3D3E4E; --lot-accent: #EB7F69; --lot-abs: #EB7F69; --lot-rd: #566C9D; }',
      'body.role-surveillant { --lot-primaire: #566C9D; --lot-fonce: #3D3E4E; --lot-accent: #EB7F69; }')

# 3. le badge de nombre de l'historique reste rouge (rouge = absence)
plain('5-badgeRole',
      '    body:not(.theme-sombre).role-enseignant .carte-eleve-total, body:not(.theme-sombre).role-surveillant .carte-eleve-total { color: var(--lot-abs); background: rgba(0,0,0,0.06); }\n',
      '')

plain('6-version', 'AbsenceTrack v3.17 \u2014 Prototype', 'AbsenceTrack v3.18 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [("COULEUR_ABSENCE = '#ef4444'", 1), ("COULEUR_RETARD = '#f59e0b'", 1), ('--lot-abs', 0), ("lot.abs", 0)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_check50.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '/data/data/com.termux/files/home/AbsenceTrack-dev/_check50.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])

# test de rendu : Ab/Rd rouge/orange dans les deux themes + les deux roles
fns = []
for nom in ['fmtDateISO', 'jourCourant', 'seanceCourante', 'libelleEleve', 'couleursAbsRd', 'teinte', 'eclaircir', 'afficherListeEleves']:
    fns.append(re.search(r'function ' + nom + r'\(.*?\n\}', data, re.DOTALL).group(0))
cst = re.search(r"const COULEUR_ABSENCE.*?const COULEUR_RETARD = '#f59e0b';", data, re.DOTALL).group(0)
harness = """
function noeud(){ return { style:'', className:'', innerHTML:'', appendChild(c){ this.enfants=this.enfants||[]; this.enfants.push(c); } }; }
let conteneur = noeud();
const body = { classList: { _c: [], contains(c){ return this._c.indexOf(c)>=0; }, add(c){ this._c.push(c); }, remove(){} } };
const document = { body: body, getElementById(id){ return id==='liste-eleves-enseignant'?conteneur:null; }, createElement(){ return noeud(); } };
let utilisateurConnecte = { nom:'Prof. Mathématiques', role:'enseignant' };
const classeSelectionnee = { id:1, nom:'3ème A', eleves:[{id:1,nom:'El Amrani',prenom:'Ahmed'},{id:2,nom:'Benali',prenom:'Fatima'}] };
let absences = [{ id:9, eleveId:1, classe:'3ème A', nom:'A', type:'retard', statut:'absent', dateISO:(new Date()).toISOString().slice(0,10), seance:'matin', heure:'08:00', enseignant:'Prof. SVT' }];
const elevesCoches = new Map(); const decochesManuellement = new Set();
""" + cst + "\n" + "\n\n".join(fns) + """
function test(role, theme) {
  utilisateurConnecte = { nom: 'Prof. X', role: role };
  document.body.classList._c = theme === 'sombre' ? ['role-' + role, 'theme-sombre'] : ['role-' + role];
  conteneur.enfants = [];
  afficherListeEleves();
  const h = conteneur.enfants[0].innerHTML.replace(/\\s+/g, ' ');
  const bord = conteneur.enfants[0].style.match(/border-left: 5px solid (#[0-9a-fA-F]{6})/)[1];
  const nom = (h.match(/color: (#[0-9a-fA-F]{6}); font-weight: 600/) || [])[1];
  console.log(role, theme, '=> bordure', bord, '| nom', nom);
}
test('enseignant', 'clair'); test('enseignant', 'sombre');
test('surveillant', 'clair'); test('surveillant', 'sombre');
"""
io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_test_rd.js', 'w', encoding='utf-8').write(harness)
print(subprocess.run([node, '/data/data/com.termux/files/home/AbsenceTrack-dev/_test_rd.js'], capture_output=True, text=True).stdout.strip())
