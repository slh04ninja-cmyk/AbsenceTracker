# -*- coding: utf-8 -*-
# patch_v4s.py -> v3.57
# Academie regionale, direction provinciale et annee scolaire en listes deroulantes.
# La direction depend de l'academie choisie (12 academies, 81 directions).
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
# 1. JS : referentiel des academies + directions + listes
# ══════════════════════════════════════════════════════════════════
rep("""function chargerParametres(cle, defaut) {""",
"""// ========== ACADEMIES REGIONALES & DIRECTIONS PROVINCIALES ==========
const ACADEMIES = [
  { nom: 'Tanger-Tétouan-Al Hoceïma', directions: ['Tanger-Assilah', "M'diq-Fnideq", 'Tétouan', 'Fahs-Anjra', 'Larache', 'Chefchaouen', 'Ouazzane', 'Al Hoceïma'] },
  { nom: "L'Oriental", directions: ['Oujda-Angad', 'Nador', 'Berkane', 'Taourirt', 'Jerada', 'Driouch', 'Guercif', 'Figuig'] },
  { nom: 'Fès-Meknès', directions: ['Fès', 'Meknès', 'El Hajeb', 'Ifrane', 'Moulay Yacoub', 'Sefrou', 'Boulemane', 'Taounate', 'Taza'] },
  { nom: 'Rabat-Salé-Kénitra', directions: ['Rabat', 'Salé', 'Skhirate-Témara', 'Kénitra', 'Khémisset', 'Sidi Kacem', 'Sidi Slimane'] },
  { nom: 'Béni Mellal-Khénifra', directions: ['Béni Mellal', 'Azilal', 'Fquih Ben Salah', 'Khénifra', 'Khouribga'] },
  { nom: 'Grand Casablanca-Settat', directions: ['Casablanca-Anfa', 'Al Fida-Mers Sultan', 'Aïn Sebaâ-Hay Mohammadi', 'Hay Hassani', 'Aïn Chock', 'Sidi Bernoussi', "Ben M'sick", 'Moulay Rachid', 'Mohammedia', 'Nouaceur', 'Médiouna', 'Settat', 'Berrechid', 'El Jadida', 'Sidi Bennour'] },
  { nom: 'Marrakech-Safi', directions: ['Marrakech', 'Chichaoua', 'Al Haouz', 'El Kelâa des Sraghna', 'Essaouira', 'Rehamna', 'Safi', 'Youssoufia'] },
  { nom: 'Drâa-Tafilalet', directions: ['Errachidia', 'Ouarzazate', 'Midelt', 'Tinghir', 'Zagora'] },
  { nom: 'Souss-Massa', directions: ['Agadir-Ida Ou Tanane', 'Inezgane-Aït Melloul', 'Chtouka-Aït Baha', 'Taroudannt', 'Tiznit', 'Tata'] },
  { nom: 'Guelmim-Oued Noun', directions: ['Guelmim', 'Assa-Zag', 'Tan-Tan', 'Sidi Ifni'] },
  { nom: 'Laâyoune-Sakia El Hamra', directions: ['Laâyoune', 'Boujdour', 'Tarfaya', 'Es-Semara'] },
  { nom: 'Dakhla-Oued Ed-Dahab', directions: ['Oued Ed-Dahab', 'Aousserd'] }
];
const ANNEES_SCOLAIRES = ['2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029'];
function directionsAcademie(nom) {
  const a = ACADEMIES.find(x => x.nom === String(nom || ''));
  return a ? a.directions.slice() : [];
}
function remplirOptionSelect(select, valeurs, valeurCourante, placeholder) {
  if (!select) return;
  select.innerHTML = '';
  if (placeholder) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    select.appendChild(o);
  }
  valeurs.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
  if (valeurCourante && valeurs.indexOf(valeurCourante) >= 0) select.value = valeurCourante;
}
// La direction provinciale depend de l'academie choisie
function changerAcademie() {
  const selAca = document.getElementById('etab-academie');
  const selDir = document.getElementById('etab-direction');
  if (!selAca || !selDir) return;
  const dirs = directionsAcademie(selAca.value);
  const ancienne = selDir.value;
  remplirOptionSelect(selDir, dirs, dirs.indexOf(ancienne) >= 0 ? ancienne : '', dirs.length === 0 ? '— Choisir une académie —' : '');
}

function chargerParametres(cle, defaut) {""",
    1, 'JS : referentiel academies/directions')

# 2. afficherParametres : listes au lieu des champs libres
rep("""  set('etab-code', etablissement.code);
  set('etab-nom', etablissement.nom);
  set('etab-academie', etablissement.academie);
  set('etab-direction', etablissement.direction);
  set('annee-libelle', anneeScolaire.libelle);""",
"""  set('etab-code', etablissement.code);
  set('etab-nom', etablissement.nom);
  // Academies (liste) puis directions de l'academie choisie (liste dependante)
  remplirOptionSelect(document.getElementById('etab-academie'), ACADEMIES.map(a => a.nom), etablissement.academie, '— Choisir —');
  changerAcademie();
  const selDir = document.getElementById('etab-direction');
  if (selDir && etablissement.direction && directionsAcademie(etablissement.academie).indexOf(etablissement.direction) >= 0) {
    selDir.value = etablissement.direction;
  }
  // Annee scolaire (liste) : on garde toujours la valeur enregistree dans la liste
  const annees = ANNEES_SCOLAIRES.slice();
  if (anneeScolaire.libelle && annees.indexOf(anneeScolaire.libelle) < 0) annees.push(anneeScolaire.libelle);
  remplirOptionSelect(document.getElementById('annee-libelle'), annees, anneeScolaire.libelle, '');""",
    1, 'afficherParametres : listes')

# ══════════════════════════════════════════════════════════════════
# 3. HTML : les 3 champs passent en <select>
# ══════════════════════════════════════════════════════════════════
rep("""        <div class="form-group">
          <label>Académie</label>
          <input type="text" id="etab-academie" placeholder="ex. Académie régionale de Casablanca-Settat">
        </div>
        <div class="form-group">
          <label>Direction provinciale</label>
          <input type="text" id="etab-direction" placeholder="ex. Direction provinciale de Settat">
        </div>""",
"""        <div class="form-group">
          <label>Académie régionale</label>
          <select id="etab-academie" class="w-full" onchange="changerAcademie()"></select>
        </div>
        <div class="form-group">
          <label>Direction provinciale</label>
          <select id="etab-direction" class="w-full"></select>
        </div>""",
    1, 'HTML : academie + direction en listes')

rep("""        <div class="form-group">
          <label>Année scolaire</label>
          <input type="text" id="annee-libelle" placeholder="2026-2027">
        </div>""",
"""        <div class="form-group">
          <label>Année scolaire</label>
          <select id="annee-libelle" class="w-full"></select>
        </div>""",
    1, 'HTML : annee scolaire en liste')

# ══════════════════════════════════════════════════════════════════
# 4. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.56', 'AbsenceTrack v3.57', 1, 'label v3.57')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
