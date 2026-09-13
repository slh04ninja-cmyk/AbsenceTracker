
const absences = [
  { eleveId: 1, classe: 'A', nom: 'E1', dateISO: '2026-09-01', heure: '08:00' },
  { eleveId: 1, classe: 'A', nom: 'E1', dateISO: '2026-09-05', heure: '10:00' },
  { eleveId: 1, classe: 'A', nom: 'E1', dateISO: '2026-09-05', heure: '08:00' },
  { eleveId: 2, classe: 'A', nom: 'E2', dateISO: '2026-09-09', heure: '11:00' },
  { eleveId: 2, classe: 'A', nom: 'E2', dateISO: '2026-09-09', heure: '09:00' },
  { eleveId: 2, classe: 'A', nom: 'E2', dateISO: '2026-09-02', heure: '09:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-10', heure: '16:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-10', heure: '14:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-08', heure: '14:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-07', heure: '14:00' },
  { eleveId: 4, classe: 'A', nom: 'E4', dateISO: '2026-09-03', heure: '15:00' }
];
const map = {};
absences.forEach(a => {
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
console.log(liste.map(x => x.nom + '=' + x.count + ' (' + x.dernier + ')').join(' | '));
