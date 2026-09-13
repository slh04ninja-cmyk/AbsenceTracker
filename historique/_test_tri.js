
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
