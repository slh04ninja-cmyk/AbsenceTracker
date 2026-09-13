# -*- coding: utf-8 -*-
"""v3.0 -> v3.1 : test data tout justifie (12 et 17) + regle 1 seul Ab/Rd non justifie par eleve."""
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

# ---------- 1. generateur : tout justifie, 12 et 17, purge des anciens tests ----------
rx('1-generateur', r'function genererDonneesTestHistorique\(\) \{.*?\n\}', '''function genererDonneesTestHistorique() {
  if (localStorage.getItem('testHistoGenere_v2')) return;
  const profs = comptes.filter(c => c.role === 'enseignant');
  const motifs = ['Maladie', 'Raison familiale', 'Raison personnelle', 'Transport', 'Autre'];
  const durees = ['15 min', '30 min', '1 h'];
  const heures = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  const cibles = [];
  const cl0 = classes[0];
  if (cl0 && cl0.eleves.length >= 2) {
    cibles.push({ eleve: cl0.eleves[0], classe: cl0, nombre: 12 });
    cibles.push({ eleve: cl0.eleves[1], classe: cl0, nombre: 17 });
  }
  // Purge des Ab/Rd de test precedents de ces 2 eleves (pour des totaux exacts)
  const nomCl0 = cl0 ? cl0.nom : '';
  const idsCibles = cibles.map(c => c.eleve.id);
  absences = absences.filter(a => !(a.classe === nomCl0 && idsCibles.indexOf(a.eleveId) >= 0));

  const base = new Date();
  cibles.forEach(cible => {
    for (let i = 0; i < cible.nombre; i++) {
      const prof = profs[Math.floor(Math.random() * profs.length)];
      const d = new Date(base);
      d.setDate(d.getDate() - (1 + Math.floor(Math.random() * 25)));
      const dateISO = fmtDateISO(d);
      const heure = heures[Math.floor(Math.random() * heures.length)];
      const type = Math.random() < 0.35 ? 'retard' : 'absence';
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
        statut: Math.random() < 0.6 ? 'justifie_s' : 'justifie_d',
        enseignant: prof.nom,
        matiere: prof.matiere,
        motif: motifs[Math.floor(Math.random() * motifs.length)],
        justifiePar: Math.random() < 0.5 ? ('Surveillant ' + (Math.random() < 0.5 ? '1' : '2')) : 'Directeur',
        justifieLe: dateISO + ' ' + heure,
        test: true
      });
    }
  });
  localStorage.setItem('absences', JSON.stringify(absences));
  localStorage.setItem('testHistoGenere_v2', '1');
}''')

# ---------- 2. regle : un seul Ab/Rd non justifie par eleve (verrouillage) ----------
plain('2-listeVerrou',
      """  const typePrecedent = {};
  absences.forEach(a => {
    if (a.classe !== classeSelectionnee.nom) return;
    if (!(a.dateISO < jour)) return;
    if (a.statut === 'justifie_s' || a.statut === 'justifie_d') return;
    if (!typePrecedent[a.eleveId]) typePrecedent[a.eleveId] = a.type || 'absence';
  });""",
      """  // Regle : un eleve ne peut avoir qu'UN SEUL Ab/Rd non justifie.
  // Tout enregistrement en attente HORS de la seance en cours verrouille l'eleve.
  const typePrecedent = {};
  const raisonPrecedent = {};
  absences.forEach(a => {
    if (a.classe !== classeSelectionnee.nom) return;
    if (a.statut === 'justifie_s' || a.statut === 'justifie_d') return;
    const memeJour = a.dateISO === jour;
    const memeSeance = (a.seance || 'matin') === seance;
    if (memeJour && memeSeance) return;
    if (!typePrecedent[a.eleveId]) {
      typePrecedent[a.eleveId] = a.type || 'absence';
      raisonPrecedent[a.eleveId] = memeJour ? 'non justifié · autre séance' : 'non justifié';
    }
  });""")

plain('3-raison',
      "    else if (precedent) raison = 'séance préc.';",
      "    else if (precedent) raison = raisonPrecedent[id] || 'non justifié';")

# ---------- 4. garde-fou cote enregistrement ----------
plain('4-garde',
      """function basculerMarque(id, type, coche) {
  const jour = jourCourant();
  const seance = seanceCourante();
  if (!coche) {""",
      """function basculerMarque(id, type, coche) {
  const jour = jourCourant();
  const seance = seanceCourante();
  if (coche) {
    const enAttenteAilleurs = absences.some(a =>
      a.eleveId === id && a.classe === classeSelectionnee.nom &&
      a.statut !== 'justifie_s' && a.statut !== 'justifie_d' &&
      !(a.dateISO === jour && (a.seance || 'matin') === seance)
    );
    if (enAttenteAilleurs) {
      afficherToast('Un seul Ab/Rd non justifié par élève', 'error');
      afficherListeEleves();
      return;
    }
  }
  if (!coche) {""")

# ---------- 5. version ----------
plain('5-version', 'AbsenceTrack v3.0 \u2014 Prototype', 'AbsenceTrack v3.1 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('nombre: 12', 1), ('nombre: 17', 1), ('testHistoGenere_v2', 2), ('raisonPrecedent', 3),
                 ('enAttenteAilleurs', 2), ('UN SEUL Ab/Rd non justifie', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check32.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check32.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])

# ---------- test reel du generateur ----------
fn = re.search(r'function genererDonneesTestHistorique\(\).*?\n\}', data, re.DOTALL).group(0)
harness = '''const store = {};
const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
function fmtDateISO(d) { const m = String(d.getMonth() + 1).padStart(2, '0'); const j = String(d.getDate()).padStart(2, '0'); return d.getFullYear() + '-' + m + '-' + j; }
function libelleEleve(e) { return e.prenom ? (e.nom + ' ' + e.prenom) : e.nom; }
function dateAffichage(iso) { const dt = new Date(iso + 'T12:00:00'); return isNaN(dt.getTime()) ? iso : dt.toLocaleDateString('fr-FR'); }
const comptes = [
  { role: 'enseignant', matiere: 'Physique', nom: 'Prof. Physique' },
  { role: 'enseignant', matiere: 'Mathématiques', nom: 'Prof. Mathématiques' },
  { role: 'enseignant', matiere: 'SVT', nom: 'Prof. SVT' }
];
const classes = [{ id: 1, nom: '3ème A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] }];
let absences = [{ eleveId: 1, classe: '3ème A', nom: 'vieux', statut: 'absent', dateISO: '2026-08-01', heure: '08:00' }];
''' + fn + '''
genererDonneesTestHistorique();
const e1 = absences.filter(a => a.eleveId === 1), e2 = absences.filter(a => a.eleveId === 2);
console.log('TOTAL', absences.length, '| eleve1', e1.length, '| eleve2', e2.length);
console.log('tous justifies:', absences.every(a => a.statut === 'justifie_s' || a.statut === 'justifie_d'));
console.log('motifs remplis:', absences.every(a => !!a.motif), '| justifiePar:', absences.every(a => !!a.justifiePar), '| justifieLe:', absences.every(a => !!a.justifieLe));
console.log('non justifies:', absences.filter(a => a.statut === 'absent').length);
console.log('anciens purges:', !absences.some(a => a.nom === 'vieux'));
console.log('types:', JSON.stringify(absences.reduce((m, a) => (m[a.type] = (m[a.type] || 0) + 1, m), {})));
console.log('motifs:', JSON.stringify(absences.reduce((m, a) => (m[a.motif] = (m[a.motif] || 0) + 1, m), {})));
genererDonneesTestHistorique();
console.log('idempotent:', absences.length);
'''
io.open('_test_gen2.js', 'w', encoding='utf-8').write(harness)
print('TEST:'); print(subprocess.run([node, '_test_gen2.js'], capture_output=True, text=True).stdout.strip())
