# -*- coding: utf-8 -*-
# patch_v4r.py -> v3.56  (bloc A avant la base de donnees)
# 1. Etablissement (code unique, academie, direction) + annee scolaire 2026-2027 et semestres S1/S2
# 2. Annulation de seance par le directeur et le surveillant (+ effet sur le Dashboard enseignant et les stats)
# 3. Le directeur peut corriger le nom d'un professeur (mis a jour partout)
import io, sys

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-52s occurrences=%d (attendu %d) %s' % (nom or old[:46], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok: sys.exit(1)
    s = s.replace(old, new)

# ══════════════════════════════════════════════════════════════════
# 1. JS : parametres, annulation de seance, noms des profs
# ══════════════════════════════════════════════════════════════════
rep("""  { email: "d@taalim.ma",  password: "12345", role: "directeur",   nom: "Directeur" }
];
""",
"""  { email: "d@taalim.ma",  password: "12345", role: "directeur",   nom: "Directeur" }
];

// ========== ETABLISSEMENT & ANNEE SCOLAIRE ==========
const ETABLISSEMENT_DEFAUT = { code: '', nom: '', academie: '', direction: '' };
const ANNEE_SCOLAIRE_DEFAUT = {
  libelle: '2026-2027',
  semestres: [
    { nom: 'S1', debut: '2026-09-01', fin: '2027-01-15' },
    { nom: 'S2', debut: '2027-02-01', fin: '2027-05-15' }
  ]
};
function chargerParametres(cle, defaut) {
  const base = JSON.parse(JSON.stringify(defaut));
  try {
    const brut = localStorage.getItem(cle);
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
function sauvegarderParametres() {
  localStorage.setItem('etablissement', JSON.stringify(etablissement));
  localStorage.setItem('anneeScolaire', JSON.stringify(anneeScolaire));
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
  const recap = document.getElementById('etab-recap');
  if (recap) recap.textContent = libelleEtablissement() + ' — ' + libelleAnneeScolaire();
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
  set('etab-academie', etablissement.academie);
  set('etab-direction', etablissement.direction);
  set('annee-libelle', anneeScolaire.libelle);
  anneeScolaire.semestres.forEach((sem, i) => {
    set('sem' + (i + 1) + '-nom', sem.nom);
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
      { nom: val('sem1-nom') || 'S1', debut: val('sem1-debut'), fin: val('sem1-fin') },
      { nom: val('sem2-nom') || 'S2', debut: val('sem2-debut'), fin: val('sem2-fin') }
    ]
  };
  sauvegarderParametres();
  afficherParametres();
  afficherToast('Paramètres enregistrés', 'success');
}

// ========== NOMS DES PROFESSEURS (corrigeables par le directeur) ==========
function chargerNomsProfs() {
  try {
    const brut = localStorage.getItem('nomsProfs');
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
let nomsProfs = chargerNomsProfs();
function sauvegarderNomsProfs() { localStorage.setItem('nomsProfs', JSON.stringify(nomsProfs)); }
function appliquerNomsProfs() {
  comptes.forEach(c => { if (c.code && nomsProfs[c.code]) c.nom = nomsProfs[c.code]; });
}

// ========== ANNULATION DE SEANCE (directeur + surveillant) ==========
function chargerSeancesAnnulees() {
  try {
    const brut = localStorage.getItem('seancesAnnulees');
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) { return []; }
}
let seancesAnnulees = chargerSeancesAnnulees();
function sauvegarderSeancesAnnulees() { localStorage.setItem('seancesAnnulees', JSON.stringify(seancesAnnulees)); }
function estRoleVieScolaire() {
  return !!utilisateurConnecte && (utilisateurConnecte.role === 'directeur' || utilisateurConnecte.role === 'surveillant');
}
function nomApprobateur() {
  if (!utilisateurConnecte) return '';
  return utilisateurConnecte.role === 'directeur' ? 'Directeur' : (utilisateurConnecte.nom || 'Surveillant');
}
// Seance annulee qui couvre une heure donnee (meme date + meme classe)
function seanceAnnulee(dateISO, classe, heure) {
  const m = hhmmEnMinutes(heure);
  return seancesAnnulees.find(s => s.dateISO === dateISO && s.classe === classe &&
    m >= hhmmEnMinutes(s.debut) && m < hhmmEnMinutes(s.fin || s.debut)) || null;
}
// Une absence prise pendant une seance annulee ne compte pas
function absenceEnSeanceAnnulee(a) {
  return !!a && !!seanceAnnulee(a.dateISO, a.classe, a.heure);
}
// Creneaux reels d'une classe pour un jour (deduits des tableaux de service)
function creneauxClasseJour(classe, jour) {
  const par = {};
  Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
    if (c.classe !== classe || c.jour !== jour) return;
    if (!par[c.debut]) par[c.debut] = { debut: c.debut, fin: c.fin, matiere: c.matiere, prof: c.prof };
  }));
  const liste = Object.keys(par).map(k => par[k]).sort((a, b) => hhmmEnMinutes(a.debut) - hhmmEnMinutes(b.debut));
  if (liste.length) return liste;
  const std = [];
  for (let h = 8; h < 12; h++) std.push({ debut: String(h).padStart(2, '0') + ':00', fin: String(h + 1).padStart(2, '0') + ':00', matiere: '', prof: '' });
  for (let h = 14; h < 18; h++) std.push({ debut: String(h).padStart(2, '0') + ':00', fin: String(h + 1).padStart(2, '0') + ':00', matiere: '', prof: '' });
  return std;
}
function heureMaintenant() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function ouvrirModalAnnulation() {
  if (!estRoleVieScolaire()) return;
  const dateEl = document.getElementById('annul-date');
  if (dateEl && !dateEl.value) dateEl.value = fmtDateISO(new Date());
  const selClasse = document.getElementById('annul-classe');
  if (selClasse) {
    const courant = selClasse.value;
    selClasse.innerHTML = '';
    classes.forEach(cl => {
      const o = document.createElement('option');
      o.value = cl.nom;
      o.textContent = cl.nom;
      selClasse.appendChild(o);
    });
    if (courant && classes.some(c => c.nom === courant)) selClasse.value = courant;
  }
  majCreneauxAnnulation();
  document.getElementById('modal-annulation').classList.remove('hidden');
}
function fermerModalAnnulation() { document.getElementById('modal-annulation').classList.add('hidden'); }
function majCreneauxAnnulation() {
  const dateEl = document.getElementById('annul-date');
  const selClasse = document.getElementById('annul-classe');
  const selCr = document.getElementById('annul-creneau');
  const dateISO = (dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date());
  if (selCr && selClasse) {
    const jour = new Date(dateISO + 'T12:00:00').getDay();
    selCr.innerHTML = '';
    creneauxClasseJour(selClasse.value, jour).forEach(c => {
      const o = document.createElement('option');
      o.value = c.debut + '|' + c.fin;
      o.textContent = c.debut + '–' + c.fin + (c.matiere ? ' · ' + c.matiere : '');
      selCr.appendChild(o);
    });
  }
  afficherAnnulationsDuJour(dateISO);
}
function afficherAnnulationsDuJour(dateISO) {
  const cont = document.getElementById('annul-liste');
  if (!cont) return;
  const liste = seancesAnnulees.filter(s => s.dateISO === dateISO)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune séance annulée ce jour.</p>';
    return;
  }
  cont.innerHTML = '';
  liste.forEach(sn => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg';
    item.innerHTML = '<div><p class="font-medium text-gray-700">' + sn.classe + ' · ' + sn.debut + '–' + sn.fin + '</p>' +
      '<p class="text-xs text-gray-500">' + (sn.motif || '') + (sn.par ? ' · par ' + sn.par : '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.textContent = 'Rétablir';
    b.onclick = () => retablirSeance(sn.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
}
function confirmerAnnulationSeance() {
  if (!estRoleVieScolaire()) return;
  const dateEl = document.getElementById('annul-date');
  const classe = (document.getElementById('annul-classe') || {}).value || '';
  const parties = String((document.getElementById('annul-creneau') || {}).value || '').split('|');
  const motif = (document.getElementById('annul-motif') || {}).value || 'Séance non assurée';
  const dateISO = (dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date());
  if (!classe || !parties[0]) { afficherToast('Choisissez une classe et une séance', 'error'); return; }
  if (seancesAnnulees.some(sn => sn.dateISO === dateISO && sn.classe === classe && sn.debut === parties[0])) {
    afficherToast('Séance déjà annulée', 'error');
    return;
  }
  seancesAnnulees.push({
    id: Date.now() + Math.random(), dateISO: dateISO, classe: classe,
    debut: parties[0], fin: parties[1] || '', motif: motif, par: nomApprobateur(),
    le: dateISO + ' ' + heureMaintenant()
  });
  sauvegarderSeancesAnnulees();
  afficherAnnulationsDuJour(dateISO);
  afficherToast('Séance annulée', 'success');
  rafraichirApresAnnulation();
}
function retablirSeance(id) {
  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);
  sauvegarderSeancesAnnulees();
  const dateEl = document.getElementById('annul-date');
  afficherAnnulationsDuJour((dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date()));
  afficherToast('Séance rétablie', 'success');
  rafraichirApresAnnulation();
}
function rafraichirApresAnnulation() {
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') appliquerTableauService();
  if (typeof mettreAJourDashboardSurv === 'function') mettreAJourDashboardSurv();
  if (typeof mettreAJourDashboardDir === 'function') mettreAJourDashboardDir();
}

// ========== PROFESSEURS (liste + renommage, directeur) ==========
let profARenommer = null;
function afficherListeProfs() {
  const cont = document.getElementById('dir-profs-list');
  if (!cont) return;
  cont.innerHTML = '';
  comptes.filter(c => c.role === 'enseignant').forEach(c => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg';
    item.innerHTML = '<div><p class="font-medium text-gray-700">' + (c.nom || '') + '</p>' +
      '<p class="text-xs text-gray-500">' + (c.matiere || '') + ' · ' + (c.code || '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.innerHTML = '<i class="fas fa-pen mr-1"></i>Modifier';
    b.onclick = () => ouvrirRenommageProf(c.code);
    item.appendChild(b);
    cont.appendChild(item);
  });
}
function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code);
  if (!c) return;
  profARenommer = code;
  const champ = document.getElementById('renommer-nom');
  if (champ) champ.value = c.nom || '';
  const info = document.getElementById('renommer-info');
  if (info) info.textContent = (c.matiere || '') + ' · ' + code;
  document.getElementById('modal-renommer').classList.remove('hidden');
}
function fermerRenommageProf() {
  profARenommer = null;
  document.getElementById('modal-renommer').classList.add('hidden');
}
function confirmerRenommageProf() {
  const code = profARenommer;
  if (!code) return;
  const champ = document.getElementById('renommer-nom');
  const nouveau = champ ? String(champ.value || '').replace(/\\s+/g, ' ').trim() : '';
  if (nouveau.length < 3) { afficherToast('Nom trop court (3 caractères minimum)', 'error'); return; }
  const prof = comptes.find(c => c.code === code);
  const ancien = prof ? prof.nom : '';
  nomsProfs[code] = nouveau;
  sauvegarderNomsProfs();
  if (prof) prof.nom = nouveau;
  let maj = 0;
  absences.forEach(a => {
    if (a.profCode === code || (ancien && a.enseignant === ancien)) { a.enseignant = nouveau; maj++; }
  });
  if (maj > 0) localStorage.setItem('absences', JSON.stringify(absences));
  fermerRenommageProf();
  afficherListeProfs();
  afficherToast('Enseignant renommé' + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'success');
}
""",
    1, 'JS : parametres + annulation + profs')

# ══════════════════════════════════════════════════════════════════
# 2. Filtres de periode : options semestres + bornes
# ══════════════════════════════════════════════════════════════════
rep("""              <option value="trimestre">Ce trimestre</option>""",
"""              <option value="trimestre">Ce trimestre</option>
              <option value="s1">Semestre 1</option>
              <option value="s2">Semestre 2</option>
              <option value="annee">Année scolaire</option>""",
    2, 'filtres : options semestres (2 selects)')

rep("""  } else if (valeur === 'perso') {""",
"""  } else if (valeur === 's1' || valeur === 's2' || valeur === 'annee') {
    const i = valeur === 's2' ? 1 : 0;
    const d = (valeur === 'annee') ? anneeScolaire.semestres[0] : anneeScolaire.semestres[i];
    const f = (valeur === 'annee') ? anneeScolaire.semestres[1] : anneeScolaire.semestres[i];
    if (d && d.debut) debut = new Date(d.debut + 'T00:00:00');
    if (f && f.fin) fin = new Date(f.fin + 'T00:00:00');
  } else if (valeur === 'perso') {""",
    1, 'bornesPeriode : semestres + annee')

# ══════════════════════════════════════════════════════════════════
# 3. Stats : une absence en seance annulee ne compte pas
# ══════════════════════════════════════════════════════════════════
rep("""    if (statsType !== 'tous' && (a.type || 'absence') !== statsType) return false;
    if (a.enseignant !== moi) return false;""",
"""    if (statsType !== 'tous' && (a.type || 'absence') !== statsType) return false;
    if (absenceEnSeanceAnnulee(a)) return false;   // seance annulee : ne compte pas
    if (a.enseignant !== moi) return false;""",
    1, 'stats enseignant : exclusion')

rep("""    if (dirStatsType !== 'tous' && (a.type || 'absence') !== dirStatsType) return false;
    return true;""",
"""    if (dirStatsType !== 'tous' && (a.type || 'absence') !== dirStatsType) return false;
    if (absenceEnSeanceAnnulee(a)) return false;   // seance annulee : ne compte pas
    return true;""",
    1, 'stats directeur : exclusion')

# ══════════════════════════════════════════════════════════════════
# 4. CSS : bouton outline danger
# ══════════════════════════════════════════════════════════════════
rep("""    .checkbox-locked {""",
"""    .btn-outline-danger { width: 100%; margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; border: 2px solid #dc2626; background: transparent; color: #dc2626; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: background 0.2s ease; }
    .btn-outline-danger:hover { background: rgba(220, 38, 38, 0.08); }
    body.theme-sombre .btn-outline-danger { border-color: #f87171; color: #fca5a5; }
    .checkbox-locked {""",
    1, 'CSS : btn-outline-danger')

# ══════════════════════════════════════════════════════════════════
# 5. Ecran de connexion : etablissement + annee / semestre
# ══════════════════════════════════════════════════════════════════
rep("""      <p class="text-center text-blue-200 text-xs mt-8">AbsenceTrack""",
"""      <p class="text-center text-blue-100 text-xs mt-6" id="login-annee"></p>

      <p class="text-center text-blue-200 text-xs mt-8">AbsenceTrack""",
    1, 'login : etiquette etablissement/annee')

# ══════════════════════════════════════════════════════════════════
# 6. Dashboards surveillant + directeur : bouton "Annuler une seance"
# ══════════════════════════════════════════════════════════════════
rep("""      <div id="surv-absences-list"></div>""",
"""      <button type="button" class="btn-outline-danger" onclick="ouvrirModalAnnulation()"><i class="fas fa-ban"></i> Annuler une séance</button>
      <div id="surv-absences-list"></div>""",
    1, 'dashboard surveillant : bouton')

rep("""      <div id="dir-absences-list"></div>""",
"""      <button type="button" class="btn-outline-danger" onclick="ouvrirModalAnnulation()"><i class="fas fa-ban"></i> Annuler une séance</button>
      <div id="dir-absences-list"></div>""",
    1, 'dashboard directeur : bouton')

# ══════════════════════════════════════════════════════════════════
# 7. Dashboard enseignant : bloc "Seance annulee"
# ══════════════════════════════════════════════════════════════════
rep("""      <div id="zone-prise-absence" class="hidden">""",
"""      <div id="ens-annulee" class="hidden">
        <div class="stat-card mb-4" style="text-align: center;">
          <i class="fas fa-ban" style="font-size: 30px; color: #ef4444;"></i>
          <p class="font-bold text-gray-800 mt-2">Séance annulée</p>
          <p class="text-sm text-gray-500 mt-1" id="ens-annulee-detail"></p>
        </div>
      </div>
      <div id="zone-prise-absence" class="hidden">""",
    1, 'dashboard enseignant : bloc annulee')

rep("""  const enCours = creneauxEnCours(emailUtilisateur());
  select.disabled = true;   // bloque pour le moment (la div de selection est conservee)
""",
"""  const enCours = creneauxEnCours(emailUtilisateur());
  select.disabled = true;   // bloque pour le moment (la div de selection est conservee)
  const blocAnnulee = document.getElementById('ens-annulee');
  if (blocAnnulee) blocAnnulee.classList.add('hidden');

  // Seance annulee par la vie scolaire : aucune saisie possible
  const annulee = enCours.length > 0 ? seanceAnnulee(fmtDateISO(new Date()), enCours[0].classe, enCours[0].debut) : null;
  if (annulee) {
    if (repos) repos.classList.add('hidden');
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    if (zone) zone.classList.add('hidden');
    select.innerHTML = '<option value="">— Séance annulée —</option>';
    select.value = '';
    const listeAnnulee = document.getElementById('liste-eleves-enseignant');
    if (listeAnnulee) listeAnnulee.innerHTML = '';
    if (typeof mettreAJourEnteteListe === 'function') mettreAJourEnteteListe();
    if (blocAnnulee) {
      blocAnnulee.classList.remove('hidden');
      const det = document.getElementById('ens-annulee-detail');
      if (det) det.textContent = annulee.classe + ' · ' + annulee.debut + '–' + annulee.fin +
        (annulee.motif ? ' — ' + annulee.motif : '') + (annulee.par ? ' (par ' + annulee.par + ')' : '');
    }
    return;
  }
""",
    1, 'appliquerTableauService : cas seance annulee')

# ══════════════════════════════════════════════════════════════════
# 8. Page Gestion (directeur) : carte etablissement + carte professeurs
# ══════════════════════════════════════════════════════════════════
rep("""      <!-- Importer fichier MASSAR -->""",
"""      <!-- Etablissement & annee scolaire -->
      <div class="stat-card mb-4">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-school text-blue-900 mr-2"></i>Établissement & année scolaire</h3>
        <p class="text-sm text-gray-500 mb-3" id="etab-recap"></p>
        <div class="form-group">
          <label>Code établissement (unique)</label>
          <input type="text" id="etab-code" placeholder="ex. 24A1234">
        </div>
        <div class="form-group">
          <label>Nom de l'établissement</label>
          <input type="text" id="etab-nom" placeholder="ex. الثانوية القصبية الإعدادية – بوعوان">
        </div>
        <div class="form-group">
          <label>Académie</label>
          <input type="text" id="etab-academie" placeholder="ex. Académie régionale de Casablanca-Settat">
        </div>
        <div class="form-group">
          <label>Direction provinciale</label>
          <input type="text" id="etab-direction" placeholder="ex. Direction provinciale de Settat">
        </div>
        <hr class="my-4 border-gray-200">
        <div class="form-group">
          <label>Année scolaire</label>
          <input type="text" id="annee-libelle" placeholder="2026-2027">
        </div>
        <p class="text-sm font-bold text-gray-700 mb-2">Semestre 1</p>
        <div class="form-group"><label>Libellé</label><input type="text" id="sem1-nom" placeholder="S1"></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="form-group"><label>Début</label><input type="date" id="sem1-debut"></div>
          <div class="form-group"><label>Fin</label><input type="date" id="sem1-fin"></div>
        </div>
        <p class="text-sm font-bold text-gray-700 mb-2">Semestre 2</p>
        <div class="form-group"><label>Libellé</label><input type="text" id="sem2-nom" placeholder="S2"></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="form-group"><label>Début</label><input type="date" id="sem2-debut"></div>
          <div class="form-group"><label>Fin</label><input type="date" id="sem2-fin"></div>
        </div>
        <button onclick="enregistrerParametres()" class="btn-primary w-full btn-ripple"><i class="fas fa-save"></i> Enregistrer</button>
      </div>

      <!-- Importer fichier MASSAR -->""",
    1, 'gestion : carte etablissement')

rep("""      <!-- Liste des classes -->""",
"""      <!-- Professeurs -->
      <div class="stat-card mb-4">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-chalkboard-teacher text-blue-900 mr-2"></i>Professeurs</h3>
        <p class="text-sm text-gray-500 mb-3">Corriger le nom d'un enseignant : il est mis à jour partout, y compris dans l'historique des signalements.</p>
        <div id="dir-profs-list" class="space-y-2"></div>
      </div>

      <!-- Liste des classes -->""",
    1, 'gestion : carte professeurs')

# ══════════════════════════════════════════════════════════════════
# 9. Modales : annulation de seance + renommage du prof
# ══════════════════════════════════════════════════════════════════
rep("""<!-- TOAST -->""",
"""<!-- MODAL ANNULATION DE SEANCE                      -->
<div id="modal-annulation" class="hidden fixed inset-0 modal-overlay flex items-center justify-center p-4" style="z-index: 300;">
  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl" style="max-height: 90vh; display: flex; flex-direction: column;">
    <div class="flex items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <span style="width: 28px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center">Annuler une séance</h2>
      <button onclick="fermerModalAnnulation()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" style="width: 28px; flex-shrink: 0; text-align: right;">&times;</button>
    </div>
    <div style="flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0;">
      <div class="px-4 pb-3">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="annul-date" onchange="majCreneauxAnnulation()">
        </div>
        <div class="form-group">
          <label>Classe</label>
          <select id="annul-classe" class="w-full" onchange="majCreneauxAnnulation()"></select>
        </div>
        <div class="form-group">
          <label>Séance</label>
          <select id="annul-creneau" class="w-full"></select>
        </div>
        <div class="form-group">
          <label>Motif</label>
          <select id="annul-motif" class="w-full">
            <option value="Absence du professeur">Absence du professeur</option>
            <option value="Séance non assurée">Séance non assurée</option>
            <option value="Examen">Examen</option>
            <option value="Réunion">Réunion</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <button onclick="confirmerAnnulationSeance()" class="btn-danger w-full mb-4"><i class="fas fa-ban"></i> Annuler cette séance</button>
        <div class="stat-label mb-2">Séances annulées ce jour</div>
        <div id="annul-liste" class="space-y-2"></div>
      </div>
    </div>
  </div>
</div>

<!-- MODAL RENOMMER UN PROFESSEUR                    -->
<div id="modal-renommer" class="hidden fixed inset-0 modal-overlay flex items-center justify-center p-4" style="z-index: 300;">
  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl">
    <div class="flex items-center px-5 pt-4 pb-2">
      <span style="width: 28px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center">Nom de l'enseignant</h2>
      <button onclick="fermerRenommageProf()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" style="width: 28px; flex-shrink: 0; text-align: right;">&times;</button>
    </div>
    <div class="px-4 pb-5">
      <p class="text-sm text-gray-500 mb-3 text-center" id="renommer-info"></p>
      <div class="form-group">
        <label>Nom complet</label>
        <input type="text" id="renommer-nom" placeholder="Nom et prénom">
      </div>
      <div class="flex gap-3">
        <button onclick="fermerRenommageProf()" class="btn-fermer flex-1">Annuler</button>
        <button onclick="confirmerRenommageProf()" class="btn-primary flex-1"><i class="fas fa-save"></i> Enregistrer</button>
      </div>
    </div>
  </div>
</div>

<!-- TOAST -->""",
    1, 'modales : annulation + renommage')

# ══════════════════════════════════════════════════════════════════
# 10. Hooks : afficherGestionDir + init
# ══════════════════════════════════════════════════════════════════
rep("""function afficherGestionDir() {""",
"""function afficherGestionDir() {
  afficherParametres();
  afficherListeProfs();""",
    1, 'afficherGestionDir : parametres + profs')

rep("""function init() {
  genererDonneesTestHistorique();""",
"""function init() {
  appliquerNomsProfs();
  majEtiquetteAnnee();
  majOptionsSemestres();
  genererDonneesTestHistorique();""",
    1, 'init : noms profs + etiquettes + options')

# ══════════════════════════════════════════════════════════════════
# 11. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.55', 'AbsenceTrack v3.56', 1, 'label v3.56')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
