const store = {};
const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
function fmtDateISO(d) { const m = String(d.getMonth() + 1).padStart(2, '0'); const j = String(d.getDate()).padStart(2, '0'); return d.getFullYear() + '-' + m + '-' + j; }
function libelleEleve(e) { return e.prenom ? (e.nom + ' ' + e.prenom) : e.nom; }
function dateAffichage(iso) { const dt = new Date(iso + 'T12:00:00'); return isNaN(dt.getTime()) ? iso : dt.toLocaleDateString('fr-FR'); }
const comptes = [
  { email: 'pc@taalim.ma', role: 'enseignant', matiere: 'Physique', nom: 'Prof. Physique' },
  { email: 'math@taalim.ma', role: 'enseignant', matiere: 'Mathématiques', nom: 'Prof. Mathématiques' },
  { email: 'fr@taalim.ma', role: 'enseignant', matiere: 'Français', nom: 'Prof. Français' },
  { email: 'ar@taalim.ma', role: 'enseignant', matiere: 'Arabe', nom: 'Prof. Arabe' },
  { email: 'svt@taalim.ma', role: 'enseignant', matiere: 'SVT', nom: 'Prof. SVT' },
  { email: 's1@taalim.ma', role: 'surveillant', nom: 'Surveillant 1' }
];
const classes = [{ id: 1, nom: '3ème A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }, { id: 3, nom: 'Alami', prenom: 'Mohamed' }] }];
const absences = [];
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
genererDonneesTestHistorique();
const e1 = absences.filter(a => a.eleveId === 1), e2 = absences.filter(a => a.eleveId === 2);
console.log('TOTAL', absences.length, '| eleve1', e1.length, '| eleve2', e2.length);
const champs = ['date', 'dateISO', 'heure', 'seance', 'type', 'statut', 'enseignant', 'matiere'];
console.log('champs complets:', absences.every(a => champs.every(c => a[c] !== undefined && a[c] !== '')));
console.log('types:', JSON.stringify(absences.reduce((m, a) => (m[a.type] = (m[a.type] || 0) + 1, m), {})));
console.log('statuts:', JSON.stringify(absences.reduce((m, a) => (m[a.statut] = (m[a.statut] || 0) + 1, m), {})));
console.log('justifies avec motif:', absences.filter(a => a.motif).length, '| justifiePar:', absences.filter(a => a.justifiePar).length);
console.log('dates < aujourdhui:', absences.every(a => a.dateISO < fmtDateISO(new Date())));
console.log('exemple:', JSON.stringify(e1[0]));
genererDonneesTestHistorique();
console.log('idempotent (2e appel):', absences.length);
