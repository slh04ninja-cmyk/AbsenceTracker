# -*- coding: utf-8 -*-
"""v2 -> v1.8 : carte saisie supprimee, seance auto, cases A/R par eleve."""
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

# ---------- 1. supprimer les filtres Tous / Presents / Signales ----------
rx('1-toolbar', r'\n        <div id="toolbar-filtres" class="toolbar">.*?</div>\n', '\n')

# ---------- 2. remplacer la carte de saisie par l'entete N° / Nom / A / R ----------
rx('2-entete',
   r'        <div class="stat-card mb-3">\n          <div class="grid grid-cols-2 gap-3">.*?\n        </div>\n',
   '''        <div class="stat-card mb-2">
          <div class="flex items-center" style="gap: 10px;">
            <span class="text-xs font-bold text-blue-900" style="width: 28px; flex-shrink: 0;">N°</span>
            <span class="text-xs font-bold text-blue-900" style="flex: 1;">Nom</span>
            <span class="text-xs font-bold text-blue-900" style="width: 46px; text-align: center; flex-shrink: 0;">A</span>
            <span class="text-xs font-bold text-blue-900" style="width: 46px; text-align: center; flex-shrink: 0;">R</span>
          </div>
          <p class="text-xs text-gray-500 mt-2">A : Absent · R : Retard</p>
        </div>
''')

# ---------- 3. variables : suppression date/seance/type/duree + filterActive ----------
plain('3-vars',
      """let classeSelectionnee = null;
let dateSelectionnee = null;
let seanceSelectionnee = 'matin';
let typeSaisie = 'absence';
let dureeSaisie = '';
""",
      """let classeSelectionnee = null;
""")
plain('4-filterActive', "let filterActive = 'all';\n", '')

# ---------- 5. seanceActuelle -> jourCourant / seanceCourante ----------
rx('5-seanceActuelle',
   r"\nfunction seanceActuelle\(\) \{\n  return new Date\(\)\.getHours\(\) < 12 \? 'matin' : 'apres-midi';\n\}\n",
   '\n')
rx('6-blocSaisie',
   r"// ========== SAISIE : date / seance / type / duree ==========.*?function changerDureeSaisie\(\) \{.*?\n\}",
   """// ========== DATE & SEANCE (automatiques) ==========
function jourCourant() {
  return fmtDateISO(new Date());
}

function seanceCourante() {
  // Test : 00-12 = Matin, 13-23 = Apres-midi   (production : 08-12 / 14-18)
  return new Date().getHours() <= 12 ? 'matin' : 'apres-midi';
}""")

# ---------- 7. choisirClasse : plus de filtres ni d'UI de saisie ----------
plain('7-choisirClasse',
      """  if (!id) {
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    filterActive = 'all';
    document.getElementById('ens-classe-name').textContent = 'Sélectionnez une classe';""",
      """  if (!id) {
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    document.getElementById('ens-classe-name').textContent = 'Sélectionnez une classe';""")
plain('8-choisirClasse2',
      """    if (classeSelectionnee) {
      elevesCoches.clear();
      decochesManuellement.clear();
      filterActive = 'all';
      const chips = document.querySelectorAll('#toolbar-filtres .filter-chip');
      chips.forEach(c => c.classList.remove('active'));
      if (chips[0]) chips[0].classList.add('active');
    }""",
      """    if (classeSelectionnee) {
      elevesCoches.clear();
      decochesManuellement.clear();
    }""")
plain('9-choisirClasse3',
      "  if (zone) zone.classList.remove('hidden');\n  appliquerSaisieUI();\n  afficherListeEleves();",
      "  if (zone) zone.classList.remove('hidden');\n  afficherListeEleves();")

# ---------- 10. resetSaisie supprime des appels ----------
plain('10-deco', "  afficherInfosProf();\n  resetSaisie();", "  afficherInfosProf();")
plain('11-login', "    afficherInfosProf();\n    resetSaisie();", "    afficherInfosProf();")
plain('12-init', "afficherInfosProf(); resetSaisie(); }", "afficherInfosProf(); }")

# ---------- 13. elevesCoches : Set -> Map (id -> type) ----------
plain('13-map', 'let elevesCoches = new Set();', 'let elevesCoches = new Map(); // id eleve -> type (absence / retard)')

# ---------- 14. liste : une ligne par eleve avec A et R ----------
rfn('14-liste', 'afficherListeEleves', '''function afficherListeEleves() {
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

    const cocheAbsent = marque !== null && marque !== 'retard';
    const cocheRetard = marque === 'retard';
    const estCoche = cocheAbsent || cocheRetard;
    const numero = tousLesEleves.findIndex(e => e.id === id) + 1;

    const item = document.createElement('div');
    item.className = 'flex items-center px-4 py-3 border-b border-gray-100 transition-all';
    item.style = estCoche ? 'border-left: 5px solid #ef4444; background: #fef2f2' : 'border-left: 5px solid transparent';

    const cbA = verrouille
      ? '<input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' disabled class="checkbox-locked">'
      : '<input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;absence&quot;, this.checked)" class="checkbox-material">';
    const cbR = verrouille
      ? '<input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' disabled class="checkbox-locked">'
      : '<input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;retard&quot;, this.checked)" class="checkbox-material">';

    let raison = '';
    if (parAutre) raison = 'déjà signalé · ' + (quiAutre[id] || 'un autre enseignant');
    else if (precedent) raison = 'séance préc.';

    item.innerHTML = `
      <span class="inline-flex items-center justify-center rounded-full text-xs font-bold ${estCoche ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-900'}" style="width: 28px; height: 28px; flex-shrink: 0; margin-right: 10px;">${numero}</span>
      <span class="font-medium ${estCoche ? 'text-red-700' : 'text-gray-800'}" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${libelleEleve(eleve)}${verrouille ? ' <i class="fas fa-lock lock-icon"></i>' : ''}${raison ? ' <span class="text-xs text-gray-400">(' + raison + ')</span>' : ''}</span>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbA}<span class="text-xs font-bold ml-1">A</span></label>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbR}<span class="text-xs font-bold ml-1">R</span></label>
    `;
    div.appendChild(item);
  });
}''')

# ---------- 15. basculerMarque (remplace gererCoche) ----------
rfn('15-basculer', 'gererCoche', '''function basculerMarque(id, type, coche) {
  const jour = jourCourant();
  const seance = seanceCourante();
  if (!coche) {
    const enregistreParAutre = absences.some(a =>
      a.eleveId === id && a.classe === classeSelectionnee.nom && a.dateISO === jour &&
      (a.seance || 'matin') === seance &&
      a.statut !== 'justifie_s' && a.statut !== 'justifie_d' && a.enseignant !== utilisateurConnecte.nom
    );
    if (enregistreParAutre) {
      afficherToast('Signalement enregistré par un autre enseignant', 'error');
      afficherListeEleves();
      return;
    }
    elevesCoches.delete(id);
    decochesManuellement.add(id);
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom));
    localStorage.setItem('absences', JSON.stringify(absences));
  } else {
    // Un seul type à la fois : on remplace mon enregistrement du jour (même séance)
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom && a.enseignant === utilisateurConnecte.nom));
    localStorage.setItem('absences', JSON.stringify(absences));
    decochesManuellement.delete(id);
    elevesCoches.set(id, type);
  }
  mettreAJourCompteur();
  afficherListeEleves();
}''')

# ---------- 16. confirmation ----------
rfn('16-confirmation', 'afficherConfirmationAbsences', '''function afficherConfirmationAbsences() {
  if (elevesCoches.size === 0) {
    afficherToast('Cochez au moins un élève', 'error');
    return;
  }
  document.getElementById('message-confirmation').textContent =
    'Enregistrer ' + elevesCoches.size + ' signalement(s) — ' + dateAffichage(jourCourant()) + ' (' + libelleSeance(seanceCourante()) + ') ?';
  document.getElementById('modal-confirmation').classList.remove('hidden');
}''')

# ---------- 17. enregistrement ----------
rfn('17-confirmer', 'confirmerAbsences', '''function confirmerAbsences() {
  const now = new Date();
  const heure = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const jour = jourCourant();
  const seance = seanceCourante();

  elevesCoches.forEach((type, idEleve) => {
    if (decochesManuellement.has(idEleve)) return;
    const dejaSauve = absences.find(a => a.eleveId === idEleve && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom);
    if (dejaSauve) return;
    const eleve = classeSelectionnee.eleves.find(e => e.id === idEleve);
    if (!eleve) return;
    absences.push({
      id: Date.now() + Math.random(),
      eleveId: eleve.id,
      nom: libelleEleve(eleve),
      classe: classeSelectionnee.nom,
      heure: heure,
      date: dateAffichage(jour),
      dateISO: jour,
      seance: seance,
      type: type || 'absence',
      duree: '',
      statut: 'absent',
      enseignant: utilisateurConnecte.nom,
      matiere: utilisateurConnecte.matiere
    });
  });

  localStorage.setItem('absences', JSON.stringify(absences));
  document.getElementById('modal-confirmation').classList.add('hidden');
  afficherToast('Signalement(s) enregistré(s) !', 'success');
  elevesCoches.clear();
  afficherListeEleves();
  mettreAJourCompteur();
}''')

# ---------- 18. compteur ----------
rfn('18-compteur', 'mettreAJourCompteur', '''function mettreAJourCompteur() {
  if (classeSelectionnee) {
    const jour = jourCourant();
    const seance = seanceCourante();
    const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const precedents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < jour && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const total = Math.max(elevesCoches.size + precedents, incidents + precedents);
    document.getElementById('count-absents').textContent = total;
  }
  mettreAJourResumeClasse();
}''', r'\(\)')

# ---------- 19. resume ----------
rfn('19-resume', 'mettreAJourResumeClasse', '''function mettreAJourResumeClasse() {
  const bloc = document.getElementById('classe-resume');
  if (!bloc) return;
  if (!classeSelectionnee) {
    bloc.classList.add('hidden');
    bloc.textContent = '';
    return;
  }
  const jour = jourCourant();
  const seance = seanceCourante();
  const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance && a.statut !== 'justifie_s' && a.statut !== 'justifie_d');
  const mesSaisies = utilisateurConnecte ? incidents.filter(a => a.enseignant === utilisateurConnecte.nom) : [];
  const derniere = mesSaisies.length ? mesSaisies[mesSaisies.length - 1].heure : null;
  let txt = classeSelectionnee.eleves.length + ' élèves · ' + incidents.length + ' signalé(s) le ' + dateAffichage(jour) + ' (' + libelleSeance(seance) + ')';
  if (derniere) txt += ' · dernière saisie à ' + derniere;
  bloc.textContent = txt;
  bloc.classList.remove('hidden');
}''', r'\(\)')

# ---------- 20. supprimer filterEleves ----------
rx('20-filterEleves', r"function filterEleves\(type, el\) \{.*?\n\}\n\n", '')

# ---------- 21. version ----------
plain('21-version', 'AbsenceTrack v1.7 \u2014 Prototype', 'AbsenceTrack v1.8 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('filterActive', 0), ('count-total', 0), ('gererCoche', 0), ('filterEleves', 0),
                 ('dateSelectionnee', 0), ('seanceSelectionnee', 0), ('typeSaisie', 0), ('dureeSaisie', 0),
                 ('saisie-', 0), ('toolbar-filtres', 0), ('resetSaisie', 0), ('appliquerSaisieUI', 0),
                 ('seanceActuelle', 0), ('basculerMarque', 3), ('jourCourant', 6), ('seanceCourante', 5),
                 ('elevesCoches = new Map', 1), ('A : Absent', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check10.js'
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
print('DIVS', data.count('<div'), data.count('</div>'))
