# -*- coding: utf-8 -*-
# patch_v5d.py -> v3.66
# 1. La carte "Seances annulees" (Journee affichee + liste) quitte Gestion pour le Dashboard du directeur,
#    juste sous la premiere carte, et n'affiche QUE les seances annulees (plus les absences des profs)
# 2. Dans RH, les absences du personnel s'affichent en liste deroulante (comme les autres selects)
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
# 1. Retirer le bloc liste de la carte Fermeture (Gestion)
# ══════════════════════════════════════════════════════════════════
rep("""
        <hr class="my-3 border-gray-200">
        <div class="form-group">
          <label>Journée affichée</label>
          <input type="date" id="annul-date-card" onchange="afficherAnnulationsDuJour(this.value)">
        </div>
        <div class="stat-label" style="margin-bottom: 4px;" id="annul-liste-titre">Séances annulées</div>
        <div id="annul-liste" class="space-y-2 liste-reglages"></div>
      </div>""",
"""      </div>""",
    1, 'Gestion : bloc liste retire')

# ══════════════════════════════════════════════════════════════════
# 2. Ajouter la carte "Séances annulées" dans le Dashboard du directeur
# ══════════════════════════════════════════════════════════════════
rep("""      <div id="dir-absences-list"></div>""",
"""      <!-- Seances annulees (journee affichee) -->
      <div class="stat-card mb-4 carte-settings" id="seances-annulees-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-times text-blue-900 mr-2"></i>Séances annulées</h3>
        <div class="form-group">
          <label>Journée affichée</label>
          <input type="date" id="annul-date-card" onchange="afficherSeancesAnnuleesJour(this.value)">
        </div>
        <div id="annul-liste" class="space-y-2 liste-reglages"></div>
      </div>
      <div id="dir-absences-list"></div>""",
    1, 'Dashboard directeur : carte Seances annulees')

# ══════════════════════════════════════════════════════════════════
# 3. RH : absences du personnel en liste deroulante
# ══════════════════════════════════════════════════════════════════
REP_LISTE = """          <div id="%s-liste" class="space-y-2 mt-3 liste-reglages"></div>"""
NOUVELLE_LISTE = """          <div class="form-group">
            <label>Absences enregistrées</label>
            <div class="flex gap-2" style="align-items: center;">
              <select id="%s-liste" class="w-full"></select>
              <button type="button" onclick="supprimerAbsenceSelection('%s-liste')" class="btn-mini-profil" style="border-color: #dc2626; color: #dc2626; flex-shrink: 0;"><i class="fas fa-trash"></i></button>
            </div>
          </div>"""
rep(REP_LISTE % 'abs-surv', NOUVELLE_LISTE % ('abs-surv', 'abs-surv'), 1, 'RH : liste absences surveillants -> select')
rep(REP_LISTE % 'indispo', NOUVELLE_LISTE % ('indispo', 'indispo'), 1, 'RH : liste absences enseignants -> select')

# ══════════════════════════════════════════════════════════════════
# 4. JS : rendu des seances annulees du jour (sans les absences des profs)
# ══════════════════════════════════════════════════════════════════
i1 = s.index('function afficherAnnulationsDuJour(dateISO) {')
i2 = s.index('function confirmerAnnulationSeance() {')
nouveau_rendu = '''function afficherSeancesAnnuleesJour(dateISO) {
  const cont = document.getElementById('annul-liste');
  if (!cont) return;
  const avenir = dateISO > fmtDateISO(new Date());
  const liste = seancesAnnulees.filter(sn => sn.dateISO === dateISO)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  cont.innerHTML = '';
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune séance annulée à cette date.</p>';
    return;
  }
  liste.forEach(sn => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.innerHTML = '<div style="min-width: 0;"><p class="font-medium text-gray-700" style="font-size: 13px;">' + sn.classe + ' · ' + sn.debut + '–' + sn.fin +
      (avenir ? ' <span class="tag-avenir">À venir</span>' : '') + '</p>' +
      '<p class="text-xs text-gray-500">' + (sn.motif || '') + (sn.par ? ' · par ' + sn.par : '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.textContent = 'Rétablir';
    b.onclick = () => retablirSeance(sn.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
}

'''
s = s[:i1] + nouveau_rendu + s[i2:]
print('%-52s OK' % 'JS : afficherSeancesAnnuleesJour')

# rafraichirListeAnnulations -> liste des seances
rep("""function rafraichirListeAnnulations() {
  const el = document.getElementById('annul-date-card');
  if (el && !el.value) el.value = fmtDateISO(new Date());
  afficherAnnulationsDuJour(dateListeAnnulations());
}""",
"""function rafraichirListeAnnulations() {
  const el = document.getElementById('annul-date-card');
  if (el && !el.value) el.value = fmtDateISO(new Date());
  afficherSeancesAnnuleesJour(dateListeAnnulations());
}""",
    1, 'JS : rafraichirListeAnnulations')

# le Dashboard du directeur rafraichit la carte
rep("""  if (page === 'directeur') mettreAJourDashboardDir();""",
"""  if (page === 'directeur') { mettreAJourDashboardDir(); rafraichirListeAnnulations(); }""",
    1, 'Gestion->Dashboard : rafraichissement')

# Gestion n'a plus la liste
rep("""  preparerFormulaireAnnulation();
  rafraichirListeAnnulations();""",
"""  preparerFormulaireAnnulation();""",
    1, 'afficherGestionDir : plus de liste')

# ══════════════════════════════════════════════════════════════════
# 5. JS : absences du personnel dans un select
# ══════════════════════════════════════════════════════════════════
i1 = s.index('function afficherAbsencesPersonnel(idConteneur, role) {')
i2 = s.index('function afficherIndispos() {')
nouvelle_fonction = '''function afficherAbsencesPersonnel(idSelect, role) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const courant = sel.value;
  const liste = indispoProfs.filter(i => roleAbsence(i) === role)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  sel.innerHTML = '';
  if (liste.length === 0) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'Aucune absence enregistrée';
    sel.appendChild(o);
    return;
  }
  liste.forEach(i => {
    const o = document.createElement('option');
    o.value = String(i.id);
    o.textContent = nomProfCode(i.profCode) + ' · ' + dateAffichage(i.debut) +
      (i.fin && i.fin !== i.debut ? ' → ' + dateAffichage(i.fin) : '') + ' · ' + libellePortee(i.portee) +
      (i.motif ? ' · ' + i.motif : '');
    sel.appendChild(o);
  });
  if (courant && liste.some(i => String(i.id) === courant)) sel.value = courant;
}
// Supprimer l'absence selectionnee dans la liste deroulante
function supprimerAbsenceSelection(idSelect) {
  const sel = document.getElementById(idSelect);
  const valeur = sel ? String(sel.value || '') : '';
  const cible = indispoProfs.find(i => String(i.id) === valeur);
  if (!cible) { afficherToast('Aucune absence sélectionnée', 'error'); return; }
  supprimerIndispo(cible.id);
}

'''
s = s[:i1] + nouvelle_fonction + s[i2:]
print('%-52s OK' % 'JS : absences du personnel en select')

# ══════════════════════════════════════════════════════════════════
# 6. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.65', 'AbsenceTrack v3.66', 1, 'label v3.66')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
