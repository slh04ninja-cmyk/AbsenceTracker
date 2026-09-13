
function noeud(){ return { style:'', className:'', innerHTML:'', appendChild(c){ this.enfants=this.enfants||[]; this.enfants.push(c); }, set onclick(v){} }; }
const conteneur = noeud();
const body = { classList: { contains(){ return false; }, add(){}, remove(){} } };
const document = { body: body, getElementById(id){ return id==='historique-ens-list'?conteneur:null; }, createElement(){ return noeud(); } };
let utilisateurConnecte = { nom: 'Prof. Mathématiques', role: 'enseignant' };
const absences = [
  { eleveId: 1, classe: '3ème A', nom: 'Ahmed El Amrani', enseignant: 'Prof. Mathématiques', statut: 'justifie_s', dateISO: '2026-09-05', heure: '10:00' },
  { eleveId: 1, classe: '3ème A', nom: 'Ahmed El Amrani', enseignant: 'Prof. Mathématiques', statut: 'justifie_d', dateISO: '2026-09-07', heure: '09:00' },
  { eleveId: 1, classe: '3ème A', nom: 'Ahmed El Amrani', enseignant: 'Prof. Mathématiques', statut: 'absent',     dateISO: '2026-09-08', heure: '09:00' },
  { eleveId: 2, classe: '3ème A', nom: 'Fatima Benali',    enseignant: 'Prof. Mathématiques', statut: 'absent',     dateISO: '2026-09-09', heure: '11:00' },
  { eleveId: 3, classe: '3ème A', nom: 'Autre Eleve',      enseignant: 'Prof. SVT',           statut: 'justifie_s', dateISO: '2026-09-06', heure: '08:00' }
];
function libelleEleve(e) {
  if (!e) return '';
  return e.prenom ? (e.nom + ' ' + e.prenom) : e.nom;
}
function afficherHistorique() {
  const div = document.getElementById('historique-ens-list');
  if (!div) return;
  div.innerHTML = '';
  const moi = utilisateurConnecte ? utilisateurConnecte.nom : '';
  const map = {};
  absences.forEach(a => {
    // Uniquement les Ab/Rd signales par CE prof, et justifies
    if (a.enseignant !== moi) return;
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
  if (liste.length === 0) {
    div.innerHTML = '<p class="text-gray-500 text-center py-8">Aucun Ab/Rd réglé</p>';
    return;
  }
  liste.forEach(x => {
    const item = document.createElement('div');
    item.className = 'carte-eleve';
    item.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
    item.innerHTML = `
      <div class="absence-card-ligne">
        <span class="absence-card-name">${x.nom}</span>
        <span class="absence-card-classe">${x.classe}</span>
        <span class="carte-eleve-total">${x.count}</span>
        <i class="fas fa-chevron-right absence-card-icon"></i>
      </div>
    `;
    div.appendChild(item);
  });
}
afficherHistorique();
console.log('cartes affichees:', (conteneur.enfants || []).length);
(conteneur.enfants || []).forEach(c => console.log('   ', c.innerHTML.replace(/\s+/g, ' ').replace(/<[^>]+>/g, ' ').trim()));
