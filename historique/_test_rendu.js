
// ---- stubs DOM ----
function noeud() {
  return { style: '', className: '', innerHTML: '', appendChild(c){ this.enfants = this.enfants || []; this.enfants.push(c); } };
}
const conteneur = noeud();
const body = { classList: { _c: [], contains(c){ return this._c.indexOf(c) >= 0; }, add(c){ this._c.push(c); }, remove(){} } };
const document = { body: body, getElementById(id){ return id === 'liste-eleves-enseignant' ? conteneur : null; }, createElement(){ return noeud(); } };
const utilisateurConnecte = { nom: 'Prof. Mathématiques', role: 'enseignant', matiere: 'Mathématiques' };
const classeSelectionnee = { id: 1, nom: '3ème A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] };
const absences = [{ id: 9, eleveId: 1, classe: '3ème A', nom: 'El Amrani Ahmed', type: 'retard', statut: 'absent', dateISO: (new Date()).toISOString().slice(0,10), seance: 'matin', heure: '08:00', enseignant: 'Prof. SVT' }];
const elevesCoches = new Map();
const decochesManuellement = new Set();
const classeDetailCourante = null;
const LOTS_ROLE = {
  enseignant:  { primaire: '#6994CC', fonce: '#363759', accent: '#AAAAD0', abs: '#D93C78', rd: '#74759C' },
  surveillant: { primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69', abs: '#EB7F69', rd: '#566C9D' }
};
function fmtDateISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + j;
}

function jourCourant() {
  return fmtDateISO(new Date());
}

function seanceCourante() {
  // Test : 00-12 = Matin, 13-23 = Apres-midi   (production : 08-12 / 14-18)
  return new Date().getHours() <= 12 ? 'matin' : 'apres-midi';
}

function libelleEleve(e) {
  if (!e) return '';
  return e.prenom ? (e.nom + ' ' + e.prenom) : e.nom;
}

function libelleType(t) {
  if (t === 'retard') return 'Retard';
  if (t === 'exclusion') return 'Exclusion de cours';
  return 'Absence';
}

function couleursAbsRd() {
  const lot = utilisateurConnecte ? LOTS_ROLE[utilisateurConnecte.role] : null;
  return lot ? { abs: lot.abs, rd: lot.rd } : { abs: '#ef4444', rd: '#f59e0b' };
}

function teinte(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b2 = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + v + ',' + b2 + ',' + alpha + ')';
}

function eclaircir(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const melange = c => Math.round(c + (255 - c) * ratio);
  return '#' + [melange(r), melange(v), melange(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function afficherListeEleves() {
  const div = document.getElementById('liste-eleves-enseignant');
  div.innerHTML = '';
  if (!classeSelectionnee) return;
  const tousLesEleves = classeSelectionnee.eleves;
  const jour = jourCourant();
  const seance = seanceCourante();
  const moi = utilisateurConnecte.nom;
  const memeSeance = a => (a.seance || 'matin') === seance;

  const incidentsJour = absences.filter(a =>
    a.classe === classeSelectionnee.nom && a.dateISO === jour && memeSeance(a) &&
    a.statut !== 'justifie_s' && a.statut !== 'justifie_d'
  );
  const typeMoi = {};
  const typeAutre = {};
  const quiAutre = {};
  incidentsJour.forEach(a => {
    if (a.enseignant === moi) {
      if (!typeMoi[a.eleveId]) typeMoi[a.eleveId] = a.type || 'absence';
    } else if (!typeAutre[a.eleveId]) {
      typeAutre[a.eleveId] = a.type || 'absence';
      quiAutre[a.eleveId] = a.enseignant;
    }
  });
  // Regle : un eleve ne peut avoir qu'UN SEUL Ab/Rd non justifie.
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
  });

  tousLesEleves.forEach(eleve => {
    const id = eleve.id;
    const parAutre = Object.prototype.hasOwnProperty.call(typeAutre, id);
    const precedent = !parAutre && Object.prototype.hasOwnProperty.call(typePrecedent, id);
    const verrouille = parAutre || precedent;
    let marque = null;
    if (parAutre) marque = typeAutre[id];
    else if (precedent) marque = typePrecedent[id];
    else if (elevesCoches.has(id)) marque = elevesCoches.get(id);
    else if (Object.prototype.hasOwnProperty.call(typeMoi, id) && !decochesManuellement.has(id)) marque = typeMoi[id];

    const cocheRetard = marque === 'retard';
    const cocheAbsent = marque !== null && marque !== 'retard';
    const estCoche = cocheAbsent || cocheRetard;
    const numero = tousLesEleves.findIndex(e => e.id === id) + 1;

    const palAbsRd = couleursAbsRd();
    const couleur = cocheRetard ? palAbsRd.rd : palAbsRd.abs;
    const enSombre = document.body.classList.contains('theme-sombre');
    const couleurBordure = enSombre ? eclaircir(couleur, 0.35) : couleur;
    const fond = teinte(couleur, enSombre ? 0.20 : 0.10);
    const item = document.createElement('div');
    item.className = 'flex items-center px-4 py-3 border-b border-gray-100 transition-all';
    item.style = estCoche ? ('border-left: 5px solid ' + couleurBordure + '; background: ' + fond) : 'border-left: 5px solid transparent';

    const cbA = verrouille
      ? '<input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' disabled class="checkbox-locked">'
      : '<input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;absence&quot;, this.checked)" class="checkbox-material">';
    const cbR = verrouille
      ? '<input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' disabled class="checkbox-locked">'
      : '<input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;retard&quot;, this.checked)" class="checkbox-material">';

    let raison = '';
    if (parAutre) raison = 'déjà signalé · ' + (quiAutre[id] || 'un autre enseignant');
    else if (precedent) raison = raisonPrecedent[id] || 'non justifié';

    const styleChip = estCoche ? ('background: ' + couleur + '; color: #fff;') : (enSombre ? 'background: #334155; color: #bfdbfe;' : 'background: #dbeafe; color: #1e3a8a;');
    const styleNom = estCoche ? ('color: ' + couleur + '; font-weight: 600;') : ((document.body.classList.contains('theme-sombre') ? '#e2e8f0' : '#1f2937'));

    item.innerHTML = `
      <span class="inline-flex items-center justify-center rounded-full text-xs font-bold" style="width: 28px; height: 28px; flex-shrink: 0; margin-right: 10px; ${styleChip}">${numero}</span>
      <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${styleNom}">${libelleEleve(eleve)}${verrouille ? ' <i class="fas fa-lock lock-icon"></i>' : ''}${raison ? ' <span class="text-xs text-gray-400">(' + raison + ')</span>' : ''}</span>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbA}<span class="text-xs font-bold ml-1">A</span></label>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbR}<span class="text-xs font-bold ml-1">R</span></label>
    `;
    div.appendChild(item);
  });
}
function afficher(msg) {
  const rows = (conteneur.enfants || []);
  console.log('== ' + msg + ' : ' + rows.length + ' lignes');
  rows.forEach((r, i) => {
    const nom = (r.innerHTML.match(/>(El Amrani Ahmed|Benali Fatima)</) || [''])[0];
    const couleurNom = (r.innerHTML.match(/style="flex: 1;[^"]*color: (#[0-9a-f]{6})/) || [])[1];
    const bordure = (r.style.match(/border-left: 5px solid (#[0-9a-f]{6}|transparent)/) || [])[1];
    console.log('   ligne' + (i+1), (nom||'?'), '| nom:', couleurNom, '| bordure:', bordure, '| fond:', (r.style.match(/background: ([^;]+)/)||[])[1]);
  });
}
conteneur.enfants = [];
afficherListeEleves();
afficher('THEME CLAIR');
// thème sombre
document.body.classList._c = ['theme-sombre'];
conteneur.enfants = [];
afficherListeEleves();
afficher('THEME SOMBRE');
