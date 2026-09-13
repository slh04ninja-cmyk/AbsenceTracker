# -*- coding: utf-8 -*-
"""v2 -> v1.7 : theme en haut + lisibilite sombre + fonctionnalites metier."""
import re, io, os, shutil, subprocess

SRC = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
OUT = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'

data = io.open(SRC, encoding='utf-8').read()
results = []

def plain(label, old, new, n=1):
    global data
    c = data.count(old)
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = data.replace(old, new)
    return ok

def rx(label, pat, repl, n=1):
    global data
    c = len(re.findall(pat, data, re.DOTALL))
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = re.sub(pat, repl, data, flags=re.DOTALL)
    return ok

def rfn(label, name, body, args=r'\(.*?\)'):
    return rx(label, r'function ' + re.escape(name) + args + r' \{.*?\n\}', body)

# ============================================================
# A. AFFICHAGE : theme en haut, sans A+/A-
# ============================================================
rx('A1-supprimeReglages', r"\n<!-- REGLAGES D'AFFICHAGE -->.*?</div>\n", '\n')

plain('A2-btnLogin',
      '<div id="page-login" class="page-container active">',
      '''<div id="page-login" class="page-container active">
  <button onclick="basculerTheme()" title="Mode sombre" style="position: fixed; top: 16px; right: 16px; z-index: 60; width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; display: flex; align-items: center; justify-content: center; border: none;"><i class="icone-theme fas fa-moon text-xl"></i></button>''')

rx('A3-btnAppbar',
   r'    <button onclick="deconnexion\(\)" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition">\n      <i class="fas fa-sign-out-alt text-xl"></i>\n    </button>',
   '''    <div class="flex items-center gap-1">
      <button onclick="basculerTheme()" title="Mode sombre" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition">
        <i class="icone-theme fas fa-moon text-xl"></i>
      </button>
      <button onclick="deconnexion()" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition">
        <i class="fas fa-sign-out-alt text-xl"></i>
      </button>
    </div>''', 9)

# ============================================================
# B1. SEANCE / DATE / TYPE
# ============================================================
plain('B1-chips',
      '<button class="filter-chip" onclick="filterEleves(\'absents\', this)">Absents</button>',
      '<button class="filter-chip" onclick="filterEleves(\'absents\', this)">Signalés</button>')
plain('B2-labelCard',
      '<p class="text-red-100 text-xs font-medium uppercase tracking-wider">Absents</p>',
      '<p class="text-red-100 text-xs font-medium uppercase tracking-wider">Signalés</p>')

plain('B3-carteSaisie',
      '      <div id="zone-prise-absence" class="hidden">\n        <div id="toolbar-filtres" class="toolbar">',
      '''      <div id="zone-prise-absence" class="hidden">
        <div class="stat-card mb-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-blue-900 mb-1">Date</label>
              <input type="date" id="saisie-date" onchange="changerDateSaisie()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
            </div>
            <div>
              <label class="block text-xs font-bold text-blue-900 mb-1">Séance</label>
              <select id="saisie-seance" onchange="changerSeanceSaisie()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
                <option value="matin">Matin</option>
                <option value="apres-midi">Après-midi</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-blue-900 mb-1">Je signale</label>
              <select id="saisie-type" onchange="changerTypeSaisie()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
                <option value="absence">Absence</option>
                <option value="retard">Retard</option>
                <option value="exclusion">Exclusion de cours</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-blue-900 mb-1">Durée</label>
              <select id="saisie-duree" onchange="changerDureeSaisie()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium" disabled>
                <option value="">—</option>
                <option value="15 min">15 min</option>
                <option value="30 min">30 min</option>
                <option value="1 h">1 h</option>
                <option value="2 h">2 h</option>
                <option value="Séance">Séance complète</option>
              </select>
            </div>
          </div>
        </div>
        <div id="toolbar-filtres" class="toolbar">''')

plain('B4-globals',
      'let classeSelectionnee = null;',
      '''let classeSelectionnee = null;
let dateSelectionnee = null;
let seanceSelectionnee = 'matin';
let typeSaisie = 'absence';
let dureeSaisie = '';

// Seuil d'alerte : absences non justifiees dans le mois
const SEUIL_ALERTE_MOIS = 4;''')

plain('B5-choisirClasse',
      """  if (!classeSelectionnee) return;
  document.getElementById('ens-classe-name').textContent = classeSelectionnee.nom;
  if (zone) zone.classList.remove('hidden');
  afficherListeEleves();
  mettreAJourCompteur();
}""",
      """  if (!classeSelectionnee) return;
  document.getElementById('ens-classe-name').textContent = classeSelectionnee.nom;
  if (zone) zone.classList.remove('hidden');
  appliquerSaisieUI();
  afficherListeEleves();
  mettreAJourCompteur();
}""")

# helpers + saisie + theme (remplace l'ancien bloc reglages)
rx('B6-blocSaisie',
   r"// ========== REGLAGES D'AFFICHAGE.*?appliquerPolice\(\);",
   '''// ========== LIBELLES ==========
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

function libelleEleve(e) {
  if (!e) return '';
  return e.prenom ? (e.nom + ' ' + e.prenom) : e.nom;
}

function dateAffichage(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}

function seanceActuelle() {
  return new Date().getHours() < 12 ? 'matin' : 'apres-midi';
}

// ========== SAISIE : date / seance / type / duree ==========
function resetSaisie() {
  dateSelectionnee = fmtDateISO(new Date());
  seanceSelectionnee = seanceActuelle();
  typeSaisie = 'absence';
  dureeSaisie = '';
  appliquerSaisieUI();
}

function appliquerSaisieUI() {
  const d = document.getElementById('saisie-date');
  const s = document.getElementById('saisie-seance');
  const t = document.getElementById('saisie-type');
  const du = document.getElementById('saisie-duree');
  if (d) d.value = dateSelectionnee || fmtDateISO(new Date());
  if (s) s.value = seanceSelectionnee || 'matin';
  if (t) t.value = typeSaisie || 'absence';
  if (du) {
    du.value = dureeSaisie || '';
    du.disabled = (typeSaisie === 'absence');
  }
}

function rafraichirPrise() {
  afficherListeEleves();
  mettreAJourCompteur();
}

function changerDateSaisie() {
  const v = document.getElementById('saisie-date').value;
  dateSelectionnee = v || fmtDateISO(new Date());
  rafraichirPrise();
}

function changerSeanceSaisie() {
  seanceSelectionnee = document.getElementById('saisie-seance').value;
  rafraichirPrise();
}

function changerTypeSaisie() {
  typeSaisie = document.getElementById('saisie-type').value;
  if (typeSaisie === 'absence') dureeSaisie = '';
  appliquerSaisieUI();
}

function changerDureeSaisie() {
  dureeSaisie = document.getElementById('saisie-duree').value;
}

// ========== THEME SOMBRE ==========
function appliquerTheme() {
  const sombre = localStorage.getItem('prefTheme') === 'sombre';
  document.body.classList.toggle('theme-sombre', sombre);
  document.querySelectorAll('.icone-theme').forEach(function (ic) {
    ic.className = 'icone-theme fas text-xl ' + (sombre ? 'fa-sun' : 'fa-moon');
  });
}

function basculerTheme() {
  localStorage.setItem('prefTheme', localStorage.getItem('prefTheme') === 'sombre' ? 'clair' : 'sombre');
  appliquerTheme();
}

appliquerTheme();''')

plain('B7-resetLogin',
      "    choisirClasse('');\n    afficherInfosProf();",
      "    choisirClasse('');\n    afficherInfosProf();\n    resetSaisie();")
plain('B8-resetInit',
      "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); }",
      "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); resetSaisie(); }")
plain('B9-resetDeco',
      "  choisirClasse('');\n  afficherInfosProf();",
      "  choisirClasse('');\n  afficherInfosProf();\n  resetSaisie();")

# ---------- fonctions reecrites ----------
rfn('C1-listeEleves', 'afficherListeEleves', '''function afficherListeEleves() {
  const div = document.getElementById('liste-eleves-enseignant');
  div.innerHTML = '';
  if (!classeSelectionnee) return;
  const tousLesEleves = classeSelectionnee.eleves;
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const seance = seanceSelectionnee || 'matin';
  const moi = utilisateurConnecte.nom;
  const memeSeance = a => (a.seance || 'matin') === seance;

  const incidentsJour = absences.filter(a =>
    a.classe === classeSelectionnee.nom && a.dateISO === jour && memeSeance(a) &&
    a.statut !== 'justifie_s' && a.statut !== 'justifie_d'
  );
  const absentsMoi = new Set(incidentsJour.filter(a => a.enseignant === moi).map(a => a.eleveId));
  const absentsAutres = new Set(incidentsJour.filter(a => a.enseignant !== moi).map(a => a.eleveId));
  const quiAutre = {};
  const typeAutre = {};
  const typeMoi = {};
  incidentsJour.filter(a => a.enseignant !== moi).forEach(a => {
    if (!quiAutre[a.eleveId]) {
      quiAutre[a.eleveId] = a.enseignant;
      typeAutre[a.eleveId] = libelleType(a.type) + (a.duree ? ' ' + a.duree : '');
    }
  });
  incidentsJour.filter(a => a.enseignant === moi).forEach(a => {
    if (!typeMoi[a.eleveId]) typeMoi[a.eleveId] = libelleType(a.type) + (a.duree ? ' ' + a.duree : '');
  });
  const absentsPrecedents = new Set(
    absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < jour && a.statut !== 'justifie_s' && a.statut !== 'justifie_d')
      .map(a => a.eleveId)
  );

  let filtres;
  if (filterActive === 'absents') {
    filtres = tousLesEleves.filter(el =>
      elevesCoches.has(el.id) || absentsMoi.has(el.id) || absentsAutres.has(el.id) || absentsPrecedents.has(el.id)
    );
  } else if (filterActive === 'presents') {
    filtres = tousLesEleves.filter(el =>
      !elevesCoches.has(el.id) && !absentsMoi.has(el.id) && !absentsAutres.has(el.id) && !absentsPrecedents.has(el.id)
    );
  } else {
    filtres = tousLesEleves;
  }

  if (filtres.length === 0) {
    const msg = filterActive === 'absents' ? 'Aucun élève signalé' : filterActive === 'presents' ? 'Tous les élèves sont signalés' : 'Aucun élève';
    const iconeEmpty = filterActive === 'absents' ? 'fa-user-check' : 'fa-users';
    div.innerHTML = '<div class="empty-state py-8"><div class="empty-icon"><i class="fas ' + iconeEmpty + '"></i></div><p class="text-gray-500">' + msg + '</p></div>';
    return;
  }

  filtres.forEach(eleve => {
    const parAutre = absentsAutres.has(eleve.id);
    const precedent = absentsPrecedents.has(eleve.id);
    const estMoi = (elevesCoches.has(eleve.id) || absentsMoi.has(eleve.id)) && !decochesManuellement.has(eleve.id);
    const estVerrouille = parAutre || precedent;
    const estCoche = estVerrouille || estMoi;
    const numero = tousLesEleves.findIndex(e => e.id === eleve.id) + 1;

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between px-4 py-3 border-b border-gray-100 transition-all';
    item.style = estCoche ? 'border-left: 5px solid #ef4444; background: #fef2f2' : 'border-left: 5px solid transparent';

    const checkboxHTML = estVerrouille
      ? '<input type="checkbox" checked disabled class="checkbox-locked"><i class="fas fa-lock lock-icon"></i>'
      : '<input type="checkbox" ' + (estCoche ? 'checked' : '') + ' onchange="gererCoche(' + eleve.id + ', this.checked)" class="checkbox-material">';

    let raison = '';
    if (parAutre) raison = 'déjà signalé · ' + (quiAutre[eleve.id] || 'un autre enseignant');
    else if (precedent) raison = 'séance préc.';
    let typeTxt = '';
    if (parAutre) typeTxt = typeAutre[eleve.id] || '';
    else if (estMoi && typeMoi[eleve.id]) typeTxt = typeMoi[eleve.id];

    item.innerHTML = `
      <div class="flex items-center gap-3 flex-1">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${estCoche ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-900'}">${numero}</span>
        <span class="font-medium ${estCoche ? 'text-red-700' : 'text-gray-800'}">${libelleEleve(eleve)}</span>
        ${estVerrouille ? '<span class="text-xs text-gray-400 ml-1">(' + raison + ')</span>' : (typeTxt ? '<span class="text-xs text-gray-400 ml-1">' + typeTxt + '</span>' : '')}
      </div>
      ${checkboxHTML}
    `;
    div.appendChild(item);
  });
}''')

rfn('C2-gererCoche', 'gererCoche', '''function gererCoche(id, coche) {
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const seance = seanceSelectionnee || 'matin';
  if (!coche) {
    const enregistreParAutre = absences.some(a =>
      a.eleveId === id && a.classe === classeSelectionnee.nom && a.dateISO === jour &&
      (a.seance || 'matin') === seance &&
      a.statut !== 'justifie_s' && a.statut !== 'justifie_d' && a.enseignant !== utilisateurConnecte.nom
    );
    if (enregistreParAutre) {
      afficherToast('Incident enregistré par un autre enseignant', 'error');
      afficherListeEleves();
      return;
    }
  }
  if (coche) {
    elevesCoches.add(id);
    decochesManuellement.delete(id);
  } else {
    elevesCoches.delete(id);
    decochesManuellement.add(id);
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom));
    localStorage.setItem('absences', JSON.stringify(absences));
  }
  mettreAJourCompteur();
  afficherListeEleves();
}''')

rfn('C3-confirmation', 'afficherConfirmationAbsences', '''function afficherConfirmationAbsences() {
  if (elevesCoches.size === 0) {
    afficherToast('Cochez au moins un élève', 'error');
    return;
  }
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const details = libelleType(typeSaisie) + (dureeSaisie ? ' ' + dureeSaisie : '');
  document.getElementById('message-confirmation').textContent =
    'Enregistrer ' + elevesCoches.size + ' ' + (typeSaisie === 'absence' ? 'absence(s)' : 'signalement(s)') +
    ' — ' + dateAffichage(jour) + ' (' + libelleSeance(seanceSelectionnee) + ') · ' + details + ' ?';
  document.getElementById('modal-confirmation').classList.remove('hidden');
}''')

rfn('C4-confirmer', 'confirmerAbsences', '''function confirmerAbsences() {
  const now = new Date();
  const heure = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const jour = dateSelectionnee || fmtDateISO(now);
  const seance = seanceSelectionnee || 'matin';

  elevesCoches.forEach(idEleve => {
    if (decochesManuellement.has(idEleve)) return;
    const dejaSauve = absences.find(a => a.eleveId === idEleve && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom);
    if (dejaSauve) return;
    const eleve = classeSelectionnee.eleves.find(e => e.id === idEleve);
    absences.push({
      id: Date.now() + Math.random(),
      eleveId: eleve.id,
      nom: libelleEleve(eleve),
      classe: classeSelectionnee.nom,
      heure: heure,
      date: dateAffichage(jour),
      dateISO: jour,
      seance: seance,
      type: typeSaisie,
      duree: typeSaisie === 'absence' ? '' : (dureeSaisie || ''),
      statut: 'absent',
      enseignant: utilisateurConnecte.nom,
      matiere: utilisateurConnecte.matiere
    });
  });

  localStorage.setItem('absences', JSON.stringify(absences));
  document.getElementById('modal-confirmation').classList.add('hidden');
  afficherToast((typeSaisie === 'absence' ? 'Absences' : 'Signalements') + ' enregistré(s) !', 'success');
  elevesCoches.clear();
  afficherListeEleves();
  mettreAJourCompteur();
}''')

rfn('C5-compteur', 'mettreAJourCompteur', '''function mettreAJourCompteur() {
  if (classeSelectionnee) {
    const jour = dateSelectionnee || fmtDateISO(new Date());
    const seance = seanceSelectionnee || 'matin';
    const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const precedents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < jour && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const total = Math.max(elevesCoches.size + precedents, incidents + precedents);
    document.getElementById('count-absents').textContent = total;
    document.getElementById('count-total').textContent = classeSelectionnee.eleves.length;
  }
  mettreAJourResumeClasse();
}''', r'\(\)')

rfn('C6-resume', 'mettreAJourResumeClasse', '''function mettreAJourResumeClasse() {
  const bloc = document.getElementById('classe-resume');
  if (!bloc) return;
  if (!classeSelectionnee) {
    bloc.classList.add('hidden');
    bloc.textContent = '';
    return;
  }
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const seance = seanceSelectionnee || 'matin';
  const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance && a.statut !== 'justifie_s' && a.statut !== 'justifie_d');
  const mesSaisies = utilisateurConnecte ? incidents.filter(a => a.enseignant === utilisateurConnecte.nom) : [];
  const derniere = mesSaisies.length ? mesSaisies[mesSaisies.length - 1].heure : null;
  let txt = classeSelectionnee.eleves.length + ' élèves · ' + incidents.length + ' signalé(s) le ' + dateAffichage(jour) + ' (' + libelleSeance(seance) + ')';
  if (derniere) txt += ' · dernière saisie à ' + derniere;
  bloc.textContent = txt;
  bloc.classList.remove('hidden');
}''', r'\(\)')

rfn('C7-detail', 'afficherDetailAbsence', '''function afficherDetailAbsence(abs) {
  document.getElementById('detail-nom').textContent = abs.nom;
  document.getElementById('detail-classe').textContent = abs.classe;
  document.getElementById('detail-date').textContent = abs.date + (abs.seance ? ' · ' + libelleSeance(abs.seance) : '');
  document.getElementById('detail-heure').textContent = abs.heure || '-';
  document.getElementById('detail-prof').textContent = abs.enseignant || '-';
  document.getElementById('detail-matiere').textContent = abs.matiere || '-';
  document.getElementById('detail-type').textContent = libelleType(abs.type);

  const rowDuree = document.getElementById('row-duree');
  if (abs.duree) { document.getElementById('detail-duree').textContent = abs.duree; rowDuree.style.display = 'flex'; }
  else rowDuree.style.display = 'none';

  const rowMotif = document.getElementById('row-motif');
  if (abs.motif) { document.getElementById('detail-motif').textContent = abs.motif; rowMotif.style.display = 'flex'; }
  else rowMotif.style.display = 'none';

  const rowPar = document.getElementById('row-justifie-par');
  const rowLe = document.getElementById('row-justifie-le');
  if (abs.justifiePar) {
    document.getElementById('detail-justifie-par').textContent = abs.justifiePar;
    document.getElementById('detail-justifie-le').textContent = abs.justifieLe || '-';
    rowPar.style.display = 'flex';
    rowLe.style.display = 'flex';
  } else {
    rowPar.style.display = 'none';
    rowLe.style.display = 'none';
  }

  const badgeContainer = document.getElementById('detail-statut-badge');
  const badgeClass = abs.statut === 'justifie_s' ? 'badge-info' : abs.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
  badgeContainer.innerHTML = '<span class="badge ' + badgeClass + '">' + libelleStatut(abs.statut) + '</span>';

  const blocMotif = document.getElementById('bloc-motif');
  const btnJustifier = document.getElementById('btn-justifier-absence');
  if (abs.statut === 'absent') {
    if (blocMotif) blocMotif.style.display = 'block';
    btnJustifier.style.display = 'block';
    btnJustifier.onclick = () => { justifierAbsence(abs.id, 'surv'); fermerDetailAbsence(); };
  } else {
    if (blocMotif) blocMotif.style.display = 'none';
    btnJustifier.style.display = 'none';
  }

  document.getElementById('modal-absence-detail').classList.remove('hidden');
}''')

rfn('C8-justifier', 'justifierAbsence', '''function justifierAbsence(id, source) {
  const abs = absences.find(a => a.id === id);
  if (!abs) return;
  abs.statut = source === 'surv' ? 'justifie_s' : 'justifie_d';
  const sel = document.getElementById(source === 'surv' ? 'select-motif' : 'dir-motif');
  abs.motif = (sel && sel.value) ? sel.value : (abs.motif || 'Non justifié');
  abs.justifiePar = utilisateurConnecte ? utilisateurConnecte.nom : '';
  const now = new Date();
  abs.justifieLe = fmtDateISO(now) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  localStorage.setItem('absences', JSON.stringify(absences));
  if (source === 'surv') mettreAJourDashboardSurv();
  if (source === 'dir') afficherAbsencesDir();
  afficherToast(libelleStatut(abs.statut) + ' · ' + abs.motif, 'success');
}''')

rfn('C9-surv', 'mettreAJourDashboardSurv', '''function mettreAJourDashboardSurv() {
  const now = new Date();
  const today = fmtDateISO(now);
  const currentHour = String(now.getHours()).padStart(2, '0');
  const absencesToday = absences.filter(a => a.dateISO === today);
  const nouveauxCetteHeure = absencesToday.filter(a => a.heure && a.heure.startsWith(currentHour));
  const totalUnjustified = absences.filter(a => a.statut === 'absent').length;

  document.getElementById('surv-nouveaux').textContent = nouveauxCetteHeure.length;
  document.getElementById('surv-total-absents').textContent = absencesToday.length;
  document.getElementById('surv-total-unjustified').textContent = totalUnjustified;

  const listContainer = document.getElementById('surv-absences-list');
  listContainer.innerHTML = '';
  const absentsListe = absencesToday.filter(a => a.statut === 'absent');
  if (absentsListe.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>Aucun élève signalé aujourd\\'hui</p></div>';
  } else {
    absentsListe.forEach(abs => {
      const card = document.createElement('div');
      card.className = 'absence-card';
      card.onclick = () => afficherDetailAbsence(abs);
      card.innerHTML = `
        <div class="absence-card-ligne">
          <span class="absence-card-name">${abs.nom}</span>
          <span class="absence-card-classe">${abs.classe}</span>
          <i class="fas fa-chevron-right absence-card-icon"></i>
        </div>
      `;
      listContainer.appendChild(card);
    });
  }
  afficherAlertesSurv();
}

function elevesAuDessusSeuil(seuil) {
  const mois = fmtDateISO(new Date()).slice(0, 7);
  const map = {};
  absences.forEach(a => {
    if (a.statut === 'justifie_s' || a.statut === 'justifie_d') return;
    if (String(a.dateISO || '').slice(0, 7) !== mois) return;
    if ((a.type || 'absence') !== 'absence') return;
    const cle = a.classe + '|' + a.eleveId;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0 };
    map[cle].count++;
  });
  return Object.values(map).filter(x => x.count >= seuil).sort((a, b) => b.count - a.count);
}

function afficherAlertesSurv() {
  const bloc = document.getElementById('surv-alertes');
  if (!bloc) return;
  const al = elevesAuDessusSeuil(SEUIL_ALERTE_MOIS);
  bloc.innerHTML = '';
  if (al.length === 0) {
    bloc.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune alerte ce mois</p>';
    return;
  }
  al.forEach(x => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-3 bg-red-50 rounded-lg';
    item.innerHTML = '<div><p class="font-bold text-gray-800">' + x.nom + '</p><p class="text-xs text-gray-500">' + x.classe + '</p></div><span class="badge badge-danger">' + x.count + ' absences</span>';
    bloc.appendChild(item);
  });
}''', r'\(\)')

# ---------- alertes direction (eleves) ----------
plain('D1-alertesDir',
      """  if (alertDiv.children.length === 0) {
    alertDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune alerte</p>';
  }""",
      """  elevesAuDessusSeuil(SEUIL_ALERTE_MOIS).slice(0, 8).forEach(x => {
    const alEl = document.createElement('div');
    alEl.className = 'bg-orange-50 border-l-4 border-orange-400 p-3 rounded';
    alEl.innerHTML = '<p class="font-bold text-orange-700"><i class="fas fa-user-clock mr-1"></i>' + x.nom + '</p><p class="text-sm text-orange-600">' + x.classe + ' — ' + x.count + ' absences ce mois</p>';
    alertDiv.appendChild(alEl);
  });
  if (alertDiv.children.length === 0) {
    alertDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune alerte</p>';
  }""")

# ---------- absences direction : type / motif / traceabilite ----------
rfn('D2-absDir', 'afficherAbsencesDir', '''function afficherAbsencesDir() {
  const tbody = document.getElementById('dir-absences-body');
  tbody.innerHTML = '';
  let filtres = absences.slice().reverse();
  if (filterDirActive === 'absent') filtres = filtres.filter(a => a.statut !== 'justifie_s' && a.statut !== 'justifie_d');
  if (filterDirActive === 'justifie_s') filtres = filtres.filter(a => a.statut === 'justifie_s');
  if (filterDirActive === 'justifie_d') filtres = filtres.filter(a => a.statut === 'justifie_d');

  if (filtres.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-8">Aucun signalement</td></tr>';
    return;
  }
  filtres.forEach(abs => {
    const tr = document.createElement('tr');
    const badgeClass = abs.statut === 'justifie_s' ? 'badge-info' : abs.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
    const isJustified = abs.statut === 'justifie_s' || abs.statut === 'justifie_d';
    const details = libelleType(abs.type) + (abs.duree ? ' (' + abs.duree + ')' : '') + (abs.motif ? ' · ' + abs.motif : '');
    tr.innerHTML = `
      <td class="font-medium">${abs.nom}<div class="text-xs text-gray-400">${details}</div></td>
      <td>${abs.classe}</td>
      <td>${abs.date}${abs.seance ? '<div class="text-xs text-gray-400">' + libelleSeance(abs.seance) + '</div>' : ''}</td>
      <td><span class="badge ${badgeClass}">${libelleStatut(abs.statut)}</span></td>
      <td>${!isJustified ? '<button onclick="justifierAbsence(' + abs.id + ', &quot;dir&quot;)" class="btn-warning">Justifier</button>' : '<span class="text-green-600 text-sm">✓</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}''', r'\(\)')

# ---------- import MASSAR en lot ----------
rfn('E1-processMassar', 'processMassarFile', '''function processMassarFile(file) {
  const errorDiv = document.getElementById('import-error');
  const previewDiv = document.getElementById('import-preview');
  errorDiv.classList.add('hidden');
  previewDiv.classList.add('hidden');

  if (!file.name.match(/\\.xlsx?$/i)) {
    errorDiv.textContent = 'Fichier invalide. Seuls les fichiers .xlsx sont acceptés.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const resultats = [];
      workbook.SheetNames.forEach(nomFeuille => {
        const parsed = analyserFeuilleMASSAR(workbook.Sheets[nomFeuille]);
        if (parsed) resultats.push(parsed);
      });
      if (resultats.length === 0) {
        errorDiv.textContent = 'Aucune classe détectée. Vérifiez le format MASSAR (nom de classe en I9, élèves à partir de la ligne 18, colonnes C = code, D = nom arabe, E = nom français).';
        errorDiv.classList.remove('hidden');
        return;
      }
      importData = { classes: resultats };
      const total = resultats.reduce((s, c) => s + c.eleves.length, 0);
      document.getElementById('preview-classe-nom').textContent = resultats.length + ' classe(s) détectée(s)';
      document.getElementById('preview-eleves-count').textContent = total + ' élève(s) au total';
      document.getElementById('preview-eleves-list').innerHTML = resultats.map(c =>
        '<div class="flex justify-between py-1 border-b border-green-100"><span class="font-medium">' + c.nom + '</span><span class="text-xs text-gray-400">' + c.eleves.length + ' élèves</span></div>'
      ).join('');
      previewDiv.classList.remove('hidden');
    } catch (err) {
      errorDiv.textContent = 'Erreur de lecture du fichier : ' + err.message;
      errorDiv.classList.remove('hidden');
    }
  };
  reader.readAsArrayBuffer(file);
}

function analyserFeuilleMASSAR(ws) {
  if (!ws || !ws['!ref']) return null;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cellI9 = ws['I9'];
  const nomClasse = cellI9 && cellI9.v ? String(cellI9.v).trim() : '';
  if (!nomClasse) return null;
  const eleves = [];
  for (let row = 17; row <= range.e.r; row++) {
    const cellB = ws[XLSX.utils.encode_cell({ r: row, c: 1 })];
    const cellC = ws[XLSX.utils.encode_cell({ r: row, c: 2 })];
    const cellD = ws[XLSX.utils.encode_cell({ r: row, c: 3 })];
    const cellE = ws[XLSX.utils.encode_cell({ r: row, c: 4 })];
    const nomArabe = cellD && cellD.v ? String(cellD.v).trim() : '';
    const nomFr = cellE && cellE.v ? String(cellE.v).trim() : '';
    const massar = cellC && cellC.v !== undefined ? String(cellC.v).trim() : '';
    if (cellB && cellB.v && (nomArabe || nomFr)) {
      eleves.push({ id: nextEleveId++, massar: massar, nomArabe: nomArabe, nomFr: nomFr, nom: (nomFr || nomArabe), prenom: '' });
    }
  }
  if (eleves.length === 0) return null;
  return { nom: nomClasse, eleves: eleves };
}''')

rfn('E2-confirmerImport', 'confirmerImport', '''function confirmerImport() {
  if (!importData || !importData.classes) return;
  let nouvelles = 0;
  let ajoutes = 0;
  importData.classes.forEach(clImport => {
    const existante = classes.find(c => c.nom.toLowerCase() === clImport.nom.toLowerCase());
    if (existante) {
      clImport.eleves.forEach(e => {
        existante.eleves.push({ id: e.id, nom: e.nom, prenom: e.prenom, massar: e.massar, nomArabe: e.nomArabe, nomFr: e.nomFr });
        ajoutes++;
      });
    } else {
      classes.push({
        id: nextClasseId++,
        nom: clImport.nom,
        eleves: clImport.eleves.map(e => ({ id: e.id, nom: e.nom, prenom: e.prenom, massar: e.massar, nomArabe: e.nomArabe, nomFr: e.nomFr }))
      });
      nouvelles++;
    }
  });
  sauvegarderClasses();
  const total = importData.classes.reduce((s, c) => s + c.eleves.length, 0);
  importData = null;
  document.getElementById('import-preview').classList.add('hidden');
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  afficherToast(nouvelles + ' classe(s) importée(s) · ' + ajoutes + ' élève(s) ajouté(s) — ' + total + ' au total', 'success');
}''', r'\(\)')

# ---------- affichage des eleves via libelleEleve ----------
plain('F1-libelleEleve', '${e.nom} ${e.prenom || \'\'}', '${libelleEleve(e)}', 2)

# ============================================================
# HTML : cartes alertes / recherche / motif + modales
# ============================================================
plain('G1-alertesSurv',
      '        <div id="surv-absences-list" class="space-y-2"></div>\n      </div>',
      '''        <div id="surv-absences-list" class="space-y-2"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-3">Alertes — élèves à surveiller (≥ 4 absences ce mois)</div>
        <div id="surv-alertes" class="space-y-2"></div>
      </div>''')

plain('G2-labelSurv',
      '<div class="stat-label">Absences détaillées</div>',
      '<div class="stat-label">Signalements du jour</div>')

plain('G3-rechercheSurv',
      '    <div class="p-4"><div id="surv-classes-list" class="space-y-2"></div></div>',
      """    <div class="p-4">
      <div class="stat-card mb-4">
        <label class="block text-sm font-bold text-blue-900 mb-2">Rechercher un élève</label>
        <input type="text" id="recherche-eleve" oninput="rechercherEleves('recherche-eleve', 'resultats-recherche')" placeholder="Nom ou code MASSAR..." class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">
        <div id="resultats-recherche" class="mt-3 space-y-2"></div>
      </div>
      <div id="surv-classes-list" class="space-y-2"></div>
    </div>""")

plain('G4-rechercheDir',
      '    <div class="p-4">\n      <!-- Importer fichier MASSAR -->',
      """    <div class="p-4">
      <div class="stat-card mb-4">
        <label class="block text-sm font-bold text-blue-900 mb-2">Rechercher un élève</label>
        <input type="text" id="recherche-eleve-dir" oninput="rechercherEleves('recherche-eleve-dir', 'resultats-recherche-dir')" placeholder="Nom ou code MASSAR..." class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">
        <div id="resultats-recherche-dir" class="mt-3 space-y-2"></div>
      </div>
      <!-- Importer fichier MASSAR -->""")

plain('G5-motifDir',
      """        <button class="filter-chip" onclick="filterDirAbsences('justifie_d', this)">Justifiées D</button>
      </div>""",
      """        <button class="filter-chip" onclick="filterDirAbsences('justifie_d', this)">Justifiées D</button>
      </div>
      <div class="stat-card mb-3">
        <label class="block text-sm font-bold text-blue-900 mb-2">Motif de justification</label>
        <select id="dir-motif" class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg font-medium">
          <option value="Maladie">Maladie</option>
          <option value="Raison familiale">Raison familiale</option>
          <option value="Raison personnelle">Raison personnelle</option>
          <option value="Transport">Transport</option>
          <option value="Sanction">Sanction</option>
          <option value="Autre">Autre</option>
        </select>
      </div>""")

# modal absence : remplace jusqu'au tag TOAST
rx('G6-modalAbsence',
   r'<div id="modal-absence-detail".*?<!-- TOAST -->',
   '''<div id="modal-absence-detail" class="hidden fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white p-6 rounded-3xl scale-in shadow-2xl" style="max-height: 85vh; overflow-y: auto;">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-gray-800">Détails du signalement</h2>
      <button onclick="fermerDetailAbsence()" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
    </div>
    <div id="absence-detail-content" class="space-y-3">
      <div class="detail-ligne"><span class="detail-titre">Élève</span><span class="detail-reponse" id="detail-nom">-</span></div>
      <div class="detail-ligne"><span class="detail-titre">Classe</span><span class="detail-reponse" id="detail-classe">-</span></div>
      <div class="detail-ligne"><span class="detail-titre">Date</span><span class="detail-reponse" id="detail-date">-</span></div>
      <div class="detail-ligne"><span class="detail-titre">Heure</span><span class="detail-reponse" id="detail-heure">-</span></div>
      <div class="detail-ligne"><span class="detail-titre">Professeur</span><span class="detail-reponse" id="detail-prof">-</span></div>
      <div class="detail-ligne"><span class="detail-titre">Matière</span><span class="detail-reponse" id="detail-matiere">-</span></div>
      <div class="detail-ligne"><span class="detail-titre">Type</span><span class="detail-reponse" id="detail-type">-</span></div>
      <div class="detail-ligne" id="row-duree"><span class="detail-titre">Durée</span><span class="detail-reponse" id="detail-duree">-</span></div>
      <div class="detail-ligne"><span class="detail-titre">Statut</span><span class="detail-reponse" id="detail-statut-badge"></span></div>
      <div class="detail-ligne" id="row-motif"><span class="detail-titre">Motif</span><span class="detail-reponse" id="detail-motif">-</span></div>
      <div class="detail-ligne" id="row-justifie-par"><span class="detail-titre">Justifié par</span><span class="detail-reponse" id="detail-justifie-par">-</span></div>
      <div class="detail-ligne" id="row-justifie-le"><span class="detail-titre">Justifié le</span><span class="detail-reponse" id="detail-justifie-le">-</span></div>
    </div>
    <div id="bloc-motif" class="mt-4">
      <label class="block text-xs font-bold text-blue-900 mb-1">Motif de justification</label>
      <select id="select-motif" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
        <option value="Maladie">Maladie</option>
        <option value="Raison familiale">Raison familiale</option>
        <option value="Raison personnelle">Raison personnelle</option>
        <option value="Transport">Transport</option>
        <option value="Sanction">Sanction</option>
        <option value="Autre">Autre</option>
      </select>
    </div>
    <div class="flex gap-3 mt-6">
      <button onclick="fermerDetailAbsence()" class="btn-secondary flex-1">Fermer</button>
      <button id="btn-justifier-absence" class="btn-success flex-1" style="display: none;">Justifier</button>
    </div>
  </div>
</div>

<!-- FICHE ELEVE -->
<div id="modal-fiche-eleve" class="hidden fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white p-6 rounded-3xl scale-in shadow-2xl" style="max-height: 85vh; overflow-y: auto;">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-gray-800" id="fiche-titre">Fiche élève</h2>
      <button onclick="fermerFicheEleve()" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
    </div>
    <div id="fiche-infos" class="space-y-2 mb-4"></div>
    <div class="stat-label mb-2">Historique complet</div>
    <div id="fiche-historique" class="space-y-2" style="max-height: 35vh; overflow-y: auto;"></div>
    <div class="flex gap-3 mt-5">
      <button onclick="fermerFicheEleve()" class="btn-secondary flex-1">Fermer</button>
      <button onclick="exporterFicheEleve()" class="btn-primary flex-1"><i class="fas fa-file-excel"></i> Exporter</button>
    </div>
  </div>
</div>

<!-- TOAST -->''')

# texte de la carte import
plain('G7-texteImport',
      'Uploadez un fichier Excel officiel MASSAR (export_notesCC) pour ajouter automatiquement la classe et ses élèves.',
      'Uploadez un fichier Excel MASSAR (export_notesCC) : toutes les feuilles (classes) sont importées en une fois. Colonnes : C = code MASSAR, D = nom arabe, E = nom français.')

# ---------- JS : recherche + fiche ----------
plain('H1-ficheFn',
      '// ========== INIT ==========',
      '''// ========== RECHERCHE ELEVE ==========
function chercherEleves(terme) {
  terme = (terme || '').trim().toLowerCase();
  if (terme.length < 2) return [];
  const res = [];
  classes.forEach(cl => cl.eleves.forEach(el => {
    const nom = (libelleEleve(el) + ' ' + (el.nomArabe || '')).toLowerCase();
    const massar = (el.massar || '').toLowerCase();
    if (nom.indexOf(terme) >= 0 || massar.indexOf(terme) >= 0) res.push({ eleve: el, classe: cl });
  }));
  return res.slice(0, 30);
}

function rechercherEleves(idInput, idResultats) {
  const champ = document.getElementById(idInput);
  const cont = document.getElementById(idResultats);
  if (!champ || !cont) return;
  const terme = champ.value;
  cont.innerHTML = '';
  if (!terme || terme.trim().length < 2) {
    cont.innerHTML = '<p class="text-xs text-gray-400 text-center">Saisissez au moins 2 caractères</p>';
    return;
  }
  const res = chercherEleves(terme);
  if (res.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-400 text-center">Aucun élève trouvé</p>';
    return;
  }
  res.forEach(r => {
    const nb = absences.filter(a => a.eleveId === r.eleve.id && a.classe === r.classe.nom).length;
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
    item.style.cursor = 'pointer';
    item.onclick = () => ouvrirFicheEleve(r.eleve.id, r.classe.id);
    item.innerHTML = '<div><p class="font-medium text-gray-800">' + libelleEleve(r.eleve) + '</p><p class="text-xs text-gray-500">' + r.classe.nom + (r.eleve.massar ? ' · ' + r.eleve.massar : '') + '</p></div><span class="badge badge-danger">' + nb + '</span>';
    cont.appendChild(item);
  });
}

// ========== FICHE ELEVE ==========
let ficheEleveId = null;
let ficheClasseId = null;

function ligneFiche(titre, valeur) {
  return '<div class="detail-ligne"><span class="detail-titre">' + titre + '</span><span class="detail-reponse">' + valeur + '</span></div>';
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
  const nbAbs = lignes.filter(a => (a.type || 'absence') === 'absence').length;
  const nbRet = lignes.filter(a => a.type === 'retard').length;
  const nbExc = lignes.filter(a => a.type === 'exclusion').length;
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom arabe', el.nomArabe || el.nom || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', nbAbs + ' absence(s) · ' + nbRet + ' retard(s) · ' + nbExc + ' exclusion(s)');
  const hist = lignes.slice().sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')));
  const cont = document.getElementById('fiche-historique');
  if (hist.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    cont.innerHTML = hist.map(a => {
      const badge = a.statut === 'justifie_s' ? 'badge-info' : a.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
      const info = libelleType(a.type) + (a.duree ? ' (' + a.duree + ')' : '') + ' · ' + (a.matiere || '') + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      return '<div class="p-3 bg-gray-50 rounded-lg"><div class="flex justify-between items-center"><span class="font-medium text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + ' · ' + libelleSeance(a.seance) + '</span><span class="badge ' + badge + '">' + libelleStatut(a.statut) + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
    }).join('');
  }
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}

function fermerFicheEleve() {
  document.getElementById('modal-fiche-eleve').classList.add('hidden');
  ficheEleveId = null;
  ficheClasseId = null;
}

function exporterFicheEleve() {
  if (!ficheEleveId) return;
  const cl = classes.find(c => c.id === ficheClasseId);
  const el = cl ? cl.eleves.find(e => e.id === ficheEleveId) : null;
  if (!el) return;
  const lignes = absences.filter(a => a.eleveId === ficheEleveId && a.classe === cl.nom);
  const rows = lignes.map(a => ({
    Date: a.date || '',
    Seance: libelleSeance(a.seance),
    Heure: a.heure || '',
    Type: libelleType(a.type),
    Duree: a.duree || '',
    Matiere: a.matiere || '',
    Enseignant: a.enseignant || '',
    Statut: libelleStatut(a.statut),
    Motif: a.motif || '',
    JustifiePar: a.justifiePar || '',
    JustifieLe: a.justifieLe || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucun incident' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fiche');
  XLSX.writeFile(wb, 'fiche_' + (el.nom || 'eleve').replace(/\\s+/g, '_') + '.xlsx');
  afficherToast('Fiche exportée', 'success');
}

// ========== INIT ==========''')

# ---------- CSS sombre : lisibilite ----------
plain('I1-cssSombre',
      '  </style>\n</head>',
      """    body.theme-sombre { color: #e2e8f0; }
    body.theme-sombre .stat-label { color: #94a3b8; }
    body.theme-sombre .text-blue-900 { color: #93c5fd !important; }
    body.theme-sombre .text-red-600, body.theme-sombre .text-red-700 { color: #fca5a5 !important; }
    body.theme-sombre .text-green-600, body.theme-sombre .text-green-700, body.theme-sombre .text-green-800 { color: #6ee7b7 !important; }
    body.theme-sombre .text-orange-600, body.theme-sombre .text-orange-700 { color: #fdba74 !important; }
    body.theme-sombre .text-gray-900 { color: #f1f5f9 !important; }
    body.theme-sombre .absence-card-name, body.theme-sombre .detail-reponse { color: #e2e8f0; }
    body.theme-sombre .detail-titre { color: #94a3b8; }
    body.theme-sombre .bg-blue-100 { background: #334155 !important; color: #bfdbfe !important; }
    body.theme-sombre .bg-red-50 { background: rgba(239,68,68,0.12) !important; }
    body.theme-sombre .bg-green-50 { background: rgba(16,185,129,0.12) !important; }
    body.theme-sombre .bg-blue-50 { background: rgba(59,130,246,0.12) !important; }
    body.theme-sombre .bg-orange-50 { background: rgba(245,158,11,0.12) !important; }
    body.theme-sombre .border-red-200, body.theme-sombre .border-green-100, body.theme-sombre .border-green-200, body.theme-sombre .border-blue-200 { border-color: #334155 !important; }
    body.theme-sombre .btn-secondary { background: #1e293b; color: #93c5fd; border-color: #334155; }
    body.theme-sombre .bar-label { color: #94a3b8; }
    body.theme-sombre .empty-icon { color: #64748b; }
  </style>
</head>""")

# ---------- version ----------
plain('J1-version', 'AbsenceTrack v1.6 \u2014 Prototype', 'AbsenceTrack v1.7 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('icone-theme', 11), ('saisie-date', 2), ('saisie-seance', 2), ('saisie-type', 2),
                 ('saisie-duree', 4), ('select-motif', 2), ('dir-motif', 2), ('surv-alertes', 2),
                 ('resultats-recherche', 4), ('modal-fiche-eleve', 2), ('analyserFeuilleMASSAR', 2),
                 ('libelleEleve', 6), ('SEUIL_ALERTE_MOIS', 4), ('changerPolice', 0), ('TAILLES_POLICE', 0)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check8.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:3000])
else:
    print('NODE_CHECK skipped (node absent)')
