
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
function libelleEleve(e) {
  if (!e) return '';
  return e.prenom ? (e.nom + ' ' + e.prenom) : e.nom;
}
function libelleType(t) {
  if (t === 'retard') return 'Retard';
  if (t === 'exclusion') return 'Exclusion de cours';
  return 'Absence';
}
function libelleStatut(s) {
  if (s === 'justifie_s') return 'Justifiée S';
  if (s === 'justifie_d') return 'Justifiée D';
  return 'Non justifiée';
}
function libelleSeance(s) {
  return s === 'apres-midi' ? 'Après-midi' : 'Matin';
}
function dateAffichage(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}
function abrevMatiere(m) {
  if (!m) return '-';
  const t = String(m).trim();
  const s = t.toLowerCase();
  if (s.indexOf('math') >= 0) return 'MATH';
  if (s.indexOf('physique') >= 0 || s === 'pc') return 'PC';
  if (s.indexOf('fran') >= 0) return 'FR';
  if (s.indexOf('arabe') >= 0 || s === 'ar') return 'AR';
  if (s.indexOf('svt') >= 0 || s.indexOf('science') >= 0) return 'SVT';
  if (s.indexOf('anglais') >= 0) return 'ANG';
  if (s.indexOf('histoire') >= 0 || s.indexOf('géo') >= 0) return 'HG';
  if (s.indexOf('philo') >= 0) return 'PHILO';
  if (s.indexOf('islam') >= 0 || s.indexOf('ducation') >= 0) return 'EI';
  if (s.indexOf('eps') >= 0 || s.indexOf('sport') >= 0) return 'EPS';
  if (s.indexOf('info') >= 0) return 'INFO';
  return t.toUpperCase();
}
function ouvrirFicheEleve(eleveId, classeId) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  ficheEleveId = eleveId;
  ficheClasseId = classeId;
  document.getElementById('fiche-titre').textContent = libelleEleve(el);
  const lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  const nbAbs = lignes.filter(a => (a.type || 'absence') !== 'retard').length;
  const nbRet = lignes.filter(a => a.type === 'retard').length;
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom arabe', el.nomArabe || el.nom || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', nbAbs + ' ' + (nbAbs < 2 ? 'absence' : 'absences') + ' · ' + nbRet + ' ' + (nbRet < 2 ? 'retard' : 'retards'));

  const cont = document.getElementById('fiche-historique');
  if (lignes.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    // Tri par datetime decroissant (date puis heure)
    const tri = lignes.slice().sort((a, b) => {
      const da = String(a.dateISO || '');
      const db = String(b.dateISO || '');
      if (da !== db) return db.localeCompare(da);
      return String(b.heure || '').localeCompare(String(a.heure || ''));
    });
    cont.innerHTML = tri.map(a => {
      const retard = a.type === 'retard';
      const marque = retard ? 'Rd' : 'Ab';
      const palM = couleursAbsRd();
      const styleMarque = 'color: ' + (retard ? palM.rd : palM.abs) + '; font-weight: 800;';
      const info = abrevMatiere(a.matiere) + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      return '<div class="py-2 border-b border-gray-200"><div class="flex justify-between items-center"><span class="text-sm font-semibold text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + styleMarque + '">' + marque + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
    }).join('');
  }
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}
function ligneFiche(titre, valeur) {
  return '<div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">' + titre + '</span><span class="text-sm font-semibold text-gray-800">' + valeur + '</span></div>';
}
function test(roleNom, role) {
  utilisateurConnecte = { nom: roleNom, role: role };
  ouvrirFicheEleve(1, 1);
  const infos = noeuds['fiche-infos'].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const histo = noeuds['fiche-historique'].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(role, '| totaux:', (infos.match(/Totaux (.+)$/) || [])[1]);
  console.log('        lignes:', histo);
}
test('Prof. Mathématiques', 'enseignant');
test('Surveillant 1', 'surveillant');
