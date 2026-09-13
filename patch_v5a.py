# -*- coding: utf-8 -*-
# patch_v5a.py -> v3.63
# Fusion : une seule modale "Annuler des séances" (mode 1 seance / mode enseignant plusieurs jours),
# ouverte depuis la carte RH ; le bouton des Dashboards (directeur + surveillant) est retire ;
# la liste des annulations (du jour choisi) vit dans la carte RH, plus dans la modale.
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
# 1. Retirer les boutons des Dashboards
# ══════════════════════════════════════════════════════════════════
rep("""      <button type="button" class="btn-outline-danger" onclick="ouvrirModalAnnulation()"><i class="fas fa-ban"></i> Annuler une séance</button>\n""",
    "", 2, 'boutons des Dashboards retires')

# ══════════════════════════════════════════════════════════════════
# 2. Carte RH : "Annuler des séances" (remplace la carte Indisponibilite)
# ══════════════════════════════════════════════════════════════════
deb = s.index("      <!-- Indisponibilite d'un enseignant -->")
fin = s.index("      </div>\n", s.index('id="indispo-liste"')) + len("      </div>\n")
bloc = s[deb:fin]
assert 'indispo-prof' in bloc and 'indispo-liste' in bloc, 'bloc indisponibilite introuvable'
# on recupere les 5 champs pour les remettre dans la modale
champs = bloc[bloc.index('        <div class="form-group">\n          <label>Enseignant</label>'):
              bloc.index('        <button onclick="enregistrerIndispo()"')]
nouvelle_carte = """      <!-- Annuler des séances (directeur) -->
      <div class="stat-card mb-4 carte-settings" id="annul-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-ban text-blue-900 mr-2"></i>Annuler des séances</h3>
        <p class="aide">Une <strong>séance précise</strong> (examen, réunion, séance non assurée) ou l'<strong>absence d'un enseignant</strong> sur un ou plusieurs jours : dans les deux cas, les séances concernées ne comptent pas dans les statistiques.</p>
        <button type="button" class="btn-outline-danger" onclick="ouvrirModalAnnulation()"><i class="fas fa-plus"></i> Nouvelle annulation</button>
        <div class="form-group">
          <label>Journée affichée</label>
          <input type="date" id="annul-date-card" onchange="afficherAnnulationsDuJour(this.value)">
        </div>
        <div class="stat-label" style="margin-bottom: 4px;" id="annul-liste-titre">Séances annulées</div>
        <div id="annul-liste" class="space-y-2 liste-reglages"></div>
      </div>
"""
s = s[:deb] + nouvelle_carte + s[fin:]
print('%-52s OK' % 'carte RH : Annuler des séances')

# ══════════════════════════════════════════════════════════════════
# 3. Modale : selecteur de mode + champs enseignant + liste retiree
# ══════════════════════════════════════════════════════════════════
rep("""      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center">Annuler une séance</h2>""",
"""      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center" id="annul-titre">Annuler une séance</h2>""",
    1, 'modale : titre dynamique')

rep("""      <div class="px-4 pb-3">
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
        <div class="stat-label" style="margin-bottom: 4px;" id="annul-liste-titre">Séances annulées</div>
        <div id="annul-liste" class="space-y-2"></div>
      </div>""",
"""      <div class="px-4 pb-4">
        <div class="mode-segments">
          <button type="button" id="mode-seance" class="mode-btn actif" onclick="basculerModeAnnulation('seance')"><i class="fas fa-calendar-day"></i> Une séance</button>
          <button type="button" id="mode-enseignant" class="mode-btn" onclick="basculerModeAnnulation('enseignant')"><i class="fas fa-user-clock"></i> Un enseignant</button>
        </div>

        <div id="bloc-annul-seance">
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
        </div>

        <div id="bloc-annul-enseignant" style="display: none;">
""" + champs + """          <button onclick="enregistrerIndispo()" class="btn-danger w-full mb-4"><i class="fas fa-user-slash"></i> Enregistrer l'absence</button>
        </div>
      </div>""",
    1, 'modale : 2 modes')

# ══════════════════════════════════════════════════════════════════
# 4. CSS : segments de mode
# ══════════════════════════════════════════════════════════════════
rep("""    .btn-mini-profil {""",
"""    .mode-segments { display: flex; gap: 6px; margin-bottom: 10px; }
    .mode-btn { flex: 1; height: var(--btn-h); display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 2px solid #e2e8f0; background: #f8fafc; color: #475569; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .mode-btn.actif { border-color: var(--primary); background: rgba(30,58,138,0.08); color: var(--primary); }
    body.theme-sombre .mode-btn { background: #0f172a; border-color: #334155; color: #cbd5e1; }
    body.theme-sombre .mode-btn.actif { border-color: #93c5fd; color: #93c5fd; background: rgba(147,197,253,0.12); }
    .btn-mini-profil {""",
    1, 'CSS : segments de mode')

# ══════════════════════════════════════════════════════════════════
# 5. JS : modes + liste dans la carte + suppression d'une indispo depuis la liste
# ══════════════════════════════════════════════════════════════════
rep("""function ouvrirModalAnnulation() {
  if (!estRoleVieScolaire()) return;
  bornerDatesAnnee();""",
"""let modeAnnulation = 'seance';
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
// Date affichee dans la liste des annulations (carte RH)
function dateListeAnnulations() {
  const el = document.getElementById('annul-date-card');
  return (el && el.value) ? el.value : fmtDateISO(new Date());
}
function rafraichirListeAnnulations() {
  const el = document.getElementById('annul-date-card');
  if (el && !el.value) el.value = fmtDateISO(new Date());
  afficherAnnulationsDuJour(dateListeAnnulations());
}

function ouvrirModalAnnulation() {
  if (!estRoleVieScolaire()) return;
  bornerDatesAnnee();
  basculerModeAnnulation('seance');""",
    1, 'JS : bascule de mode + helpers de liste')

rep("""  if (estDir) {
    bornerDatesAnnee();
    remplirProfsIndispo();
    afficherIndispos();
    afficherListeProfs();
  }""",
"""  if (estDir) {
    bornerDatesAnnee();
    remplirProfsIndispo();
    rafraichirListeAnnulations();
    afficherListeProfs();
  }""",
    1, 'afficherRH : liste des annulations')

# la liste : regles supprimables pour les indisponibilites
rep("""  indispoProfs.forEach(i => {
    if (!dansPeriode(i, dateISO)) return;
    regles.push({ source: 'Indisponibilité', nom: nomProfCode(i.profCode),
      detail: (i.motif || 'Absence') + ' · ' + libellePortee(i.portee), par: i.par });
  });""",
"""  indispoProfs.forEach(i => {
    if (!dansPeriode(i, dateISO)) return;
    regles.push({ source: 'Indisponibilité', id: i.id, supprimable: true, nom: nomProfCode(i.profCode),
      detail: (i.motif || 'Absence') + ' · ' + libellePortee(i.portee), par: i.par });
  });""",
    1, 'liste : indispos supprimables')

rep("""  regles.forEach(r => {
    const item = document.createElement('div');
    item.className = 'bg-gray-50 rounded-lg';
    item.innerHTML = '<p class="font-medium text-gray-700">' + r.nom + ' <span class="tag-avenir">' + r.source + '</span></p>' +
      '<p class="text-xs text-gray-500">' + (r.detail || '') + (r.par ? ' · par ' + r.par : '') + '</p>';
    cont.appendChild(item);
  });""",
"""  regles.forEach(r => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    const bloc = document.createElement('div');
    bloc.innerHTML = '<p class="font-medium text-gray-700">' + r.nom + ' <span class="tag-avenir">' + r.source + '</span></p>' +
      '<p class="text-xs text-gray-500">' + (r.detail || '') + (r.par ? ' · par ' + r.par : '') + '</p>';
    item.appendChild(bloc);
    if (r.supprimable) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-inline flex-shrink-0';
      b.style = 'color: #dc2626;';
      b.innerHTML = '<i class="fas fa-trash"></i>';
      b.onclick = () => supprimerIndispo(r.id);
      item.appendChild(b);
    }
    cont.appendChild(item);
  });""",
    1, 'liste : rendu avec corbeille')

# rafraichissement de la liste apres chaque action
rep("""  sauvegarderSeancesAnnulees();
  afficherAnnulationsDuJour(dateISO);
  afficherToast('Séance annulée', 'success');
  rafraichirApresAnnulation();""",
"""  sauvegarderSeancesAnnulees();
  rafraichirListeAnnulations();
  afficherToast('Séance annulée', 'success');
  rafraichirApresAnnulation();""",
    1, 'confirmerAnnulationSeance : liste rafraichie')

rep("""function retablirSeance(id) {
  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);
  sauvegarderSeancesAnnulees();
  const dateEl = document.getElementById('annul-date');
  afficherAnnulationsDuJour((dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date()));
  afficherToast('Séance rétablie', 'success');""",
"""function retablirSeance(id) {
  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);
  sauvegarderSeancesAnnulees();
  rafraichirListeAnnulations();
  afficherToast('Séance rétablie', 'success');""",
    1, 'retablirSeance : liste rafraichie')

rep("""  sauvegarderIndispo();
  afficherIndispos();
  afficherToast('Indisponibilité ajoutée', 'success');""",
"""  sauvegarderIndispo();
  rafraichirListeAnnulations();
  afficherToast('Indisponibilité ajoutée', 'success');""",
    1, 'enregistrerIndispo : liste rafraichie')

rep("""  indispoProfs = indispoProfs.filter(i => i.id !== id);
  sauvegarderIndispo();
  afficherIndispos();
  afficherToast('Indisponibilité supprimée', 'success');""",
"""  indispoProfs = indispoProfs.filter(i => i.id !== id);
  sauvegarderIndispo();
  rafraichirListeAnnulations();
  if (typeof afficherIndispos === 'function') afficherIndispos();
  afficherToast('Indisponibilité supprimée', 'success');""",
    1, 'supprimerIndispo : liste rafraichie')

# bornes de dates : ajouter le champ de la carte
rep("""  ['annul-date', 'indispo-debut', 'indispo-fin', 'ferm-debut', 'ferm-fin'].forEach(id => {""",
"""  ['annul-date', 'annul-date-card', 'indispo-debut', 'indispo-fin', 'ferm-debut', 'ferm-fin'].forEach(id => {""",
    1, 'bornerDatesAnnee : champ de la carte')

# ══════════════════════════════════════════════════════════════════
# 6. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.62', 'AbsenceTrack v3.63', 1, 'label v3.63')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
