# -*- coding: utf-8 -*-
"""v3.20 -> v3.21 : la fiche ne liste que les Ab/Rd marques par ce prof (si connecte en enseignant)."""
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

plain('1-fiche',
      "  const lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);\n  const absencesEl = lignes.filter(a => (a.type || 'absence') !== 'retard');",
      """  let lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  // Un enseignant ne voit que les Ab/Rd qu'il a lui-meme signales
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') {
    lignes = lignes.filter(a => a.enseignant === utilisateurConnecte.nom);
  }
  const absencesEl = lignes.filter(a => (a.type || 'absence') !== 'retard');""")

plain('2-version', 'AbsenceTrack v3.20 \u2014 Prototype', 'AbsenceTrack v3.21 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [("role === 'enseignant'", 1), ('let lignes = absences.filter', 1)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check53.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '_check53.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])

# test reel : fiche vue par un prof vs par un surveillant
fns = []
for nom in ['libelleEleve', 'libelleType', 'libelleStatut', 'libelleSeance', 'dateAffichage', 'abrevMatiere', 'ouvrirFicheEleve']:
    m2 = re.search(r'function ' + nom + r'\(.*?\n\}', d if False else data, re.DOTALL)
    if m2: fns.append(m2.group(0))
ligne = re.search(r'function ligneFiche\(.*?\n\}', data, re.DOTALL).group(0)
fns.append(ligne)
harness = """
function noeud(){ return { textContent:'', innerHTML:'', classList:{ add(){}, remove(){} }, style:'' }; }
const noeuds = {};
const document = { getElementById(id){ if(!noeuds[id]) noeuds[id] = noeud(); return noeuds[id]; } };
let utilisateurConnecte = { nom: 'Prof. Mathématiques', role: 'enseignant' };
const classes = [{ id: 1, nom: '3ème A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed', massar: 'M1' }] }];
const absences = [
  { eleveId: 1, classe: '3ème A', nom: 'Ahmed', type: 'absence', statut: 'absent', dateISO: '2026-09-05', heure: '10:00', date: '05/09/2026', matiere: 'Mathématiques', enseignant: 'Prof. Mathématiques' },
  { eleveId: 1, classe: '3ème A', nom: 'Ahmed', type: 'retard',  statut: 'justifie_s', dateISO: '2026-09-06', heure: '09:00', date: '06/09/2026', matiere: 'SVT', enseignant: 'Prof. SVT' },
  { eleveId: 1, classe: '3ème A', nom: 'Ahmed', type: 'absence', statut: 'justifie_d', dateISO: '2026-09-07', heure: '11:00', date: '07/09/2026', matiere: 'Français', enseignant: 'Prof. Français' }
];
let ficheEleveId = null, ficheClasseId = null;
""" + "\n".join(fns) + """
function test(roleNom, role) {
  utilisateurConnecte = { nom: roleNom, role: role };
  ouvrirFicheEleve(1, 1);
  const infos = noeuds['fiche-infos'].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
  const histo = noeuds['fiche-historique'].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
  console.log(role, '| totaux:', (infos.match(/Totaux (.+)$/) || [])[1]);
  console.log('        lignes:', histo);
}
test('Prof. Mathématiques', 'enseignant');
test('Surveillant 1', 'surveillant');
"""
io.open('_test_fiche.js', 'w', encoding='utf-8').write(harness)
print(subprocess.run([node, '_test_fiche.js'], capture_output=True, text=True).stdout)
