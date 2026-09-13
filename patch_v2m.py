# -*- coding: utf-8 -*-
"""v2.2 -> v2.3 : generateur de donnees de test (12 et 16 incidents) sans effacer l'existant."""
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

# ---------- 1. injecter le generateur avant init() ----------
generateur = '''// ========== DONNEES DE TEST (historique aleatoire, une seule fois) ==========
function genererDonneesTestHistorique() {
  if (localStorage.getItem('testHistoGenere_v1')) return;
  const profs = comptes.filter(c => c.role === 'enseignant');
  const motifs = ['Maladie', 'Raison familiale', 'Raison personnelle', 'Transport', 'Autre'];
  const durees = ['15 min', '30 min', '1 h'];
  const heures = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  const cibles = [];
  const cl0 = classes[0];
  if (cl0 && cl0.eleves.length >= 2) {
    cibles.push({ eleve: cl0.eleves[0], classe: cl0, nombre: 12 });
    cibles.push({ eleve: cl0.eleves[1], classe: cl0, nombre: 16 });
  }
  const base = new Date();
  cibles.forEach(cible => {
    for (let i = 0; i < cible.nombre; i++) {
      const prof = profs[Math.floor(Math.random() * profs.length)];
      const d = new Date(base);
      d.setDate(d.getDate() - (1 + Math.floor(Math.random() * 25)));
      const dateISO = fmtDateISO(d);
      const heure = heures[Math.floor(Math.random() * heures.length)];
      const type = Math.random() < 0.35 ? 'retard' : 'absence';
      const r = Math.random();
      let statut = 'absent';
      let motif = '';
      let justifiePar = '';
      let justifieLe = '';
      if (r < 0.30) statut = 'justifie_s';
      else if (r < 0.45) statut = 'justifie_d';
      if (statut !== 'absent') {
        motif = motifs[Math.floor(Math.random() * motifs.length)];
        justifiePar = Math.random() < 0.5 ? ('Surveillant ' + (Math.random() < 0.5 ? '1' : '2')) : 'Directeur';
        justifieLe = dateISO + ' ' + heure;
      }
      absences.push({
        id: Date.now() + Math.random(),
        eleveId: cible.eleve.id,
        nom: libelleEleve(cible.eleve),
        classe: cible.classe.nom,
        heure: heure,
        date: dateAffichage(dateISO),
        dateISO: dateISO,
        seance: heure < '13:00' ? 'matin' : 'apres-midi',
        type: type,
        duree: type === 'retard' ? durees[Math.floor(Math.random() * durees.length)] : '',
        statut: statut,
        enseignant: prof.nom,
        matiere: prof.matiere,
        motif: motif,
        justifiePar: justifiePar,
        justifieLe: justifieLe
      });
    }
  });
  localStorage.setItem('absences', JSON.stringify(absences));
  localStorage.setItem('testHistoGenere_v1', '1');
}

// ========== INIT =========='''

plain('1-generateur', '// ========== INIT ==========', generateur)

# ---------- 2. appel au demarrage ----------
plain('2-appelInit',
      'function init() {\n  const saved = localStorage.getItem(\'utilisateur\');',
      'function init() {\n  genererDonneesTestHistorique();\n  const saved = localStorage.getItem(\'utilisateur\');')

# ---------- 3. version ----------
plain('3-version', 'AbsenceTrack v2.2 \u2014 Prototype', 'AbsenceTrack v2.3 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('genererDonneesTestHistorique', 2), ('testHistoGenere_v1', 2), ('nombre: 12', 1), ('nombre: 16', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
# test d'execution du generateur en isolation (logique pure)
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check23.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '_check23.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1500])
print('DIVS', data.count('<div'), data.count('</div>'))
