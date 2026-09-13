
const absences = [
  { eleveId: 1, classe: 'A', nom: 'Regle',    statut: 'justifie_s', dateISO: '2026-09-05', heure: '10:00' },
  { eleveId: 1, classe: 'A', nom: 'Regle',    statut: 'justifie_d', dateISO: '2026-09-06', heure: '08:00' },
  { eleveId: 1, classe: 'A', nom: 'Regle',    statut: 'absent',    dateISO: '2026-09-07', heure: '09:00' },
  { eleveId: 2, classe: 'A', nom: 'NonRegle', statut: 'absent',    dateISO: '2026-09-09', heure: '11:00' },
  { eleveId: 2, classe: 'A', nom: 'NonRegle', statut: 'absent',    dateISO: '2026-09-08', heure: '09:00' },
  { eleveId: 3, classe: 'A', nom: 'Mixte',    statut: 'justifie_d', dateISO: '2026-09-02', heure: '09:00' },
  { eleveId: 3, classe: 'A', nom: 'Mixte',    statut: 'absent',    dateISO: '2026-09-03', heure: '09:00' }
];
const map = {};
absences.forEach(a => {
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
console.log('affiches:', liste.map(x => x.nom + '=' + x.count).join(' | ') || 'aucun');
console.log('NonRegle visible ?', liste.some(x => x.nom === 'NonRegle'));
