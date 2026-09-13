# -*- coding: utf-8 -*-
# patch_v5j.py -> v3.72
# 1. Toutes les suppressions passent par la confirmation generique
# 2. Les listes d'absences RH s'affichent exactement comme les listes de Gestion (4 cartes)
# 3. Les 3 importations fusionnent dans une seule carte "Importation des fichiers"
# 4. Les tableaux de service et d'eleves acceptent aussi les fichiers FET (.fet, XML) en plus du xlsx
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
# 1. Suppressions avec confirmation
# ══════════════════════════════════════════════════════════════════
rep("""function supprimerFermeture(id) {
  fermeturesEtab = fermeturesEtab.filter(f => f.id !== id);""",
"""// Confirmation avant toute suppression (modale generique)
function confirmerSuppression(message, action) { demanderConfirmation(message, action); }

function supprimerFermeture(id) {
  const cible = fermeturesEtab.find(f => f.id === id);
  if (!cible) return;
  confirmerSuppression('Supprimer la fermeture « ' + (cible.libelle || cible.type || '') + ' » ?', () => vraimentSupprimerFermeture(id));
}
function vraimentSupprimerFermeture(id) {
  fermeturesEtab = fermeturesEtab.filter(f => f.id !== id);""",
    1, 'confirmation : fermeture')

rep("""function supprimerIndispo(id) {
  indispoProfs = indispoProfs.filter(i => i.id !== id);""",
"""function supprimerIndispo(id) {
  const cible = indispoProfs.find(i => String(i.id) === String(id));
  if (!cible) return;
  confirmerSuppression("Supprimer l'absence de " + nomProfCode(cible.profCode) + ' ?', () => vraimentSupprimerIndispo(cible.id));
}
function vraimentSupprimerIndispo(id) {
  indispoProfs = indispoProfs.filter(i => i.id !== id);""",
    1, 'confirmation : absence')

rep("""function retablirSeance(id) {
  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);""",
"""function retablirSeance(id) {
  const cible = seancesAnnulees.find(sn => String(sn.id) === String(id));
  if (!cible) return;
  confirmerSuppression('Rétablir la séance du ' + dateAffichage(cible.dateISO) + ' · ' + cible.classe + ' ' + cible.debut + ' ?',
    () => vraimentRetablirSeance(cible.id));
}
function vraimentRetablirSeance(id) {
  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);""",
    1, 'confirmation : retablir')

rep("""function supprimerAbsence(id) {
  absences = absences.filter(a => a.id !== id);""",
"""function supprimerAbsence(id) {
  const cible = absences.find(a => String(a.id) === String(id));
  confirmerSuppression("Supprimer ce signalement" + (cible && cible.nom ? ' de ' + cible.nom : '') + ' ?',
    () => vraimentSupprimerAbsence(id));
}
function vraimentSupprimerAbsence(id) {
  absences = absences.filter(a => a.id !== id);""",
    1, 'confirmation : signalement')

# ══════════════════════════════════════════════════════════════════
# 2. Listes d'absences RH : meme affichage que les listes de Gestion (4 cartes)
# ══════════════════════════════════════════════════════════════════
rep("""    /* 6 cartes visibles pour les absences du personnel (les autres listes : 4) */
    .js-absences-personnel { max-height: 286px; }
""", "", 1, 'CSS : plus de hauteur specifique RH')

# ══════════════════════════════════════════════════════════════════
# 3. Une seule carte d'importation (3 sous-titres)
# ══════════════════════════════════════════════════════════════════
i_start = s.index('      <!-- Importer fichier MASSAR -->')
i_end = s.index('      <!-- Liste des classes -->')
bloc = s[i_start:i_end]
a1 = bloc.index('<p class="text-sm text-gray-500 mb-3">Uploadez')
a2 = bloc.index('<div id="import-error"')
a2 = bloc.index('</div>', bloc.index('class="hidden mt-3 bg-red-50', a2)) + len('</div>')
piece_massar = bloc[a1:a2]
b1 = bloc.index('<p class="text-sm font-bold text-gray-700 mb-1">Tableaux de service des professeurs</p>')
b2 = bloc.index('<div id="service-preview"')
b2 = bloc.index('</div>', b2) + len('</div>')
piece_service = bloc[b1:b2]
c1 = bloc.index('<p class="text-sm font-bold text-gray-700 mb-1">Tableaux des élèves</p>')
c2 = bloc.index('<div id="tableaux-error"')
c2 = bloc.index('</div>', c2) + len('</div>')
piece_eleves = bloc[c1:c2]
for attendu, piece in [('drop-zone', piece_massar), ('drop-zone-service', piece_service), ('drop-zone-eleves', piece_eleves)]:
    assert attendu in piece, 'piece manquante : ' + attendu
nouvelle_carte = """      <!-- Importation des fichiers -->
      <div class="stat-card mb-4 carte-settings" id="import-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-file-import text-blue-900 mr-2"></i>Importation des fichiers</h3>

        <p class="text-sm font-bold text-gray-700 sep-titre">Importer les listes MASSAR</p>
""" + piece_massar + """
        <p class="text-sm font-bold text-gray-700 sep-titre">Importer les tableaux de services</p>
""" + piece_service.replace('accept=".xlsx,.xls"', 'accept=".xlsx,.xls,.fet"') + """
        <p class="text-sm font-bold text-gray-700 sep-titre">Importer les tableaux d'élèves</p>
""" + piece_eleves.replace('accept=".xlsx,.xls"', 'accept=".xlsx,.xls,.fet"') + """
      </div>

"""
s = s[:i_start] + nouvelle_carte + s[i_end:]
print('%-52s OK' % 'carte Importation des fichiers')

# ══════════════════════════════════════════════════════════════════
# 4. Lecture des fichiers FET (XML) + import
# ══════════════════════════════════════════════════════════════════
rep("""// ========== IMPORT DES TABLEAUX XLSX (page Gestion) ==========""",
"""// ========== LECTURE DES FICHIERS FET (emploi du temps XML) ==========
function normaliserTexte(t) {
  return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
}
const JOURS_FET = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function numeroJourFET(nom, position) {
  const i = JOURS_FET.indexOf(normaliserTexte(nom));
  if (i > 0) return i;                       // 1 = lundi ... 6 = samedi
  return (position >= 0 ? position + 1 : 0); // repli : ordre du fichier
}
function heureFET(txt) {
  const m = String(txt || '').match(/(\\d{1,2})\\s*[:hH]\\s*(\\d{2})?/);
  if (!m) return '';
  return String(parseInt(m[1], 10)).padStart(2, '0') + ':' + String(parseInt(m[2] || '0', 10)).padStart(2, '0');
}
function parserFET(texte) {
  let xml;
  try { xml = new DOMParser().parseFromString(String(texte || ''), 'text/xml'); } catch (e) { return null; }
  if (!xml || xml.querySelector('parsererror') || !xml.querySelector('FET')) return null;
  const txt = el => (el && el.textContent ? el.textContent.trim() : '');
  const jours = Array.from(xml.querySelectorAll('Days_List > Day')).map(txt);
  const heures = Array.from(xml.querySelectorAll('Hours_List > Hour')).map(txt);
  const profs = Array.from(xml.querySelectorAll('Teachers_List > Teacher > Name')).map(txt).filter(Boolean);
  const listeClasses = Array.from(xml.querySelectorAll('Students_List > Students > Name')).map(txt).filter(Boolean);
  const seances = [];
  Array.from(xml.querySelectorAll('Activities_List > Activity')).forEach(act => {
    const prof = txt(act.querySelector('Teacher'));
    const classe = txt(act.querySelector('Students'));
    const matiere = txt(act.querySelector('Subject'));
    const h = parseFloat(txt(act.querySelector('Duration'))) || 0;
    const demi = parseFloat(txt(act.querySelector('Duration_Half_Hours'))) || 0;
    const duree = h || (demi / 2) || 1;
    Array.from(act.querySelectorAll('Activity_Group')).forEach(g => {
      const jourEl = g.querySelector('Day');
      const heureEl = g.querySelector('Hour');
      if (!jourEl || !heureEl) return;
      const nomJour = txt(jourEl);
      const jour = numeroJourFET(nomJour, jours.indexOf(nomJour));
      const debut = heureFET(txt(heureEl));
      if (!jour || !debut) return;
      const finMin = hhmmEnMinutes(debut) + Math.round(duree * 60);
      const fin = String(Math.floor(finMin / 60)).padStart(2, '0') + ':' + String(finMin % 60).padStart(2, '0');
      seances.push({ jour: jour, debut: debut, fin: fin, classe: classe, matiere: matiere, prof: prof, salle: txt(g.querySelector('Room')) });
    });
  });
  return { institution: txt(xml.querySelector('Institution_Name')), jours: jours, heures: heures, profs: profs, classes: listeClasses, seances: seances };
}
function compteDuNomFET(nom) {
  const cible = normaliserTexte(nom);
  if (!cible) return null;
  return comptes.find(c => normaliserTexte(c.nom) === cible) || null;
}
function lireTexteFichier(file) {
  return new Promise(function (resoudre, rejeter) {
    const lecteur = new FileReader();
    lecteur.onload = function () { resoudre(String(lecteur.result || '')); };
    lecteur.onerror = function () { rejeter(new Error('lecture impossible')); };
    lecteur.readAsText(file);
  });
}
function estFichierFET(file) { return /\\.fet$/i.test(String(file && file.name || '')); }

// Tableaux de service depuis un (ou plusieurs) fichier FET
async function importerServicesFET(fichiers) {
  let seances = 0;
  const profsVus = [];
  const inconnus = [];
  const classesCreees = [];
  for (const fichier of fichiers) {
    let parse = null;
    try { parse = parserFET(await lireTexteFichier(fichier)); } catch (e) { parse = null; }
    if (!parse) { afficherToast('Fichier FET illisible : ' + fichier.name, 'error'); continue; }
    const parProf = {};
    parse.seances.forEach(sn => {
      const compte = compteDuNomFET(sn.prof);
      if (!compte || !compte.email) {
        if (sn.prof && inconnus.indexOf(sn.prof) < 0) inconnus.push(sn.prof);
        return;
      }
      parProf[compte.email] = parProf[compte.email] || [];
      if (!parProf[compte.email].some(x => x.jour === sn.jour && x.debut === sn.debut && x.classe === sn.classe)) {
        parProf[compte.email].push({
          jour: sn.jour, debut: sn.debut, fin: sn.fin, classe: sn.classe,
          matiere: sn.matiere || compte.matiere || '', prof: compte.code || '', salle: sn.salle || ''
        });
      }
    });
    Object.keys(parProf).forEach(cle => {
      tableauxService[cle] = parProf[cle];
      if (profsVus.indexOf(cle) < 0) profsVus.push(cle);
      seances += parProf[cle].length;
    });
    parse.classes.forEach(nom => {
      if (!classes.some(c => c.nom === nom)) {
        classes.push({ id: nextClasseId++, nom: nom, eleves: [] });
        classesCreees.push(nom);
      }
    });
  }
  sauvegarderTableauxService();
  if (classesCreees.length) sauvegarderClasses();
  const apercu = document.getElementById('service-preview');
  if (apercu) {
    apercu.classList.remove('hidden');
    apercu.innerHTML = '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
      '<p class="font-bold text-green-800">Fichier FET importé</p>' +
      '<p class="text-sm text-green-700">' + seances + ' séance(s) · ' + profsVus.length + ' professeur(s)' +
      (classesCreees.length ? ' · ' + classesCreees.length + ' classe(s) créée(s)' : '') + '</p>' +
      (inconnus.length ? '<p class="text-xs text-orange-700 mt-2">Professeurs non reconnus (créez leur compte) : ' + inconnus.join(', ') + '</p>' : '') +
      '</div>';
  }
  afficherToast('Tableaux de service importés (FET)', 'success');
}
// Classes depuis un fichier FET (les codes MASSAR ne sont pas dans un FET)
async function importerElevesFET(fichiers) {
  const creees = [];
  for (const fichier of fichiers) {
    let parse = null;
    try { parse = parserFET(await lireTexteFichier(fichier)); } catch (e) { parse = null; }
    if (!parse) { afficherToast('Fichier FET illisible : ' + fichier.name, 'error'); continue; }
    parse.classes.forEach(nom => {
      if (!classes.some(c => c.nom === nom)) {
        classes.push({ id: nextClasseId++, nom: nom, eleves: [] });
        creees.push(nom);
      }
    });
  }
  if (creees.length) sauvegarderClasses();
  const apercu = document.getElementById('eleves-preview');
  if (apercu) {
    apercu.classList.remove('hidden');
    apercu.innerHTML = '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
      '<p class="font-bold text-green-800">Fichier FET importé</p>' +
      '<p class="text-sm text-green-700">' + creees.length + ' classe(s) créée(s)' + (creees.length ? ' : ' + creees.join(', ') : '') + '</p>' +
      '<p class="text-xs text-orange-700 mt-2">Un fichier FET ne contient pas les codes MASSAR ni les élèves : importez le fichier Excel MASSAR pour les noms et les codes.</p>' +
      '</div>';
  }
  afficherToast('Classes importées (FET)', 'success');
}

// ========== IMPORT DES TABLEAUX XLSX (page Gestion) ==========""",
    1, 'JS : lecture FET')

# brancher les 2 imports sur le format FET
rep("""async function importerTableauxService(input) {
  if (!(await xlsxPret())) return;""",
"""async function importerTableauxService(input) {
  const fichiersChoisis = Array.from(input.files || []);
  const fichiersFET = fichiersChoisis.filter(estFichierFET);
  if (fichiersFET.length) {
    await importerServicesFET(fichiersFET);
    if (fichiersFET.length === fichiersChoisis.length) { input.value = ''; return; }
  }
  if (!(await xlsxPret())) return;""",
    1, 'import services : FET')

rep("""async function importerTableauxEleves(input) {
  if (!(await xlsxPret())) return;""",
"""async function importerTableauxEleves(input) {
  const fichiersChoisis = Array.from(input.files || []);
  const fichiersFET = fichiersChoisis.filter(estFichierFET);
  if (fichiersFET.length) {
    await importerElevesFET(fichiersFET);
    if (fichiersFET.length === fichiersChoisis.length) { input.value = ''; return; }
  }
  if (!(await xlsxPret())) return;""",
    1, 'import eleves : FET')

# ══════════════════════════════════════════════════════════════════
# 5. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.71', 'AbsenceTrack v3.72', 1, 'label v3.72')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
