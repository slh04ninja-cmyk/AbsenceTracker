# -*- coding: utf-8 -*-
"""v2 -> v1.9 : cartes simplifiees, Derniere modification, retards en orange, carte bas supprimee."""
import re, io, os, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()
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

# ---------- 1. retirer le resume sous le menu deroulant (1re carte) ----------
plain('1-resumeCard',
      '        <div id="classe-resume" class="hidden mt-3 text-sm text-gray-600 text-center"></div>\n',
      '')

# ---------- 2. 2e carte : Derniere modification (compacte) ----------
rx('2-enteteModif',
   r'        <div class="stat-card mb-2">\n          <div class="flex items-center" style="gap: 10px;">.*?\n        </div>\n',
   '''        <div class="stat-card" style="padding: 10px 14px; margin-bottom: 8px;">
          <p class="text-xs text-gray-600" id="derniere-modif">Dernière modification : —</p>
        </div>
''')

# ---------- 3. supprimer la carte du bas (compteur rouge) ----------
rx('3-carteBas',
   r'      <div class="p-4">\n        <div class="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-4 shadow-lg">.*?\n      </div>\n',
   '')

# ---------- 4. compteur -> entete "Derniere modification" ----------
rfn('4-enteteFn', 'mettreAJourCompteur', '''function mettreAJourEnteteListe() {
  const bloc = document.getElementById('derniere-modif');
  if (!bloc) return;
  if (!classeSelectionnee) {
    bloc.textContent = 'Dernière modification : —';
    return;
  }
  const jour = jourCourant();
  const seance = seanceCourante();
  const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance);
  if (incidents.length === 0) {
    bloc.textContent = 'Dernière modification : —';
    return;
  }
  const dernier = incidents[incidents.length - 1];
  bloc.textContent = 'Dernière modification : ' + (dernier.date || dateAffichage(jour)) + ' à ' + (dernier.heure || '—');
}''', r'\(\)')

plain('5-appels1', 'mettreAJourCompteur();', 'mettreAJourEnteteListe();', 4)
plain('6-appels2', 'mettreAJourResumeClasse();', 'mettreAJourEnteteListe();', 2)
rx('7-supprResume', r'function mettreAJourResumeClasse\(\) \{.*?\n\}\n\n', '')

# ---------- 8. liste : retard en orange, absence en rouge ----------
rfn('8-liste', 'afficherListeEleves', '''function afficherListeEleves() {
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
  const typePrecedent = {};
  absences.forEach(a => {
    if (a.classe !== classeSelectionnee.nom) return;
    if (!(a.dateISO < jour)) return;
    if (a.statut === 'justifie_s' || a.statut === 'justifie_d') return;
    if (!typePrecedent[a.eleveId]) typePrecedent[a.eleveId] = a.type || 'absence';
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

    const couleur = cocheRetard ? '#f59e0b' : '#ef4444';
    const fond = cocheRetard ? '#fffbeb' : '#fef2f2';
    const item = document.createElement('div');
    item.className = 'flex items-center px-4 py-3 border-b border-gray-100 transition-all';
    item.style = estCoche ? ('border-left: 5px solid ' + couleur + '; background: ' + fond) : 'border-left: 5px solid transparent';

    const cbA = verrouille
      ? '<input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' disabled class="checkbox-locked">'
      : '<input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;absence&quot;, this.checked)" class="checkbox-material">';
    const cbR = verrouille
      ? '<input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' disabled class="checkbox-locked">'
      : '<input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;retard&quot;, this.checked)" class="checkbox-material">';

    let raison = '';
    if (parAutre) raison = 'déjà signalé · ' + (quiAutre[id] || 'un autre enseignant');
    else if (precedent) raison = 'séance préc.';

    const styleChip = cocheRetard ? 'background: #f59e0b; color: #fff;' : (estCoche ? 'background: #ef4444; color: #fff;' : 'background: #dbeafe; color: #1e3a8a;');
    const styleNom = cocheRetard ? 'color: #b45309; font-weight: 600;' : (estCoche ? 'color: #b91c1c; font-weight: 600;' : 'color: #1f2937;');

    item.innerHTML = `
      <span class="inline-flex items-center justify-center rounded-full text-xs font-bold" style="width: 28px; height: 28px; flex-shrink: 0; margin-right: 10px; ${styleChip}">${numero}</span>
      <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${styleNom}">${libelleEleve(eleve)}${verrouille ? ' <i class="fas fa-lock lock-icon"></i>' : ''}${raison ? ' <span class="text-xs text-gray-400">(' + raison + ')</span>' : ''}</span>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbA}<span class="text-xs font-bold ml-1">A</span></label>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbR}<span class="text-xs font-bold ml-1">R</span></label>
    `;
    div.appendChild(item);
  });
}''')

# ---------- 9. version ----------
plain('9-version', 'AbsenceTrack v1.8 \u2014 Prototype', 'AbsenceTrack v1.9 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('classe-resume', 0), ('count-absents', 0), ('mettreAJourCompteur', 0),
                 ('mettreAJourResumeClasse', 0), ('derniere-modif', 2), ('mettreAJourEnteteListe', 5),
                 ('#f59e0b', 1), ('bg-gradient-to-r from-red-500', 0), ('A : Absent', 0)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check11.js'
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
print('DIVS', data.count('<div'), data.count('</div>'))
