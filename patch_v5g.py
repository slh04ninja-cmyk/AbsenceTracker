# -*- coding: utf-8 -*-
# patch_v5g.py -> v3.69
# 1. Correction : la liste "Seances annulees" s'affiche des l'ouverture du Dashboard (dir + surveillant)
# 2. Carte "Etablissement & annee scolaire" -> popup ouvert par un bouton "Informations de l'etablissement"
# 3. Gestion : 2 cartes separees "Fermeture de l'etablissement" et "Annulation de seances", chacune avec
#    un bouton d'ajout (popup Fermer/Valider) + sa liste de cartes (defilement apres 4 cartes)
# 4. RH : bouton "Declarer une absence" (popup) + liste des absences (defilement apres 6 cartes)
#    -> une seule modale de formulaire generique pour les 5 saisies
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
# 1. Gestion : 3 cartes (etablissement-bouton, fermetures, annulations)
# ══════════════════════════════════════════════════════════════════
i1 = s.index('      <!-- Etablissement & annee scolaire -->')
i2 = s.index('      <!-- Importer fichier MASSAR -->')
nouvelles_cartes = """      <!-- Etablissement & annee scolaire (popup) -->
      <div class="stat-card mb-4 carte-settings" id="etab-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-school text-blue-900 mr-2"></i>Établissement & année scolaire</h3>
        <p class="aide">Code de l'établissement, académie, direction provinciale, année et semestres : à saisir une seule fois.</p>
        <button type="button" class="btn-primary w-full btn-ripple" onclick="ouvrirFormulaire('etablissement')"><i class="fas fa-pen"></i> Informations de l'établissement</button>
      </div>

      <!-- Fermeture de l'etablissement -->
      <div class="stat-card mb-4 carte-settings" id="fermeture-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-times text-blue-900 mr-2"></i>Fermeture de l'établissement</h3>
        <p class="aide">Vacances, examens, fêtes religieuses ou nationales, réunion… : aucune séance n'est assurée sur la période et les absences prises pendant ces séances ne comptent pas dans les statistiques.</p>
        <button type="button" class="btn-primary w-full btn-ripple" onclick="ouvrirFormulaire('fermeture')"><i class="fas fa-plus"></i> Ajouter une fermeture</button>
        <div class="stat-label" style="margin: 10px 0 4px;">Fermetures enregistrées</div>
        <div id="ferm-liste" class="js-fermetures"></div>
      </div>

      <!-- Annulation de seances -->
      <div class="stat-card mb-4 carte-settings" id="annulations-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-ban text-blue-900 mr-2"></i>Annulation de séances</h3>
        <p class="aide">Annuler une séance précise (examen, réunion, séance non assurée) : elle ne compte pas dans les statistiques. Les séances annulées apparaissent aussi sur les Dashboards (directeur et surveillant).</p>
        <button type="button" class="btn-primary w-full btn-ripple" onclick="ouvrirFormulaire('annulation')"><i class="fas fa-plus"></i> Ajouter une annulation</button>
        <div class="stat-label" style="margin: 10px 0 4px;">Annulations enregistrées</div>
        <div id="annulations-liste" class="js-annulations"></div>
      </div>

"""
s = s[:i1] + nouvelles_cartes + s[i2:]
print('%-52s OK' % 'Gestion : 3 cartes')

# ══════════════════════════════════════════════════════════════════
# 2. RH : boutons "Declarer une absence" + listes
# ══════════════════════════════════════════════════════════════════
i1 = s.index('        <div id="vue-surv-absence" class="seg-vue" style="display: none;">')
i2 = s.index('      </div>\n\n      <!-- Enseignants -->')
s = s[:i1] + """        <div id="vue-surv-absence" class="seg-vue" style="display: none;">
          <p class="aide">Absence d'un surveillant : la période est enregistrée et listée ci-dessous.</p>
          <button type="button" class="btn-primary w-full btn-ripple" onclick="ouvrirFormulaire('absenceSurv')"><i class="fas fa-user-clock"></i> Déclarer une absence</button>
          <div class="stat-label" style="margin: 10px 0 4px;">Absences enregistrées</div>
          <div id="abs-surv-liste" class="js-absences-personnel"></div>
        </div>
""" + s[i2:]
print('%-52s OK' % 'RH : vue absence surveillants')

i1 = s.index('        <div id="vue-ens-absence" class="seg-vue" style="display: none;">')
i2 = s.index('      </div>\n\n      </div>')      # fin de la carte Enseignants puis de #profil-rh
s = s[:i1] + """        <div id="vue-ens-absence" class="seg-vue" style="display: none;">
          <p class="aide">Absence d'un enseignant : toutes ses séances de la période sont annulées (jours et heures déduits de son tableau de service) et ne comptent pas dans les statistiques.</p>
          <button type="button" class="btn-primary w-full btn-ripple" onclick="ouvrirFormulaire('absenceEns')"><i class="fas fa-user-clock"></i> Déclarer une absence</button>
          <div class="stat-label" style="margin: 10px 0 4px;">Absences enregistrées</div>
          <div id="indispo-liste" class="js-absences-personnel"></div>
        </div>
""" + s[i2:]
print('%-52s OK' % 'RH : vue absence enseignants')

# ══════════════════════════════════════════════════════════════════
# 3. Modale de formulaire unifiee
# ══════════════════════════════════════════════════════════════════
rep("""<!-- MODAL MON PROFIL (DIRECTEUR)                     -->""",
"""<!-- MODAL FORMULAIRE (unifiee : fermeture, annulation, absences, etablissement) -->
<div id="modal-form" class="hidden fixed inset-0 modal-overlay flex items-center justify-center p-4" style="z-index: 320;">
  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl carte-settings" style="max-height: 90vh; display: flex; flex-direction: column;">
    <div class="flex items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <span style="width: 28px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center" id="form-titre">Formulaire</h2>
      <button onclick="fermerFormulaire()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" style="width: 28px; flex-shrink: 0; text-align: right;">&times;</button>
    </div>
    <div style="flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0;">
      <div class="px-4 pb-4" id="form-corps"></div>
    </div>
    <div class="flex gap-3 px-4 pt-2 pb-5" style="flex-shrink: 0;">
      <button onclick="fermerFormulaire()" class="btn-fermer flex-1">Fermer</button>
      <button onclick="validerFormulaire()" class="btn-primary flex-1"><i class="fas fa-save"></i> Valider</button>
    </div>
  </div>
</div>

<!-- MODAL MON PROFIL (DIRECTEUR)                     -->""",
    1, 'modale formulaire')

# ══════════════════════════════════════════════════════════════════
# 4. CSS : listes (4 cartes / 6 cartes)
# ══════════════════════════════════════════════════════════════════
rep("""    .js-seances-annulees, .js-absences-personnel, .js-fermetures {""",
    """    .js-seances-annulees, .js-absences-personnel, .js-fermetures, .js-annulations {""",
    1, 'CSS : classe js-annulations (1/3)')
rep("""    body.theme-sombre .js-seances-annulees, body.theme-sombre .js-absences-personnel, body.theme-sombre .js-fermetures { background: #0f172a; border-color: #334155; }""",
    """    body.theme-sombre .js-seances-annulees, body.theme-sombre .js-absences-personnel, body.theme-sombre .js-fermetures, body.theme-sombre .js-annulations { background: #0f172a; border-color: #334155; }""",
    1, 'CSS : classe js-annulations (2/3)')
rep("""    .js-seances-annulees > div, .js-absences-personnel > div, .js-fermetures > div {""",
    """    /* 6 cartes visibles pour les absences du personnel (les autres listes : 4) */
    .js-absences-personnel { max-height: 286px; }
    .js-seances-annulees > div, .js-absences-personnel > div, .js-fermetures > div, .js-annulations > div {""",
    1, 'CSS : classe js-annulations (3/3) + 6 cartes')

# ══════════════════════════════════════════════════════════════════
# 5. JS : modale de formulaire generique
# ══════════════════════════════════════════════════════════════════
rep("""// ========== FERMETURE DE L'ETABLISSEMENT (directeur) ==========""",
"""// ========== FORMULAIRES (une seule modale pour toutes les saisies) ==========
const FORMULAIRES = {
  etablissement: {
    titre: "Informations de l'établissement",
    aide: "Ces informations sont saisies une seule fois : elles servent aux rapports et aux filtres de période.",
    prepare: function () { afficherParametres(); },
    action: 'enregistrerParametres',
    champs: [
      { id: 'etab-code', label: 'Code établissement (unique)', type: 'text', placeholder: 'ex. 24A1234' },
      { id: 'etab-nom', label: "Nom de l'établissement", type: 'text', placeholder: 'ex. الثانوية القصبية الإعدادية – بوعوان' },
      { id: 'etab-academie', label: 'Académie régionale', type: 'select', options: [], onchange: 'changerAcademie()' },
      { id: 'etab-direction', label: 'Direction provinciale', type: 'select', options: [] },
      { id: 'annee-libelle', label: 'Année scolaire', type: 'select', options: [] },
      { id: 'sem1-debut', label: 'Semestre 1 — début', type: 'date' },
      { id: 'sem1-fin', label: 'Semestre 1 — fin', type: 'date' },
      { id: 'sem2-debut', label: 'Semestre 2 — début', type: 'date' },
      { id: 'sem2-fin', label: 'Semestre 2 — fin', type: 'date' }
    ]
  },
  fermeture: {
    titre: 'Ajouter une fermeture',
    aide: "Aucune séance n'est assurée sur la période : les absences prises pendant ces séances ne comptent pas dans les statistiques.",
    prepare: function () { const el = document.getElementById('ferm-libelle'); if (el) el.value = ''; },
    action: 'enregistrerFermeture',
    champs: [
      { id: 'ferm-type', label: 'Type', type: 'select', options: ['Vacances', 'Fête religieuse', 'Fête nationale', 'Examens', 'Réunion', 'Travaux', 'Autre'] },
      { id: 'ferm-libelle', label: 'Libellé (facultatif)', type: 'text', placeholder: 'ex. Aïd Al Adha' },
      { id: 'ferm-debut', label: 'Du', type: 'date' },
      { id: 'ferm-fin', label: 'Au', type: 'date' },
      { id: 'ferm-portee', label: 'Portée', type: 'select', options: [['journee', 'Toute la journée'], ['matin', 'Matin seulement'], ['apres-midi', 'Après-midi seulement']] }
    ]
  },
  annulation: {
    titre: 'Ajouter une annulation',
    aide: 'Séance précise (examen, réunion, séance non assurée) : elle ne compte pas dans les statistiques.',
    prepare: function () { preparerFormulaireAnnulation(); },
    action: 'confirmerAnnulationSeance',
    champs: [
      { id: 'annul-date', label: 'Date', type: 'date', onchange: 'majCreneauxAnnulation()' },
      { id: 'annul-classe', label: 'Classe', type: 'select', options: [], onchange: 'majCreneauxAnnulation()' },
      { id: 'annul-creneau', label: 'Séance', type: 'select', options: [] },
      { id: 'annul-motif', label: 'Motif', type: 'select', options: ['Absence du professeur', 'Séance non assurée', 'Examen', 'Réunion', 'Autre'] }
    ]
  },
  absenceSurv: {
    titre: 'Déclarer une absence',
    aide: "Absence d'un surveillant : la période est enregistrée dans la rubrique RH.",
    prepare: function () { remplirProfsIndispo(); },
    action: 'enregistrerAbsSurv',
    champs: [
      { id: 'abs-surv-compte', label: 'Surveillant', type: 'select', options: [] },
      { id: 'abs-surv-debut', label: 'Du', type: 'date' },
      { id: 'abs-surv-fin', label: 'Au', type: 'date' },
      { id: 'abs-surv-portee', label: 'Portée', type: 'select', options: [['journee', 'Toute la journée'], ['matin', 'Matin seulement'], ['apres-midi', 'Après-midi seulement']] },
      { id: 'abs-surv-motif', label: 'Motif', type: 'select', options: ['Absence', 'Maladie', 'Formation', 'Mission', 'Congé', 'Autre'] }
    ]
  },
  absenceEns: {
    titre: 'Déclarer une absence',
    aide: "Toutes les séances de l'enseignant sur la période sont annulées (déduites de son tableau de service).",
    prepare: function () { remplirProfsIndispo(); },
    action: 'enregistrerIndispo',
    champs: [
      { id: 'indispo-prof', label: 'Enseignant', type: 'select', options: [] },
      { id: 'indispo-debut', label: 'Du', type: 'date' },
      { id: 'indispo-fin', label: 'Au', type: 'date' },
      { id: 'indispo-portee', label: 'Portée', type: 'select', options: [['journee', 'Toute la journée'], ['matin', 'Matin seulement'], ['apres-midi', 'Après-midi seulement']] },
      { id: 'indispo-motif', label: 'Motif', type: 'select', options: ['Absence', 'Maladie', 'Formation', 'Mission', 'Congé', 'Autre'] }
    ]
  }
};

function construireChamp(ch) {
  const bloc = document.createElement('div');
  bloc.className = 'form-group';
  const label = document.createElement('label');
  label.textContent = ch.label;
  bloc.appendChild(label);
  let el;
  if (ch.type === 'select') {
    el = document.createElement('select');
    el.className = 'w-full';
    (ch.options || []).forEach(o => {
      const opt = document.createElement('option');
      if (Array.isArray(o)) { opt.value = o[0]; opt.textContent = o[1]; }
      else { opt.value = o; opt.textContent = o; }
      el.appendChild(opt);
    });
  } else {
    el = document.createElement('input');
    el.type = (ch.type === 'date') ? 'date' : 'text';
    if (ch.placeholder) el.placeholder = ch.placeholder;
  }
  el.id = ch.id;
  if (ch.onchange) el.setAttribute('onchange', ch.onchange);
  bloc.appendChild(el);
  return bloc;
}
// Construit les 5 formulaires dans la modale (appele au chargement, avant l'habillage des listes)
function construireFormulaires() {
  const corps = document.getElementById('form-corps');
  if (!corps) return;
  corps.innerHTML = '';
  Object.keys(FORMULAIRES).forEach(cle => {
    const f = FORMULAIRES[cle];
    const bloc = document.createElement('div');
    bloc.id = 'bloc-form-' + cle;
    bloc.style.display = 'none';
    if (f.aide) {
      const p = document.createElement('p');
      p.className = 'aide';
      p.textContent = f.aide;
      bloc.appendChild(p);
    }
    f.champs.forEach(ch => bloc.appendChild(construireChamp(ch)));
    corps.appendChild(bloc);
  });
}
let formulaireActif = null;
function ouvrirFormulaire(cle) {
  const f = FORMULAIRES[cle];
  if (!f) return;
  formulaireActif = cle;
  const blocs = document.querySelectorAll('#form-corps > div');
  for (let i = 0; i < blocs.length; i++) blocs[i].style.display = (blocs[i].id === 'bloc-form-' + cle) ? 'block' : 'none';
  const titre = document.getElementById('form-titre');
  if (titre) titre.textContent = f.titre;
  const m = document.getElementById('modal-form');
  if (m) m.classList.remove('hidden');
  bornerDatesAnnee();
  if (typeof f.prepare === 'function') f.prepare();
}
function fermerFormulaire() {
  formulaireActif = null;
  const m = document.getElementById('modal-form');
  if (m) m.classList.add('hidden');
}
// Valide : la modale se ferme seulement si la saisie a modifie quelque chose (sinon un toast explique)
function validerFormulaire() {
  const f = FORMULAIRES[formulaireActif];
  if (!f) return;
  const etat = () => JSON.stringify([etablissement, anneeScolaire, fermeturesEtab, seancesAnnulees, indispoProfs]);
  const avant = etat();
  const action = window[f.action];
  if (typeof action === 'function') action();
  if (etat() !== avant) fermerFormulaire();
}

// ========== FERMETURE DE L'ETABLISSEMENT (directeur) ==========""",
    1, 'JS : FORMULAIRES + modale')

rep("""// ========== LIBELLES ==========""",
"""// Les formulaires sont construits tout de suite (avant l'habillage maison des <select>)
construireFormulaires();

// ========== LIBELLES ==========""",
    1, 'JS : construction au chargement')

# ══════════════════════════════════════════════════════════════════
# 6. JS : liste des annulations enregistrees + correction du rendu au 1er affichage
# ══════════════════════════════════════════════════════════════════
rep("""function rafraichirListeAnnulations() { afficherSeancesAnnulees(); }""",
"""function rafraichirListeAnnulations() { afficherSeancesAnnulees(); }

// Annulations enregistrees (saisie directe) : liste de la carte "Annulation de seances" (Gestion)
function afficherAnnulationsEnregistrees() {
  const cont = document.getElementById('annulations-liste');
  if (!cont) return;
  cont.innerHTML = '';
  const liste = trierSeancesAnnulees(seancesAnnulees);
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune annulation enregistrée.</p>';
    return;
  }
  const auj = fmtDateISO(new Date());
  liste.forEach(sn => {
    const titre = dateAffichage(sn.dateISO) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
      (String(sn.dateISO) > auj ? ' <span class="tag-avenir">À venir</span>' : '');
    cont.appendChild(carteLigne(titre, (sn.motif || '') + (sn.par ? ' · par ' + sn.par : ''),
      { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
  });
}""",
    1, 'JS : afficherAnnulationsEnregistrees')

rep("""  sauvegarderSeancesAnnulees();
  afficherSeancesAnnulees();
  afficherToast('Séance annulée', 'success');""",
"""  sauvegarderSeancesAnnulees();
  afficherSeancesAnnulees();
  afficherAnnulationsEnregistrees();
  afficherToast('Séance annulée', 'success');""",
    1, 'confirmerAnnulationSeance : liste Gestion')

rep("""  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);
  sauvegarderSeancesAnnulees();
  rafraichirListeAnnulations();""",
"""  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);
  sauvegarderSeancesAnnulees();
  rafraichirListeAnnulations();
  afficherAnnulationsEnregistrees();""",
    1, 'retablirSeance : liste Gestion')

# au premier affichage du Dashboard du directeur
rep("""function mettreAJourDashboardDir() {
  // Memes indicateurs que le Dashboard du surveillant (etablissement entier)""",
"""function mettreAJourDashboardDir() {
  afficherSeancesAnnulees();
  // Memes indicateurs que le Dashboard du surveillant (etablissement entier)""",
    1, 'mettreAJourDashboardDir : rendu des seances')

rep("""function afficherGestionDir() {
  afficherParametres();
  bornerDatesAnnee();
  afficherFermetures();
  preparerFormulaireAnnulation();""",
"""function afficherGestionDir() {
  bornerDatesAnnee();
  afficherFermetures();
  afficherAnnulationsEnregistrees();
  preparerFormulaireAnnulation();""",
    1, 'afficherGestionDir : listes')

# init : rendu des 2 dashboards apres la connexion
rep("""        if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); appliquerTableauService(); }
        else if (valid.role === 'surveillant') { afficherEcran('surveillant'); mettreAJourDashboardSurv(); }
        else if (valid.role === 'directeur') { afficherEcran('directeur'); mettreAJourDashboardDir(); }""",
"""        if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); appliquerTableauService(); }
        else if (valid.role === 'surveillant') { afficherEcran('surveillant'); mettreAJourDashboardSurv(); afficherSeancesAnnulees(); }
        else if (valid.role === 'directeur') { afficherEcran('directeur'); mettreAJourDashboardDir(); afficherSeancesAnnulees(); }""",
    1, 'init : rendu des seances annulees')

# la connexion aussi (connexion() remet les pages a zero)
rep("""  } else if (compte.role === 'surveillant') {
    afficherEcran('surveillant');
    mettreAJourDashboardSurv();
  } else if (compte.role === 'directeur') {
    afficherEcran('directeur');
    mettreAJourDashboardDir();
  }""",
"""  } else if (compte.role === 'surveillant') {
    afficherEcran('surveillant');
    mettreAJourDashboardSurv();
    afficherSeancesAnnulees();
  } else if (compte.role === 'directeur') {
    afficherEcran('directeur');
    mettreAJourDashboardDir();
    afficherSeancesAnnulees();
  }""",
    1, 'connexion : rendu des seances annulees')

# ══════════════════════════════════════════════════════════════════
# 7. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.68', 'AbsenceTrack v3.69', 1, 'label v3.69')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
