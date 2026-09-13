# -*- coding: utf-8 -*-
# patch_v5e.py -> v3.67
# 1. "Seances annulees" : plus de "Journee affichee", tri de la plus proche a la plus lointaine, 4 cartes
#    avant defilement, et la meme carte est ajoutee au Dashboard du surveillant
# 2. RH : les absences du personnel reprennent l'affichage en cartes (identique aux seances annulees)
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
# 1. Dashboard directeur : carte sans "Journee affichee" + classe js-seances-annulees
# ══════════════════════════════════════════════════════════════════
rep("""      <!-- Seances annulees (journee affichee) -->
      <div class="stat-card mb-4 carte-settings" id="seances-annulees-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-times text-blue-900 mr-2"></i>Séances annulées</h3>
        <div class="form-group">
          <label>Journée affichée</label>
          <input type="date" id="annul-date-card" onchange="afficherSeancesAnnuleesJour(this.value)">
        </div>
        <div id="annul-liste" class="space-y-2 liste-reglages"></div>
      </div>""",
"""      <!-- Seances annulees (de la plus proche a la plus lointaine) -->
      <div class="stat-card mb-4 carte-settings" id="seances-annulees-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-times text-blue-900 mr-2"></i>Séances annulées</h3>
        <div id="annul-liste" class="js-seances-annulees"></div>
      </div>""",
    1, 'Dashboard dir : carte simplifiee')

# ══════════════════════════════════════════════════════════════════
# 2. Dashboard surveillant : meme carte
# ══════════════════════════════════════════════════════════════════
rep("""      <div id="surv-absences-list"></div>""",
"""      <!-- Seances annulees (comme sur le Dashboard du directeur) -->
      <div class="stat-card mb-4 carte-settings" id="seances-annulees-card-surv">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-times text-blue-900 mr-2"></i>Séances annulées</h3>
        <div id="annul-liste-surv" class="js-seances-annulees"></div>
      </div>
      <div id="surv-absences-list"></div>""",
    1, 'Dashboard surv : carte seances annulees')

# ══════════════════════════════════════════════════════════════════
# 3. RH : retour a des listes de cartes (meme rendu que les seances annulees)
# ══════════════════════════════════════════════════════════════════
REP_SEL = """          <div class="form-group">
            <label>Absences enregistrées</label>
            <div class="flex gap-2" style="align-items: center;">
              <select id="%s-liste" class="w-full"></select>
              <button type="button" onclick="supprimerAbsenceSelection('%s-liste')" class="btn-mini-profil" style="border-color: #dc2626; color: #dc2626; flex-shrink: 0;"><i class="fas fa-trash"></i></button>
            </div>
          </div>"""
REP_DIV = """          <div class="stat-label" style="margin-bottom: 4px;">Absences enregistrées</div>
          <div id="%s-liste" class="js-absences-personnel"></div>"""
rep(REP_SEL % ('abs-surv', 'abs-surv'), REP_DIV % 'abs-surv', 1, 'RH surveillants : cartes')
rep(REP_SEL % ('indispo', 'indispo'), REP_DIV % 'indispo', 1, 'RH enseignants : cartes')

# ══════════════════════════════════════════════════════════════════
# 4. CSS : listes de 4 cartes (44px) + cartes communes
# ══════════════════════════════════════════════════════════════════
rep("""    #seances-annulees-card #annul-liste {
      max-height: 168px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px;
    }
    body.theme-sombre #seances-annulees-card #annul-liste { background: #0f172a; border-color: #334155; }
    #seances-annulees-card #annul-liste > div { padding: 6px 10px; margin-bottom: 4px; }
    #seances-annulees-card #annul-liste > div:last-child { margin-bottom: 0; }""",
"""    /* Listes de cartes facon "Seances annulees" : 4 cartes visibles avant defilement */
    .js-seances-annulees, .js-absences-personnel {
      max-height: 190px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px;
    }
    body.theme-sombre .js-seances-annulees, body.theme-sombre .js-absences-personnel { background: #0f172a; border-color: #334155; }
    .js-seances-annulees > div, .js-absences-personnel > div {
      height: var(--carte-ligne-h); box-sizing: border-box; padding: 0 10px; margin-bottom: 4px; gap: 8px;
    }
    .js-seances-annulees > div:last-child, .js-absences-personnel > div:last-child { margin-bottom: 0; }
    .carte-ligne-titre { font-size: 13px; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .carte-ligne-sous { font-size: 11.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    body.theme-sombre .carte-ligne-titre { color: #e2e8f0; }
    body.theme-sombre .carte-ligne-sous { color: #94a3b8; }""",
    1, 'CSS : listes de 4 cartes')

rep("""      --btn-h: 44px;""", """      --btn-h: 44px;
      --carte-ligne-h: 44px;""", 1, 'CSS : hauteur de ligne')

# ══════════════════════════════════════════════════════════════════
# 5. JS : rendu unique des cartes + tri + 2 dashboards
# ══════════════════════════════════════════════════════════════════
i1 = s.index('function afficherSeancesAnnuleesJour(dateISO) {')
i2 = s.index('function confirmerAnnulationSeance() {')
nouveau = '''// Carte de liste commune (meme rendu pour les seances annulees et les absences du personnel)
function carteLigne(titre, sousTitre, action) {
  const item = document.createElement('div');
  item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
  const bloc = document.createElement('div');
  bloc.style = 'min-width: 0; flex: 1;';
  const p1 = document.createElement('p');
  p1.className = 'carte-ligne-titre';
  p1.innerHTML = titre;
  const p2 = document.createElement('p');
  p2.className = 'carte-ligne-sous';
  p2.innerHTML = sousTitre;
  bloc.appendChild(p1);
  bloc.appendChild(p2);
  item.appendChild(bloc);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-inline flex-shrink-0';
    b.style = 'color: ' + (action.couleur || '#1d4ed8') + ';';
    b.innerHTML = action.icone || false;
    if (action.texte) b.textContent = action.texte;
    b.onclick = action.onclick;
    item.appendChild(b);
  }
  return item;
}

// Ordre : de la plus proche a la plus lointaine (les seances a venir d'abord, puis les passees recentes)
function trierSeancesAnnulees() {
  const auj = fmtDateISO(new Date());
  return seancesAnnulees.slice().sort((a, b) => {
    const da = String(a.dateISO || '');
    const db = String(b.dateISO || '');
    const fa = da > auj;
    const fb = db > auj;
    if (fa !== fb) return fa ? -1 : 1;
    if (da !== db) return fa ? da.localeCompare(db) : db.localeCompare(da);
    return String(a.debut || '').localeCompare(String(b.debut || ''));
  });
}
// Remplit TOUTES les cartes "Seances annulees" (Dashboard directeur + surveillant)
function afficherSeancesAnnulees() {
  const conteneurs = document.querySelectorAll('.js-seances-annulees');
  const auj = fmtDateISO(new Date());
  const liste = trierSeancesAnnulees();
  for (let i = 0; i < conteneurs.length; i++) {
    const cont = conteneurs[i];
    cont.innerHTML = '';
    if (liste.length === 0) {
      cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune séance annulée.</p>';
      continue;
    }
    liste.forEach(sn => {
      const jour = String(sn.dateISO || '');
      const titre = dateAffichage(jour) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
        (jour > auj ? ' <span class="tag-avenir">À venir</span>' : '');
      const sous = (sn.motif || '') + (sn.par ? ' · par ' + sn.par : '');
      cont.appendChild(carteLigne(titre, sous, { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
    });
  }
}
function rafraichirListeAnnulations() { afficherSeancesAnnulees(); }

'''
s = s[:i1] + nouveau + s[i2:]
print('%-52s OK' % 'JS : afficherSeancesAnnulees + carteLigne')

# appels : remplacer les anciens rafraichissements/dated
s = s.replace("afficherSeancesAnnuleesJour(dateListeAnnulations());", "afficherSeancesAnnulees();")
s = s.replace("""function dateListeAnnulations() {
  const el = document.getElementById('annul-date-card');
  return (el && el.value) ? el.value : fmtDateISO(new Date());
}
""", "")
print('%-52s OK' % 'JS : appels mis a jour')

rep("""  if (page === 'directeur') { mettreAJourDashboardDir(); rafraichirListeAnnulations(); }""",
"""  if (page === 'directeur') { mettreAJourDashboardDir(); afficherSeancesAnnulees(); }""",
    1, 'switchDirPage : rendu des seances')

# Dashboard surveillant : rendu aussi
i = s.index('function mettreAJourDashboardSurv()')
j = s.index('{', i) + 1
s = s[:j] + "\n  afficherSeancesAnnulees();" + s[j:]
print('%-52s OK' % 'mettreAJourDashboardSurv : rendu')

# plus de champ date a borner
rep("""  ['annul-date', 'annul-date-card', 'indispo-debut', 'indispo-fin', 'abs-surv-debut', 'abs-surv-fin', 'ferm-debut', 'ferm-fin'].forEach(id => {""",
"""  ['annul-date', 'indispo-debut', 'indispo-fin', 'abs-surv-debut', 'abs-surv-fin', 'ferm-debut', 'ferm-fin'].forEach(id => {""",
    1, 'bornerDatesAnnee : sans annul-date-card')

# apres une annulation : plus de champ "journee affichee"
rep("""  sauvegarderSeancesAnnulees();
  const champJour = document.getElementById('annul-date-card');
  if (champJour) champJour.value = dateISO;
  rafraichirListeAnnulations();
  afficherToast('Séance annulée', 'success');""",
"""  sauvegarderSeancesAnnulees();
  afficherSeancesAnnulees();
  afficherToast('Séance annulée', 'success');""",
    1, 'confirmerAnnulationSeance : rendu')

# ══════════════════════════════════════════════════════════════════
# 6. JS : absences du personnel en cartes (meme rendu)
# ══════════════════════════════════════════════════════════════════
i1 = s.index('function afficherAbsencesPersonnel(idSelect, role) {')
i2 = s.index('function afficherIndispos() {')
nouvelle = '''function afficherAbsencesPersonnel(idConteneur, role) {
  const cont = document.getElementById(idConteneur);
  if (!cont) return;
  const liste = indispoProfs.filter(i => roleAbsence(i) === role)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  cont.innerHTML = '';
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune absence enregistrée.</p>';
    return;
  }
  liste.forEach(i => {
    const titre = nomProfCode(i.profCode) + ' · ' + dateAffichage(i.debut) +
      (i.fin && i.fin !== i.debut ? ' → ' + dateAffichage(i.fin) : '') + ' · ' + libellePortee(i.portee);
    cont.appendChild(carteLigne(titre, i.motif || '', {
      icone: '<i class="fas fa-trash"></i>', couleur: '#dc2626', onclick: () => supprimerIndispo(i.id)
    }));
  });
}

'''
s = s[:i1] + nouvelle + s[i2:]
print('%-52s OK' % 'JS : absences du personnel en cartes')

# ══════════════════════════════════════════════════════════════════
# 7. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.66', 'AbsenceTrack v3.67', 1, 'label v3.67')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
