# -*- coding: utf-8 -*-
# patch_v5c.py -> v3.65
# 1. RH : deux cartes separees "Surveillants" et "Enseignants", chacune avec les segments Liste / Absence
# 2. L'annulation d'une seance quitte la modale et rejoint la carte "Fermeture de l'etablissement" (Gestion)
#    en controle segmente (Fermeture | Seance) ; la liste des annulations du jour y est aussi
# 3. La modale "Annulation" est supprimee (l'absence d'un enseignant se declare dans RH)
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
# 1. RH : remplacer le contenu par 2 cartes (Surveillants / Enseignants)
# ══════════════════════════════════════════════════════════════════
i1 = s.index('      <!-- Personnel : professeurs + surveillants -->')
i2 = s.index('        <div id="annul-liste" class="space-y-2 liste-reglages"></div>\n      </div>\n') + len('        <div id="annul-liste" class="space-y-2 liste-reglages"></div>\n      </div>\n')

PORTEES = """<select id="%s" class="w-full">
            <option value="journee">Toute la journée</option>
            <option value="matin">Matin seulement</option>
            <option value="apres-midi">Après-midi seulement</option>
          </select>"""
MOTIFS = """<select id="%s" class="w-full">
            <option value="Absence">Absence</option>
            <option value="Maladie">Maladie</option>
            <option value="Formation">Formation</option>
            <option value="Mission">Mission</option>
            <option value="Congé">Congé</option>
            <option value="Autre">Autre</option>
          </select>"""

nouveau_rh = """      <!-- Surveillants -->
      <div class="stat-card mb-4 carte-settings" id="surv-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-user-shield text-blue-900 mr-2"></i>Surveillants</h3>
        <div class="mode-segments" id="seg-surveillants">
          <button type="button" id="seg-surv-liste" class="mode-btn actif" onclick="basculerSegments('seg-surveillants', 'seg-surv-liste')"><i class="fas fa-list"></i> Liste</button>
          <button type="button" id="seg-surv-absence" class="mode-btn" onclick="basculerSegments('seg-surveillants', 'seg-surv-absence')"><i class="fas fa-user-clock"></i> Absence</button>
        </div>
        <div id="vue-surv-liste" class="seg-vue">
          <p class="aide">Corriger le nom d'un surveillant, définir ou générer son mot de passe de connexion.</p>
          <div id="dir-surveillants-list" class="liste-reglages"></div>
        </div>
        <div id="vue-surv-absence" class="seg-vue" style="display: none;">
          <p class="aide">Absence d'un surveillant : la période est enregistrée et listée ci-dessous.</p>
          <div class="form-group">
            <label>Surveillant</label>
            <select id="abs-surv-compte" class="w-full"></select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label>Du</label><input type="date" id="abs-surv-debut"></div>
            <div class="form-group"><label>Au</label><input type="date" id="abs-surv-fin"></div>
          </div>
          <div class="form-group">
            <label>Portée</label>
            """ + (PORTEES % 'abs-surv-portee') + """
          </div>
          <div class="form-group">
            <label>Motif</label>
            """ + (MOTIFS % 'abs-surv-motif') + """
          </div>
          <button onclick="enregistrerAbsSurv()" class="btn-primary w-full btn-ripple"><i class="fas fa-plus"></i> Enregistrer l'absence</button>
          <div id="abs-surv-liste" class="space-y-2 mt-3 liste-reglages"></div>
        </div>
      </div>

      <!-- Enseignants -->
      <div class="stat-card mb-4 carte-settings" id="ens-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-chalkboard-teacher text-blue-900 mr-2"></i>Enseignants</h3>
        <div class="mode-segments" id="seg-enseignants">
          <button type="button" id="seg-ens-liste" class="mode-btn actif" onclick="basculerSegments('seg-enseignants', 'seg-ens-liste')"><i class="fas fa-list"></i> Liste</button>
          <button type="button" id="seg-ens-absence" class="mode-btn" onclick="basculerSegments('seg-enseignants', 'seg-ens-absence')"><i class="fas fa-user-clock"></i> Absence</button>
        </div>
        <div id="vue-ens-liste" class="seg-vue">
          <p class="aide">Corriger le nom d'un enseignant, définir ou générer son mot de passe : la modification s'applique partout, y compris dans l'historique des signalements.</p>
          <div id="dir-profs-list" class="liste-reglages"></div>
        </div>
        <div id="vue-ens-absence" class="seg-vue" style="display: none;">
          <p class="aide">Absence d'un enseignant : toutes ses séances de la période sont annulées (jours et heures déduits de son tableau de service) et ne comptent pas dans les statistiques.</p>
          <div class="form-group">
            <label>Enseignant</label>
            <select id="indispo-prof" class="w-full"></select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label>Du</label><input type="date" id="indispo-debut"></div>
            <div class="form-group"><label>Au</label><input type="date" id="indispo-fin"></div>
          </div>
          <div class="form-group">
            <label>Portée</label>
            """ + (PORTEES % 'indispo-portee') + """
          </div>
          <div class="form-group">
            <label>Motif</label>
            """ + (MOTIFS % 'indispo-motif') + """
          </div>
          <button onclick="enregistrerIndispo()" class="btn-primary w-full btn-ripple"><i class="fas fa-plus"></i> Enregistrer l'absence</button>
          <div id="indispo-liste" class="space-y-2 mt-3 liste-reglages"></div>
        </div>
      </div>
"""
s = s[:i1] + nouveau_rh + s[i2:]
print('%-52s OK' % 'RH : cartes Surveillants + Enseignants')

# ══════════════════════════════════════════════════════════════════
# 2. Gestion : carte Fermeture -> segments Fermeture / Seance + liste des annulations
# ══════════════════════════════════════════════════════════════════
i1 = s.index("      <!-- Fermeture de l'etablissement -->")
i2 = s.index('        <div id="ferm-liste" class="space-y-2 mt-3 liste-reglages"></div>\n      </div>\n') + len('        <div id="ferm-liste" class="space-y-2 mt-3 liste-reglages"></div>\n      </div>\n')

nouvelle_carte_fermeture = """      <!-- Fermeture de l'etablissement / annulation d'une seance -->
      <div class="stat-card mb-4 carte-settings" id="fermeture-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-times text-blue-900 mr-2"></i>Fermeture de l'établissement</h3>
        <div class="mode-segments" id="seg-fermeture">
          <button type="button" id="seg-ferm-etab" class="mode-btn actif" onclick="basculerSegments('seg-fermeture', 'seg-ferm-etab')"><i class="fas fa-school"></i> Fermeture</button>
          <button type="button" id="seg-ferm-seance" class="mode-btn" onclick="basculerSegments('seg-fermeture', 'seg-ferm-seance')"><i class="fas fa-calendar-day"></i> Séance</button>
        </div>

        <div id="vue-ferm-etab" class="seg-vue">
          <p class="aide">Vacances, examens, fêtes religieuses ou nationales, réunion… : aucune séance n'est assurée sur la période et les absences prises pendant ces séances ne comptent pas dans les statistiques.</p>
          <div class="form-group">
            <label>Type</label>
            <select id="ferm-type" class="w-full">
              <option value="Vacances">Vacances</option>
              <option value="Fête religieuse">Fête religieuse</option>
              <option value="Fête nationale">Fête nationale</option>
              <option value="Examens">Examens</option>
              <option value="Réunion">Réunion</option>
              <option value="Travaux">Travaux</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <div class="form-group">
            <label>Libellé (facultatif)</label>
            <input type="text" id="ferm-libelle" placeholder="ex. Aïd Al Adha">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label>Du</label><input type="date" id="ferm-debut"></div>
            <div class="form-group"><label>Au</label><input type="date" id="ferm-fin"></div>
          </div>
          <div class="form-group">
            <label>Portée</label>
            <select id="ferm-portee" class="w-full">
              <option value="journee">Toute la journée</option>
              <option value="matin">Matin seulement</option>
              <option value="apres-midi">Après-midi seulement</option>
            </select>
          </div>
          <button onclick="enregistrerFermeture()" class="btn-primary w-full btn-ripple"><i class="fas fa-plus"></i> Ajouter la fermeture</button>
          <div id="ferm-liste" class="space-y-2 mt-3 liste-reglages"></div>
        </div>

        <div id="vue-ferm-seance" class="seg-vue" style="display: none;">
          <p class="aide">Annuler une séance précise (examen, réunion, séance non assurée) : elle ne compte pas dans les statistiques.</p>
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
          <button onclick="confirmerAnnulationSeance()" class="btn-danger w-full btn-ripple"><i class="fas fa-ban"></i> Annuler cette séance</button>
        </div>

        <hr class="my-3 border-gray-200">
        <div class="form-group">
          <label>Journée affichée</label>
          <input type="date" id="annul-date-card" onchange="afficherAnnulationsDuJour(this.value)">
        </div>
        <div class="stat-label" style="margin-bottom: 4px;" id="annul-liste-titre">Séances annulées</div>
        <div id="annul-liste" class="space-y-2 liste-reglages"></div>
      </div>
"""
s = s[:i1] + nouvelle_carte_fermeture + s[i2:]
print('%-52s OK' % 'Gestion : carte Fermeture/Séance + liste')

# ══════════════════════════════════════════════════════════════════
# 3. Suppression de la modale d'annulation
# ══════════════════════════════════════════════════════════════════
i1 = s.index('<!-- MODAL ANNULATION DE SEANCE')
i2 = s.index('<!-- MODAL RENOMMER UN PROFESSEUR')
s = s[:i1] + s[i2:]
print('%-52s OK' % 'modale annulation supprimee')

# ══════════════════════════════════════════════════════════════════
# 4. CSS : cibles mises a jour
# ══════════════════════════════════════════════════════════════════
rep("""    /* Modale Annuler une seance : compacte + liste des annulations a defilement */
    #modal-annulation .form-group { margin-bottom: 8px; }
    #modal-annulation .form-group label { font-size: 11.5px; margin-bottom: 3px; }
    #modal-annulation .form-group input, #modal-annulation .form-group select { padding: 9px 12px; font-size: 14px; border-radius: 10px; }
    #modal-annulation .sd-trigger { min-height: 38px; padding: 8px 12px; font-size: 14px; }
    #modal-annulation .btn-danger { padding: 10px 14px; margin-bottom: 10px; }""",
"""    /* Liste des annulations (carte Fermeture de l'etablissement) : zone a defilement */""",
    1, 'CSS : regles de la modale supprimees')
rep("#annul-card #annul-liste", "#fermeture-card #annul-liste", 4, 'CSS : liste -> carte Fermeture')

# ══════════════════════════════════════════════════════════════════
# 5. JS : suppression de la modale, absences generiques, listes
# ══════════════════════════════════════════════════════════════════
rep("""let modeAnnulation = 'seance';
function basculerModeAnnulation(mode) {
  modeAnnulation = (mode === 'enseignant') ? 'enseignant' : 'seance';
  const b1 = document.getElementById('bloc-annul-seance');
  const b2 = document.getElementById('bloc-annul-enseignant');
  const m1 = document.getElementById('mode-seance');
  const m2 = document.getElementById('mode-enseignant');
  if (b1) b1.style.display = modeAnnulation === 'seance' ? 'block' : 'none';
  if (b2) b2.style.display = modeAnnulation === 'enseignant' ? 'block' : 'none';
  if (m1) m1.classList.toggle('actif', modeAnnulation === 'seance');
  if (m2) m2.classList.toggle('actif', modeAnnulation === 'enseignant');
  const titre = document.getElementById('annul-titre');
  if (titre) titre.textContent = modeAnnulation === 'enseignant' ? "Absence d'un enseignant" : 'Annuler une séance';
}
// Date affichee dans la liste des annulations (carte RH)""",
"""// Date affichee dans la liste des annulations (carte Fermeture de l'etablissement)""",
    1, 'JS : basculerModeAnnulation supprime')

rep("""function ouvrirModalAnnulation() {
  if (!estRoleVieScolaire()) return;
  bornerDatesAnnee();
  basculerModeAnnulation('seance');
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
function fermerModalAnnulation() { document.getElementById('modal-annulation').classList.add('hidden'); }""",
"""// Formulaire "Annuler une séance" (carte Fermeture de l'etablissement, page Gestion)
function preparerFormulaireAnnulation() {
  bornerDatesAnnee();
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
}""",
    1, 'JS : ouvrirModalAnnulation -> preparerFormulaireAnnulation')

# majCreneauxAnnulation : plus de rendu de liste
rep("""  if (selCr && selClasse) {
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
}""",
"""  if (selCr && selClasse) {
    const jour = new Date(dateISO + 'T12:00:00').getDay();
    selCr.innerHTML = '';
    creneauxClasseJour(selClasse.value, jour).forEach(c => {
      const o = document.createElement('option');
      o.value = c.debut + '|' + c.fin;
      o.textContent = c.debut + '–' + c.fin + (c.matiere ? ' · ' + c.matiere : '');
      selCr.appendChild(o);
    });
  }
}""",
    1, 'majCreneauxAnnulation : sans la liste')

# apres une annulation : afficher la journee concernee dans la liste
rep("""  sauvegarderSeancesAnnulees();
  rafraichirListeAnnulations();
  afficherToast('Séance annulée', 'success');""",
"""  sauvegarderSeancesAnnulees();
  const champJour = document.getElementById('annul-date-card');
  if (champJour) champJour.value = dateISO;
  rafraichirListeAnnulations();
  afficherToast('Séance annulée', 'success');""",
    1, 'annulation : la liste suit la journee')

# absences generiques (enseignants + surveillants)
rep("""function enregistrerIndispo() {
  if (!utilisateurConnecte || utilisateurConnecte.role !== 'directeur') return;
  const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const profCode = val('indispo-prof');
  const debut = val('indispo-debut');
  const fin = val('indispo-fin') || debut;
  const portee = val('indispo-portee') || 'journee';
  const motif = val('indispo-motif') || 'Absence du professeur';
  if (!profCode) { afficherToast('Choisissez un enseignant', 'error'); return; }
  if (!debut) { afficherToast('Indiquez la date de début', 'error'); return; }
  if (fin < debut) { afficherToast('La date de fin doit suivre le début', 'error'); return; }
  const b = bornesAnneeScolaire();
  if (debut < b.debut || fin > b.fin) { afficherToast("Période en dehors de l'année scolaire", 'error'); return; }
  indispoProfs.push({
    id: Date.now() + Math.random(), profCode: profCode, debut: debut, fin: fin,
    portee: portee, motif: motif, par: nomApprobateur(), le: fmtDateISO(new Date()) + ' ' + heureMaintenant()
  });
  sauvegarderIndispo();
  rafraichirListeAnnulations();
  afficherToast('Indisponibilité ajoutée', 'success');
  rafraichirApresAnnulation();
}
function supprimerIndispo(id) {
  indispoProfs = indispoProfs.filter(i => i.id !== id);
  sauvegarderIndispo();
  rafraichirListeAnnulations();
  if (typeof afficherIndispos === 'function') afficherIndispos();
  afficherToast('Indisponibilité supprimée', 'success');
  rafraichirApresAnnulation();
}
function afficherIndispos() {
  const cont = document.getElementById('indispo-liste');
  if (!cont) return;
  cont.innerHTML = '';
  if (indispoProfs.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-500 text-center py-1">Aucune indisponibilité enregistrée.</p>';
    return;
  }
  indispoProfs.slice().sort((a, b) => String(a.debut).localeCompare(String(b.debut))).forEach(i => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.innerHTML = '<div><p class="font-medium text-gray-700">' + nomProfCode(i.profCode) + '</p>' +
      '<p class="text-xs text-gray-500">' + dateAffichage(i.debut) +
      (i.fin && i.fin !== i.debut ? ' → ' + dateAffichage(i.fin) : '') + ' · ' + libellePortee(i.portee) +
      (i.motif ? ' · ' + i.motif : '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: #dc2626;';
    b.innerHTML = '<i class="fas fa-trash"></i>';
    b.onclick = () => supprimerIndispo(i.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
}""",
"""// Absence d'un enseignant ou d'un surveillant (memes controles, listes separees)
function roleAbsence(entree) { return entree && entree.role === 'surveillant' ? 'surveillant' : 'enseignant'; }
function enregistrerAbsence(prefixe, idCompte, role) {
  if (!utilisateurConnecte || utilisateurConnecte.role !== 'directeur') return;
  const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const compte = val(idCompte);
  const debut = val(prefixe + '-debut');
  const fin = val(prefixe + '-fin') || debut;
  const portee = val(prefixe + '-portee') || 'journee';
  const motif = val(prefixe + '-motif') || 'Absence';
  if (!compte) { afficherToast('Choisissez un ' + (role === 'surveillant' ? 'surveillant' : 'enseignant'), 'error'); return; }
  if (!debut) { afficherToast('Indiquez la date de début', 'error'); return; }
  if (fin < debut) { afficherToast('La date de fin doit suivre le début', 'error'); return; }
  const b = bornesAnneeScolaire();
  if (debut < b.debut || fin > b.fin) { afficherToast("Période en dehors de l'année scolaire", 'error'); return; }
  indispoProfs.push({
    id: Date.now() + Math.random(), profCode: compte, role: role, debut: debut, fin: fin,
    portee: portee, motif: motif, par: nomApprobateur(), le: fmtDateISO(new Date()) + ' ' + heureMaintenant()
  });
  sauvegarderIndispo();
  rafraichirListeAnnulations();
  afficherAbsencesPersonnel('indispo-liste', 'enseignant');
  afficherAbsencesPersonnel('abs-surv-liste', 'surveillant');
  afficherToast('Absence enregistrée', 'success');
  rafraichirApresAnnulation();
}
function enregistrerIndispo() { enregistrerAbsence('indispo', 'indispo-prof', 'enseignant'); }
function enregistrerAbsSurv() { enregistrerAbsence('abs-surv', 'abs-surv-compte', 'surveillant'); }
function supprimerIndispo(id) {
  indispoProfs = indispoProfs.filter(i => i.id !== id);
  sauvegarderIndispo();
  rafraichirListeAnnulations();
  afficherAbsencesPersonnel('indispo-liste', 'enseignant');
  afficherAbsencesPersonnel('abs-surv-liste', 'surveillant');
  afficherToast('Absence supprimée', 'success');
  rafraichirApresAnnulation();
}
function afficherAbsencesPersonnel(idConteneur, role) {
  const cont = document.getElementById(idConteneur);
  if (!cont) return;
  const liste = indispoProfs.filter(i => roleAbsence(i) === role)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  cont.innerHTML = '';
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-500 text-center py-1">Aucune absence enregistrée.</p>';
    return;
  }
  liste.forEach(i => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.innerHTML = '<div style="min-width: 0;"><p class="font-medium text-gray-700" style="font-size: 13px;">' + nomProfCode(i.profCode) + '</p>' +
      '<p class="text-xs text-gray-500">' + dateAffichage(i.debut) +
      (i.fin && i.fin !== i.debut ? ' → ' + dateAffichage(i.fin) : '') + ' · ' + libellePortee(i.portee) +
      (i.motif ? ' · ' + i.motif : '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: #dc2626;';
    b.innerHTML = '<i class="fas fa-trash"></i>';
    b.onclick = () => supprimerIndispo(i.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
}
function afficherIndispos() {
  afficherAbsencesPersonnel('indispo-liste', 'enseignant');
  afficherAbsencesPersonnel('abs-surv-liste', 'surveillant');
}""",
    1, 'JS : absences generiques')

# selecteurs de comptes
rep("""function remplirProfsIndispo() {
  const sel = document.getElementById('indispo-prof');
  if (!sel) return;
  const courant = sel.value;
  sel.innerHTML = '';
  comptes.filter(c => c.role === 'enseignant').forEach(c => {
    const o = document.createElement('option');
    o.value = c.code || c.email;
    o.textContent = (c.nom || '') + ' · ' + (c.matiere || '');
    sel.appendChild(o);
  });
  if (courant && Array.prototype.some.call(sel.options, o => o.value === courant)) sel.value = courant;
}""",
"""function remplirComptesSelect(idSelect, role) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const courant = sel.value;
  sel.innerHTML = '';
  comptes.filter(c => c.role === role).forEach(c => {
    const o = document.createElement('option');
    o.value = c.code || c.email;
    o.textContent = (c.nom || '') + (c.matiere ? ' · ' + c.matiere : '');
    sel.appendChild(o);
  });
  if (courant && Array.prototype.some.call(sel.options, o => o.value === courant)) sel.value = courant;
}
function remplirProfsIndispo() {
  remplirComptesSelect('indispo-prof', 'enseignant');
  remplirComptesSelect('abs-surv-compte', 'surveillant');
}""",
    1, 'JS : selecteurs de comptes')

# afficherRH + afficherGestionDir
rep("""  if (estDir) {
    bornerDatesAnnee();
    remplirProfsIndispo();
    rafraichirListeAnnulations();
    afficherListeProfs();
  }""",
"""  if (estDir) {
    bornerDatesAnnee();
    remplirProfsIndispo();
    afficherListeProfs();
    afficherAbsencesPersonnel('indispo-liste', 'enseignant');
    afficherAbsencesPersonnel('abs-surv-liste', 'surveillant');
  }""",
    1, 'afficherRH : listes du personnel')

rep("""function afficherGestionDir() {
  afficherParametres();
  bornerDatesAnnee();
  afficherFermetures();""",
"""function afficherGestionDir() {
  afficherParametres();
  bornerDatesAnnee();
  afficherFermetures();
  preparerFormulaireAnnulation();
  rafraichirListeAnnulations();""",
    1, 'afficherGestionDir : formulaire + liste')

# la suppression d'une indispo depuis la liste des annulations
rep("""    regles.push({ source: 'Indisponibilité', id: i.id, supprimable: true, nom: nomProfCode(i.profCode),
      detail: (i.motif || 'Absence') + ' · ' + libellePortee(i.portee), par: i.par });""",
"""    regles.push({ source: roleAbsence(i) === 'surveillant' ? 'Absence surveillant' : 'Absence enseignant',
      id: i.id, supprimable: true, nom: nomProfCode(i.profCode),
      detail: (i.motif || 'Absence') + ' · ' + libellePortee(i.portee), par: i.par });""",
    1, 'liste : tag d absence par role')

# ══════════════════════════════════════════════════════════════════
# 6. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.64', 'AbsenceTrack v3.65', 1, 'label v3.65')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
