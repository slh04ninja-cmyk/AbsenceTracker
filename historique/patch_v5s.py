# -*- coding: utf-8 -*-
"""patch_v5s.py -> v3.80

Un eleve qui quitte l'etablissement ne doit plus etre un probleme :
  1. STATUT « SORTI » : il disparait de l'appel du jour mais garde TOUT son historique ;
     il reste visible dans Gestion (badge) et peut etre RETABLI.
  2. SUPPRESSION SANS PERTE : supprimer un eleve n'efface PLUS ses signalements
     (avant, `absences.filter(...)` les detruisait — une perte de donnees silencieuse).
  3. DETECTION A L'IMPORT : les eleves inscrits qui ne figurent plus dans le fichier
     importe sont PROPOSES comme « sortis » (confirmation explicite, jamais silencieux),
     et uniquement dans les classes PRESENTES dans le fichier (un import partiel ne
     touche pas les autres classes).
"""
import io, re, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
ok = True

def sub(ancien, nouveau, label, attendu=1):
    global html, ok
    n = html.count(ancien)
    if n != attendu:
        print('!! %s : %d occurrence(s) (attendu %d)' % (label, n, attendu)); ok = False; return
    html = html.replace(ancien, nouveau)
    print('OK %s' % label)

# ============================================================================
# 1. JS — le statut « sorti » (helpers)
# ============================================================================
helpers = r'''
// ========== ÉLÈVES « SORTIS » (a quitte l'etablissement) ==========
// Un eleve marque sorti (actif === false) n'apparait plus dans l'appel du jour, mais il
// garde TOUT son historique (ses absences/retards restent consultables) et il peut etre
// RETABLI. On ne supprime donc plus un eleve pour le retirer des listes.
// (Le champ `actif` est deja prevu dans la base : c'est la meme semantique.)
function estSorti(e) { return !!e && e.actif === false; }

function elevesActifs(classe) {
  const liste = (classe && classe.eleves) ? classe.eleves : [];
  return liste.filter(e => !estSorti(e));
}

function marquerEleveSorti(classeId, eleveId, sorti) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  if (sorti) el.actif = false; else delete el.actif;
  sauvegarderClasses();
  if (classeDetailCourante === classeId) ouvrirDetailClasse(classeId);
  mettreAJourDashboardDir();
  if (classeSelectionnee && classeSelectionnee.id === classeId) afficherListeEleves();
  afficherToast(sorti ? 'Élève marqué sorti (historique conservé)' : 'Élève rétabli', 'success');
}
'''
# on insere les helpers juste avant la fonction de suppression d'eleve
sub("""// Suppression d'un eleve : confirmation obligatoire avant d'appliquer""",
    helpers.strip() + """

// Suppression d'un eleve : confirmation obligatoire avant d'appliquer""",
    'helpers sorti/rétabli')

# ============================================================================
# 2. L'appel du jour ne montre plus les eleves sortis
# ============================================================================
sub("""  if (!classeSelectionnee) return;
  const tousLesEleves = classeSelectionnee.eleves;""",
"""  if (!classeSelectionnee) return;
  // les eleves sortis ne figurent PLUS dans l'appel du jour (leur historique est intact)
  const tousLesEleves = elevesActifs(classeSelectionnee);""",
    'appel du jour : sortis masqués')

# ============================================================================
# 3. Supprimer un eleve n'efface PLUS son historique
# ============================================================================
sub("""function supprimerEleve(classeId, eleveId) {
  const classe = classes.find(c => c.id === classeId);
  if (!classe) return;
  classe.eleves = classe.eleves.filter(e => e.id !== eleveId);
  absences = absences.filter(a => !(a.eleveId === eleveId && a.classe === classe.nom));
  localStorage.setItem('absences', JSON.stringify(absences));
  sauvegarderClasses();""",
"""function supprimerEleve(classeId, eleveId) {
  const classe = classes.find(c => c.id === classeId);
  if (!classe) return;
  classe.eleves = classe.eleves.filter(e => e.id !== eleveId);
  // LES SIGNALEMENTS SONT CONSERVES : ils portent le nom, la classe et la date, donc
  // l'historique de l'annee reste consultable. Avant, cette ligne les effacait :
  // supprimer un eleve detruisait son dossier sans que rien ne le dise.
  sauvegarderClasses();""",
    'suppression sans perte de l historique')

# le message de confirmation dit maintenant la verite
sub("""  demanderConfirmation('Supprimer ' + libelleEleve(el) + ' de la classe ' + cl.nom + ' ?', function () {""",
"""  demanderConfirmation('Supprimer définitivement ' + libelleEleve(el) + ' de la classe ' + cl.nom +
    ' ? Son historique de signalements est conservé. Pour un élève qui a quitté l\\'établissement, préférez « Marquer sorti ».',
    function () {""",
    'message de confirmation honnête')

# ============================================================================
# 4. Gestion : badge « sorti » + bouton pour marquer/retablir
# ============================================================================
sub("""  const elevesDiv = document.getElementById('detail-classe-eleves');
  if (cl.eleves.length === 0) {
    elevesDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun élève</p>';
  } else {
    elevesDiv.innerHTML = cl.eleves.map(e =>
      `<div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
        <div>
          <span class="font-medium">${libelleEleve(e)}</span>
          ${e.massar ? '<span class="text-xs text-gray-400 ml-2">(' + e.massar + ')</span>' : ''}
        </div>
        <button onclick="demanderSuppressionEleve(${cl.id}, ${e.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button>
      </div>`
    ).join('');
  }""",
"""  const elevesDiv = document.getElementById('detail-classe-eleves');
  if (cl.eleves.length === 0) {
    elevesDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun élève</p>';
  } else {
    const sortis = cl.eleves.filter(estSorti).length;
    elevesDiv.innerHTML = '<p class="text-xs text-gray-500 mb-2">' + (cl.eleves.length - sortis) + ' élève(s) actif(s)' +
      (sortis ? ' · ' + sortis + ' sorti(s) (masqués à l\\'appel)' : '') + '</p>' +
      cl.eleves.map(e =>
      `<div class="flex justify-between items-center p-3 rounded-lg mb-2" style="${estSorti(e) ? 'background:#f1f5f9;opacity:0.75;' : 'background:#f9fafb;'}">
        <div>
          <span class="font-medium">${libelleEleve(e)}</span>
          ${e.massar ? '<span class="text-xs text-gray-400 ml-2">(' + e.massar + ')</span>' : ''}
          ${estSorti(e) ? '<span class="text-xs font-bold ml-2" style="color:#b45309;background:#fef3c7;border-radius:999px;padding:1px 8px;">sorti</span>' : ''}
        </div>
        <div class="flex items-center gap-3">
          <button onclick="marquerEleveSorti(${cl.id}, ${e.id}, ${estSorti(e) ? 'false' : 'true'})" class="text-xs font-bold" style="color:${estSorti(e) ? '#16a34a' : '#475569'};">
            <i class="fas ${estSorti(e) ? 'fa-rotate-left' : 'fa-user-slash'}"></i> ${estSorti(e) ? 'Rétablir' : 'Marquer sorti'}
          </button>
          <button onclick="demanderSuppressionEleve(${cl.id}, ${e.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`
    ).join('');
  }""",
    'Gestion : badge sorti + marquer/rétablir')

# ============================================================================
# 5. Import : proposer comme « sortis » les eleves qui ne figurent plus dans le fichier
# ============================================================================
sub("""  importEleves.classes.forEach(c => {
    let cl = classes.find(x => x.nom === c.classe);
    if (!cl) { cl = { id: nextClasseId++, nom: c.classe, eleves: [] }; classes.push(cl); nouvelles++; }
    c.eleves.forEach(e => {
      const dejaLa = e.massar && cl.eleves.some(x => String(x.massar || '') === String(e.massar));
      if (dejaLa) { ignores++; return; }
      cl.eleves.push({ id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomArabe || '', prenom: '' });
      ajoutes++;
    });
  });
  sauvegarderClasses();""",
"""  const aSortir = [];
  importEleves.classes.forEach(c => {
    let cl = classes.find(x => x.nom === c.classe);
    if (!cl) { cl = { id: nextClasseId++, nom: c.classe, eleves: [] }; classes.push(cl); nouvelles++; }
    c.eleves.forEach(e => {
      const dejaLa = e.massar && cl.eleves.some(x => String(x.massar || '') === String(e.massar));
      if (dejaLa) { ignores++; return; }
      cl.eleves.push({ id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomArabe || '', prenom: '' });
      ajoutes++;
    });
    // Eleves inscrits qui NE FIGURENT PLUS dans le fichier de cette classe : ils ont
    // peut-etre quitte l'etablissement. On ne decide pas a leur place : on PROPOSE.
    // (Seules les classes presentes dans le fichier sont examinees : un import partiel
    //  ne touche donc jamais les eleves des autres classes.)
    const codesFichier = {};
    c.eleves.forEach(e => { if (e.massar) codesFichier[String(e.massar)] = true; });
    cl.eleves.forEach(e => {
      if (estSorti(e)) return;
      if (!e.massar) return;
      if (!codesFichier[String(e.massar)]) aSortir.push({ classeId: cl.id, eleveId: e.id, nom: libelleEleve(e), classe: cl.nom });
    });
  });
  sauvegarderClasses();""",
    'import : détection des élèves sortis')

# on demande confirmation, et on applique seulement si le directeur accepte
sub("""  importEleves = null;
  const zone = document.getElementById('eleves-preview');
  if (zone) { zone.classList.add('hidden'); zone.innerHTML = ''; }
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  afficherToast(ajoutes + ' élève(s) ajouté(s) · ' + nouvelles + ' classe(s) créée(s)' + (ignores ? ' · ' + ignores + ' déjà présent(s)' : ''), 'success');""",
"""  importEleves = null;
  const zone = document.getElementById('eleves-preview');
  if (zone) { zone.classList.add('hidden'); zone.innerHTML = ''; }
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  const resume = ajoutes + ' élève(s) ajouté(s) · ' + nouvelles + ' classe(s) créée(s)' + (ignores ? ' · ' + ignores + ' déjà présent(s)' : '');
  if (!aSortir.length) {
    afficherToast(resume, 'success');
    return;
  }
  // jamais silencieux : le directeur voit la liste et decide
  const noms = aSortir.map(x => x.nom + ' (' + x.classe + ')').join(', ');
  demanderConfirmation(resume + ' · ' + aSortir.length + ' élève(s) ne figurent plus dans le fichier : ' + noms +
    '. Les marquer comme « sortis » ? Ils disparaîtront de l\\'appel du jour mais garderont leur historique.',
    function () {
      aSortir.forEach(x => {
        const cl = classes.find(c => c.id === x.classeId);
        const el = cl ? cl.eleves.find(e => e.id === x.eleveId) : null;
        if (el) el.actif = false;
      });
      sauvegarderClasses();
      afficherGestionDir();
      mettreAJourDashboardDir();
      afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'success');
    });
  afficherToast(resume, 'success');""",
    'import : confirmation des sortis')

# ============================================================================
# 6. label
# ============================================================================
sub('AbsenceTrack v3.79', 'AbsenceTrack v3.80', 'label v3.80')

if not ok:
    print('=== PATCH ANNULE ==='); sys.exit(1)

shutil.copyfile(F, 'AbsenceTrack-v3.79-backup.html')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)  backup AbsenceTrack-v3.79-backup.html' % (F, len(html.encode('utf-8'))))
