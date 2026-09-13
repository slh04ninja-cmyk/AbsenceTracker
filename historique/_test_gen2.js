const store = {};
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
function genererDonneesTestHistorique() {
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
}
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
