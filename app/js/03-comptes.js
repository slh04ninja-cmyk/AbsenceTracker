// fichier: app/js/03-comptes.js
// ========== COMPTES UTILISATEURS ==========
// Professeurs reels (tableau des professeurs du PDF) : code = {matiere}-prof{x}
const comptes = [
  { email: "math-prof1@taalim.ma",  password: "12345", role: "enseignant", code: "math-prof1",  matiere: "Maths",           nom: "أيوب الكمرة" },
  { email: "pc-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "pc-prof1",    matiere: "PC",              nom: "غزالي صالح" },
  { email: "svt-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "svt-prof1",   matiere: "SVT",             nom: "كمال الوردي" },
  { email: "fr-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "fr-prof1",    matiere: "Français",        nom: "سامية الحاضي" },
  { email: "ang-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "ang-prof1",   matiere: "Anglais",         nom: "هشام أجامي" },
  { email: "ar-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "ar-prof1",    matiere: "Arabe",           nom: "المهدي الصلحي" },
  { email: "eps-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "eps-prof1",   matiere: "EPS",             nom: "يسرى البوسعيدي" },
  { email: "info-prof1@taalim.ma",  password: "12345", role: "enseignant", code: "info-prof1",  matiere: "Informatique",    nom: "سكينة الرازي" },
  { email: "philo-prof1@taalim.ma", password: "12345", role: "enseignant", code: "philo-prof1", matiere: "Philo",           nom: "زكية المندريلي" },
  { email: "ei-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "ei-prof1",    matiere: "Educ. islamique", nom: "محمد خليفي" },
  { email: "hg-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "hg-prof1",    matiere: "Hist-Géo",        nom: "ياسين القامة" },
  { email: "s1@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant 1" },
  { email: "s2@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant 2" },
  { email: "d@taalim.ma",  password: "12345", role: "directeur",   nom: "Directeur" }
];

// ========== ETABLISSEMENT & ANNEE SCOLAIRE ==========
const ETABLISSEMENT_DEFAUT = { code: '', nom: '', academie: '', direction: '' };
const ANNEE_SCOLAIRE_DEFAUT = {
  libelle: '2026-2027',
  semestres: [
    { nom: '1', debut: '2026-09-01', fin: '2027-01-15' },
    { nom: '2', debut: '2027-02-01', fin: '2027-05-15' }
  ]
};
// ========== ACADEMIES REGIONALES & DIRECTIONS PROVINCIALES ==========
const ACADEMIES = [
  { nom: 'Tanger-Tétouan-Al Hoceïma', directions: ['Tanger-Assilah', "M'diq-Fnideq", 'Tétouan', 'Fahs-Anjra', 'Larache', 'Chefchaouen', 'Ouazzane', 'Al Hoceïma'] },
  { nom: "L'Oriental", directions: ['Oujda-Angad', 'Nador', 'Berkane', 'Taourirt', 'Jerada', 'Driouch', 'Guercif', 'Figuig'] },
  { nom: 'Fès-Meknès', directions: ['Fès', 'Meknès', 'El Hajeb', 'Ifrane', 'Moulay Yacoub', 'Sefrou', 'Boulemane', 'Taounate', 'Taza'] },
  { nom: 'Rabat-Salé-Kénitra', directions: ['Rabat', 'Salé', 'Skhirate-Témara', 'Kénitra', 'Khémisset', 'Sidi Kacem', 'Sidi Slimane'] },
  { nom: 'Béni Mellal-Khénifra', directions: ['Béni Mellal', 'Azilal', 'Fquih Ben Salah', 'Khénifra', 'Khouribga'] },
  { nom: 'Grand Casablanca-Settat', directions: ['Casablanca-Anfa', 'Al Fida-Mers Sultan', 'Aïn Sebaâ-Hay Mohammadi', 'Hay Hassani', 'Aïn Chock', 'Sidi Bernoussi', "Ben M'sick", 'Moulay Rachid', 'Mohammedia', 'Nouaceur', 'Médiouna', 'Settat', 'Berrechid', 'El Jadida', 'Sidi Bennour'] },
  { nom: 'Marrakech-Safi', directions: ['Marrakech', 'Chichaoua', 'Al Haouz', 'El Kelâa des Sraghna', 'Essaouira', 'Rehamna', 'Safi', 'Youssoufia'] },
  { nom: 'Drâa-Tafilalet', directions: ['Errachidia', 'Ouarzazate', 'Midelt', 'Tinghir', 'Zagora'] },
  { nom: 'Souss-Massa', directions: ['Agadir-Ida Ou Tanane', 'Inezgane-Aït Melloul', 'Chtouka-Aït Baha', 'Taroudannt', 'Tiznit', 'Tata'] },
  { nom: 'Guelmim-Oued Noun', directions: ['Guelmim', 'Assa-Zag', 'Tan-Tan', 'Sidi Ifni'] },
  { nom: 'Laâyoune-Sakia El Hamra', directions: ['Laâyoune', 'Boujdour', 'Tarfaya', 'Es-Semara'] },
  { nom: 'Dakhla-Oued Ed-Dahab', directions: ['Oued Ed-Dahab', 'Aousserd'] }
];
const ANNEES_SCOLAIRES = ['2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029'];
function directionsAcademie(nom) {
  const a = ACADEMIES.find(x => x.nom === String(nom || ''));
  return a ? a.directions.slice() : [];
}
function remplirOptionSelect(select, valeurs, valeurCourante, placeholder) {
  if (!select) return;
  select.innerHTML = '';
  if (placeholder) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    select.appendChild(o);
  }
  valeurs.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
  if (valeurCourante && valeurs.indexOf(valeurCourante) >= 0) select.value = valeurCourante;
}
// La direction provinciale depend de l'academie choisie
function changerAcademie() {
  const selAca = document.getElementById('etab-academie');
  const selDir = document.getElementById('etab-direction');
  if (!selAca || !selDir) return;
  const dirs = directionsAcademie(selAca.value);
  const ancienne = selDir.value;
  remplirOptionSelect(selDir, dirs, dirs.indexOf(ancienne) >= 0 ? ancienne : '', dirs.length === 0 ? '— Choisir une académie —' : '');
}

function chargerParametres(cle, defaut) {
  const base = JSON.parse(JSON.stringify(defaut));
  try {
    const brut = Depot.lire(cle, null);
    if (!brut) return base;
    const obj = JSON.parse(brut);
    return Object.assign(base, (obj && typeof obj === 'object') ? obj : {});
  } catch (e) { return base; }
}
let etablissement = chargerParametres('etablissement', ETABLISSEMENT_DEFAUT);
let anneeScolaire = chargerParametres('anneeScolaire', ANNEE_SCOLAIRE_DEFAUT);
if (!Array.isArray(anneeScolaire.semestres) || anneeScolaire.semestres.length < 2) {
  anneeScolaire.semestres = JSON.parse(JSON.stringify(ANNEE_SCOLAIRE_DEFAUT.semestres));
}
// Les libelles ne sont plus saisis : "S1"/"S2" (anciens enregistrements) -> "1"/"2"
anneeScolaire.semestres.forEach((sem, i) => {
  const n = String(sem.nom || '').replace(/^s(?:emestre)?\s*/i, '').trim();
  sem.nom = (n === '1' || n === '2') ? n : String(i + 1);
});
function sauvegarderParametres() {
  Depot.ecrireJSON('etablissement', etablissement);
  Depot.ecrireJSON('anneeScolaire', anneeScolaire);
  serveurEnvoiArrierePlan();
}
// Semestre auquel appartient une date (ou null hors semestres)
function semestreDeDate(dateISO) {
  const d = String(dateISO || '');
  if (d.length < 10) return null;
  return anneeScolaire.semestres.find(s => s.debut && s.fin && d >= s.debut && d <= s.fin) || null;
}
function semestreCourant() { return semestreDeDate(fmtDateISO(new Date())); }
function libelleEtablissement() {
  const e = etablissement || {};
  return e.nom || e.code || 'Établissement';
}
function libelleAnneeScolaire() {
  const s = semestreCourant();
  return 'Année ' + (anneeScolaire.libelle || '—') + (s ? ' · Semestre ' + s.nom : '');
}
function majEtiquetteAnnee() {
  const elLogin = document.getElementById('login-annee');
  if (elLogin) elLogin.textContent = libelleEtablissement() + ' — ' + libelleAnneeScolaire();
}
// Etiquettes des options Semestre 1 / 2 / annee dans les filtres de periode
function majOptionsSemestres() {
  const remplir = sel => {
    if (!sel) return;
    anneeScolaire.semestres.forEach((sem, i) => {
      const opt = sel.querySelector('option[value="s' + (i + 1) + '"]');
      if (opt) opt.textContent = 'Semestre ' + (sem.nom || (i + 1)) + ' (' + dateAffichage(sem.debut) + ' → ' + dateAffichage(sem.fin) + ')';
    });
    const optAn = sel.querySelector('option[value="annee"]');
    if (optAn) optAn.textContent = 'Année scolaire ' + (anneeScolaire.libelle || '');
  };
  remplir(document.getElementById('stats-periode'));
  remplir(document.getElementById('dir-stats-periode'));
}
function afficherParametres() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('etab-code', etablissement.code);
  set('etab-nom', etablissement.nom);
  // Academies (liste) puis directions de l'academie choisie (liste dependante)
  remplirOptionSelect(document.getElementById('etab-academie'), ACADEMIES.map(a => a.nom), etablissement.academie, '— Choisir —');
  changerAcademie();
  const selDir = document.getElementById('etab-direction');
  if (selDir && etablissement.direction && directionsAcademie(etablissement.academie).indexOf(etablissement.direction) >= 0) {
    selDir.value = etablissement.direction;
  }
  // Annee scolaire (liste) : on garde toujours la valeur enregistree dans la liste
  const annees = ANNEES_SCOLAIRES.slice();
  if (anneeScolaire.libelle && annees.indexOf(anneeScolaire.libelle) < 0) annees.push(anneeScolaire.libelle);
  remplirOptionSelect(document.getElementById('annee-libelle'), annees, anneeScolaire.libelle, '');
  anneeScolaire.semestres.forEach((sem, i) => {
    set('sem' + (i + 1) + '-debut', sem.debut);
    set('sem' + (i + 1) + '-fin', sem.fin);
  });
  majEtiquetteAnnee();
  majOptionsSemestres();
}
function enregistrerParametres() {
  const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  etablissement = { code: val('etab-code'), nom: val('etab-nom'), academie: val('etab-academie'), direction: val('etab-direction') };
  anneeScolaire = {
    libelle: val('annee-libelle') || ANNEE_SCOLAIRE_DEFAUT.libelle,
    semestres: [
      { nom: (anneeScolaire.semestres[0] || {}).nom || '1', debut: val('sem1-debut'), fin: val('sem1-fin') },
      { nom: (anneeScolaire.semestres[1] || {}).nom || '2', debut: val('sem2-debut'), fin: val('sem2-fin') }
    ]
  };
  sauvegarderParametres();
  afficherParametres();
  afficherToast('Paramètres enregistrés', 'modif');
}

