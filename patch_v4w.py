# -*- coding: utf-8 -*-
# patch_v4w.py -> v3.60 (partie 2/2)
# Cartes (directeur) : fermeture de l'etablissement + indisponibilite d'un enseignant
# + CSS de compactage generalise (.carte-settings)
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
# 1. CSS : compactage generalise sur .carte-settings
# ══════════════════════════════════════════════════════════════════
rep("""    /* Carte Etablissement : compacte pour limiter le defilement */
    #etab-card { padding: 12px 14px; }
    #etab-card h3 { margin-bottom: 8px; }
    #etab-card .form-group { margin-bottom: 8px; }
    #etab-card .form-group label { font-size: 11.5px; margin-bottom: 3px; }
    #etab-card .form-group input, #etab-card .form-group select { padding: 9px 12px; font-size: 14px; border-radius: 10px; }
    #etab-card .sd-trigger { min-height: 38px; padding: 8px 12px; font-size: 14px; }
    #etab-card .grid { gap: 8px; }
    #etab-card hr { margin: 10px 0; }
    #etab-card .sep-titre { margin: 8px 0 4px; }""",
"""    /* Cartes de reglages (etablissement, fermetures, indisponibilites) : compactes */
    .carte-settings { padding: 12px 14px; }
    .carte-settings h3 { margin-bottom: 8px; }
    .carte-settings .form-group { margin-bottom: 8px; }
    .carte-settings .form-group label { font-size: 11.5px; margin-bottom: 3px; }
    .carte-settings .form-group input, .carte-settings .form-group select { padding: 9px 12px; font-size: 14px; border-radius: 10px; }
    .carte-settings .sd-trigger { min-height: 38px; padding: 8px 12px; font-size: 14px; }
    .carte-settings .grid { gap: 8px; }
    .carte-settings hr { margin: 10px 0; }
    .carte-settings .sep-titre { margin: 8px 0 4px; }
    .carte-settings .aide { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .carte-settings .liste-reglages { max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
    .carte-settings .liste-reglages > div { padding: 6px 10px; margin-bottom: 4px; }
    .carte-settings .liste-reglages > div:last-child { margin-bottom: 0; }""",
    1, 'CSS : .carte-settings')

rep("""      <div class="stat-card mb-4" id="etab-card">""",
    """      <div class="stat-card mb-4 carte-settings" id="etab-card">""",
    1, 'etab-card : classe carte-settings')

# ══════════════════════════════════════════════════════════════════
# 2. Cartes HTML : fermeture de l'etablissement + indisponibilite
# ══════════════════════════════════════════════════════════════════
rep("""      <!-- Importer fichier MASSAR -->""",
"""      <!-- Fermeture de l'etablissement -->
      <div class="stat-card mb-4 carte-settings" id="fermeture-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-times text-blue-900 mr-2"></i>Fermeture de l'établissement</h3>
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

      <!-- Indisponibilite d'un enseignant -->
      <div class="stat-card mb-4 carte-settings" id="indispo-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-user-clock text-blue-900 mr-2"></i>Indisponibilité d'un enseignant</h3>
        <p class="aide">Un enseignant absent un ou plusieurs jours : toutes ses séances de la période sont annulées (jours et heures déduits de son tableau de service).</p>
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
          <select id="indispo-portee" class="w-full">
            <option value="journee">Toute la journée</option>
            <option value="matin">Matin seulement</option>
            <option value="apres-midi">Après-midi seulement</option>
          </select>
        </div>
        <div class="form-group">
          <label>Motif</label>
          <select id="indispo-motif" class="w-full">
            <option value="Absence du professeur">Absence du professeur</option>
            <option value="Maladie">Maladie</option>
            <option value="Formation">Formation</option>
            <option value="Mission">Mission</option>
            <option value="Congé">Congé</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <button onclick="enregistrerIndispo()" class="btn-primary w-full btn-ripple"><i class="fas fa-plus"></i> Ajouter l'indisponibilité</button>
        <div id="indispo-liste" class="space-y-2 mt-3 liste-reglages"></div>
      </div>

      <!-- Importer fichier MASSAR -->""",
    1, 'HTML : cartes fermeture + indisponibilite')

# ══════════════════════════════════════════════════════════════════
# 3. JS : renderers + enregistrement / suppression
# ══════════════════════════════════════════════════════════════════
rep("""// ========== PROFESSEURS (liste + renommage, directeur) ==========""",
"""// ========== FERMETURE DE L'ETABLISSEMENT (directeur) ==========
function enregistrerFermeture() {
  if (!utilisateurConnecte || utilisateurConnecte.role !== 'directeur') return;
  const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const type = val('ferm-type') || 'Fermeture';
  const libelle = val('ferm-libelle');
  const debut = val('ferm-debut');
  const fin = val('ferm-fin') || debut;
  const portee = val('ferm-portee') || 'journee';
  if (!debut) { afficherToast('Indiquez la date de début', 'error'); return; }
  if (fin < debut) { afficherToast('La date de fin doit suivre le début', 'error'); return; }
  const b = bornesAnneeScolaire();
  if (debut < b.debut || fin > b.fin) { afficherToast("Période en dehors de l'année scolaire", 'error'); return; }
  fermeturesEtab.push({
    id: Date.now() + Math.random(), type: type, libelle: libelle, debut: debut, fin: fin,
    portee: portee, par: nomApprobateur(), le: fmtDateISO(new Date()) + ' ' + heureMaintenant()
  });
  sauvegarderFermetures();
  const champ = document.getElementById('ferm-libelle');
  if (champ) champ.value = '';
  afficherFermetures();
  afficherToast('Fermeture ajoutée', 'success');
  rafraichirApresAnnulation();
}
function supprimerFermeture(id) {
  fermeturesEtab = fermeturesEtab.filter(f => f.id !== id);
  sauvegarderFermetures();
  afficherFermetures();
  afficherToast('Fermeture supprimée', 'success');
  rafraichirApresAnnulation();
}
function afficherFermetures() {
  const cont = document.getElementById('ferm-liste');
  if (!cont) return;
  cont.innerHTML = '';
  if (fermeturesEtab.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-500 text-center py-1">Aucune fermeture enregistrée.</p>';
    return;
  }
  fermeturesEtab.slice().sort((a, b) => String(a.debut).localeCompare(String(b.debut))).forEach(f => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.innerHTML = '<div><p class="font-medium text-gray-700">' + (f.libelle || f.type) + '</p>' +
      '<p class="text-xs text-gray-500">' + (f.type || '') + ' · ' + dateAffichage(f.debut) +
      (f.fin && f.fin !== f.debut ? ' → ' + dateAffichage(f.fin) : '') + ' · ' + libellePortee(f.portee) + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #dc2626;';
    b.innerHTML = '<i class="fas fa-trash"></i>';
    b.onclick = () => supprimerFermeture(f.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
}

// ========== INDISPONIBILITE D'UN ENSEIGNANT (directeur) ==========
function remplirProfsIndispo() {
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
}
function enregistrerIndispo() {
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
  afficherIndispos();
  afficherToast('Indisponibilité ajoutée', 'success');
  rafraichirApresAnnulation();
}
function supprimerIndispo(id) {
  indispoProfs = indispoProfs.filter(i => i.id !== id);
  sauvegarderIndispo();
  afficherIndispos();
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
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #dc2626;';
    b.innerHTML = '<i class="fas fa-trash"></i>';
    b.onclick = () => supprimerIndispo(i.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
}

// ========== PROFESSEURS (liste + renommage, directeur) ==========""",
    1, 'JS : fermetures + indisponibilites')

# ══════════════════════════════════════════════════════════════════
# 4. Hook Gestion
# ══════════════════════════════════════════════════════════════════
rep("""function afficherGestionDir() {
  afficherParametres();
  afficherListeProfs();""",
"""function afficherGestionDir() {
  afficherParametres();
  bornerDatesAnnee();
  remplirProfsIndispo();
  afficherFermetures();
  afficherIndispos();
  afficherListeProfs();""",
    1, 'afficherGestionDir : nouvelles cartes')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
