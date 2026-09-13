# -*- coding: utf-8 -*-
"""v2 -> verrouiller les absences du jour enregistrees par un autre enseignant."""
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

# ---------- 1. afficherListeEleves : absences du jour = mine (modifiable) / autre prof (verrouille) ----------
newListe = '''function afficherListeEleves() {
  const div = document.getElementById('liste-eleves-enseignant');
  div.innerHTML = '';
  if (!classeSelectionnee) {
    div.innerHTML = '<div class="empty-state py-12"><div class="empty-icon"><i class="fas fa-school"></i></div><p class="text-gray-600">Sélectionnez une classe</p></div>';
    return;
  }
  const tousLesEleves = classeSelectionnee.eleves;
  const todayISO = fmtDateISO(new Date());
  const moi = utilisateurConnecte.nom;

  // Absences du jour dans cette classe, non justifiées
  const absencesClasseAuj = absences.filter(a =>
    a.classe === classeSelectionnee.nom && a.dateISO === todayISO &&
    a.statut !== 'justifie_s' && a.statut !== 'justifie_d'
  );
  // Enregistrées par MOI aujourd'hui (modifiables)…
  const absentsMoi = new Set(absencesClasseAuj.filter(a => a.enseignant === moi).map(a => a.eleveId));
  // …ou par un AUTRE enseignant (verrouillées : l'élève est déjà absent)
  const absentsAutres = new Set(absencesClasseAuj.filter(a => a.enseignant !== moi).map(a => a.eleveId));
  const quiAutre = {};
  absencesClasseAuj.filter(a => a.enseignant !== moi).forEach(a => {
    if (!quiAutre[a.eleveId]) quiAutre[a.eleveId] = a.enseignant;
  });
  // Absences des séances précédentes (AVANT aujourd'hui) → verrouillées
  const absentsPrecedents = new Set(
    absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d')
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
    const msg = filterActive === 'absents' ? 'Aucun élève absent' : filterActive === 'presents' ? 'Tous les élèves sont absents' : 'Aucun élève';
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
    if (parAutre) raison = 'déjà absent · ' + (quiAutre[eleve.id] || 'un autre enseignant');
    else if (precedent) raison = 'séance préc.';

    item.innerHTML = `
      <div class="flex items-center gap-3 flex-1">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${estCoche ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-900'}">${numero}</span>
        <span class="font-medium ${estCoche ? 'text-red-700' : 'text-gray-800'}">${eleve.nom} ${eleve.prenom}</span>
        ${estVerrouille ? '<span class="text-xs text-gray-400 ml-1">(' + raison + ')</span>' : ''}
      </div>
      ${checkboxHTML}
    `;
    div.appendChild(item);
  });
}'''
rx('1-listeEleves', r'function afficherListeEleves\(\) \{.*?\n\}', newListe)

# ---------- 2. gererCoche : interdiction de decocher l'absence d'un autre prof ----------
newGerer = '''function gererCoche(id, coche) {
  if (!coche) {
    const todayISO = fmtDateISO(new Date());
    const enregistreParAutre = absences.some(a =>
      a.eleveId === id && a.classe === classeSelectionnee.nom && a.dateISO === todayISO &&
      a.statut !== 'justifie_s' && a.statut !== 'justifie_d' && a.enseignant !== utilisateurConnecte.nom
    );
    if (enregistreParAutre) {
      afficherToast('Absence enregistrée par un autre enseignant', 'error');
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
    // Supprimer l'absence sauvegardée aujourd'hui pour cet élève
    const todayISO = fmtDateISO(new Date());
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === todayISO && a.classe === classeSelectionnee.nom));
    localStorage.setItem('absences', JSON.stringify(absences));
  }
  mettreAJourCompteur();
  afficherListeEleves();
}'''
rx('2-gererCoche', r'function gererCoche\(id, coche\) \{.*?\n\}', newGerer)

# ---------- 3. version ----------
plain('3-version', 'AbsenceTrack v1.2 \u2014 Prototype', 'AbsenceTrack v1.3 \u2014 Prototype')

# ---------- ecriture + rapport ----------
io.open(OUT, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('absentsAutres', 3), ('absentsMoi', 4), ('quiAutre', 3), ('déjà absent', 2),
                 ('enregistreParAutre', 2), ('checkbox-locked', 1), ('séance préc.', 2)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = os.path.join(os.path.dirname(OUT), '_check4.js')
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
else:
    print('NODE_CHECK skipped (node absent)')
