# -*- coding: utf-8 -*-
"""AbsenceTrack v3.41

1. Dashboard directeur + enseignant : les cartes affichent aussi les absences NON JUSTIFIEES
   des jours precedents (le surveillant reste sur aujourd'hui). Clic = popup de detail
   (directeur, pour justifier) ou fiche eleve (enseignant, qui ne peut pas justifier).
2. Page Stats du directeur : « Eleves les plus signales » utilise les MEMES cartes .carte-eleve
   que l'historique (nom / classe / pastille du nombre / chevron) et le meme clic -> fiche.
3. ouvrirFicheEleveParNom() : recherche durcie (nom complet, nom, nomFr, nomArabe, espaces normalises)
   pour qu'un clic sur une carte n'echoue jamais par « Eleve introuvable ».
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace_apres(label, ancre, a, b, n=1):
    """remplace a par b uniquement APRES l'ancre (pour les blocs dupliques entre 2 pages)"""
    global s
    depart = s.index(ancre)
    i = s.index(a, depart)
    j = i + len(a)
    print('OK   ' + '%-46s  (cible apres ancre)' % label)
    s = s[:i] + b + s[j:]
    return True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-46s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ---------- 1. renderer generique des cartes d'absences non justifiees ----------
ANCIEN = """function afficherCartesAbsentsJour(idConteneur) {
  const absentsJour = absences.filter(a => a.dateISO === fmtDateISO(new Date()) && a.statut === 'absent');
  const listContainer = document.getElementById(idConteneur);
  if (!listContainer) return;
  listContainer.innerHTML = '';
  if (absentsJour.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>Aucun \\u00e9l\\u00e8ve signal\\u00e9 aujourd\\'hui</p></div>';
  } else {
    absentsJour.forEach(abs => {
      const card = document.createElement('div');
      card.className = 'absence-card carte-eleve';
      card.onclick = () => afficherDetailAbsence(abs);
      card.innerHTML = '<div class="absence-card-ligne"><span class="absence-card-name">' + abs.nom + '</span><span class="absence-card-classe">' + abs.classe + '</span><i class="fas fa-chevron-right absence-card-icon"></i></div>';
      listContainer.appendChild(card);
    });
  }
}"""
NOUVEAU = """// Cartes des absences NON JUSTIFIEES.
//   options.aujourdSeulement : true  -> uniquement aujourd'hui (surveillant)
//   options.joursPrecedents  : true  -> uniquement les jours precedents (enseignant)
//   options.enseignant       : nom   -> uniquement ses propres signalements
//   options.action           : 'detail' (popup de signalement, par defaut) ou 'fiche' (fiche eleve)
//   options.titre / options.messageVide : textes optionnels
// Retourne le nombre de cartes affichees.
function afficherCartesAbsentsNonJustifies(idConteneur, options) {
  options = options || {};
  const aujourd = fmtDateISO(new Date());
  const listContainer = document.getElementById(idConteneur);
  if (!listContainer) return 0;

  let liste = absences.filter(a => a.statut === 'absent');
  if (options.enseignant) liste = liste.filter(a => a.enseignant === options.enseignant);
  if (options.aujourdSeulement) liste = liste.filter(a => a.dateISO === aujourd);
  if (options.joursPrecedents) liste = liste.filter(a => String(a.dateISO || '') < aujourd);
  liste = liste.slice().sort((a, b) => {
    const da = String(a.dateISO || '');
    const db = String(b.dateISO || '');
    if (da !== db) return db.localeCompare(da);
    return String(b.heure || '').localeCompare(String(a.heure || ''));
  });

  listContainer.innerHTML = '';
  if (liste.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>' + (options.messageVide || "Aucun élève signalé aujourd'hui") + '</p></div>';
    return 0;
  }
  if (options.titre) {
    const entete = document.createElement('div');
    entete.className = 'stat-label mb-2';
    entete.textContent = options.titre;
    listContainer.appendChild(entete);
  }
  liste.forEach(abs => {
    const card = document.createElement('div');
    card.className = 'absence-card carte-eleve';
    if (options.action === 'fiche') card.onclick = () => ouvrirFicheEleveParNom(abs.nom, abs.classe);
    else card.onclick = () => afficherDetailAbsence(abs);
    const jour = String(abs.dateISO || '');
    const dateCourte = (jour && jour !== aujourd) ? ' · ' + jour.slice(8, 10) + '/' + jour.slice(5, 7) : '';
    card.innerHTML = '<div class="absence-card-ligne"><span class="absence-card-name">' + abs.nom + '</span><span class="absence-card-classe">' + abs.classe + dateCourte + '</span><i class="fas fa-chevron-right absence-card-icon"></i></div>';
    listContainer.appendChild(card);
  });
  return liste.length;
}

// Dashboard surveillant : les absents non justifies du jour
function afficherCartesAbsentsJour(idConteneur) {
  return afficherCartesAbsentsNonJustifies(idConteneur, { aujourdSeulement: true });
}

// Dashboard enseignant : ses propres absences non justifiees des jours precedents
function afficherAbsencesNonJustifieesEnseignant() {
  const conteneur = document.getElementById('ens-absences-passees');
  if (!conteneur) return;
  const moi = (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') ? utilisateurConnecte.nom : null;
  if (!moi) { conteneur.classList.add('hidden'); conteneur.innerHTML = ''; return; }
  const nb = afficherCartesAbsentsNonJustifies('ens-absences-passees', {
    enseignant: moi,
    joursPrecedents: true,
    action: 'fiche',
    titre: 'Absences non justifiées (jours précédents)',
    messageVide: 'Aucune absence non justifiée des jours précédents'
  });
  conteneur.classList.toggle('hidden', nb === 0);
}"""
allok &= remplace('renderer generique des cartes', ANCIEN, NOUVEAU)

# ---------- 2. Dashboard directeur : aujourd'hui + jours precedents ----------
allok &= remplace('liste du dashboard directeur',
                  """  // Memes cartes d'absents que le Dashboard surveillant
  afficherCartesAbsentsJour('dir-absences-list');""",
                  """  // Absents NON JUSTIFIES : aujourd'hui et jours precedents (toute l'etablissement)
  afficherCartesAbsentsNonJustifies('dir-absences-list', { messageVide: 'Aucun élève non justifié' });""")

# ---------- 3. conteneur enseignant + appels ----------
allok &= remplace('conteneur enseignant',
                  """      <div id="zone-prise-absence" class="hidden">""",
                  """      <div id="ens-absences-passees" class="mb-4 hidden"></div>
      <div id="zone-prise-absence" class="hidden">""")
allok &= remplace('appel dans switchEnsPage',
                  "  if (page === 'enseignant') afficherListeEleves();",
                  "  if (page === 'enseignant') { afficherListeEleves(); afficherAbsencesNonJustifieesEnseignant(); }")
allok &= remplace('appel a la connexion',
                  "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); }",
                  "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); afficherAbsencesNonJustifieesEnseignant(); }")
allok &= remplace('appel apres enregistrement',
                  """  elevesCoches.clear();
  afficherListeEleves();
  mettreAJourEnteteListe();
}""",
                  """  elevesCoches.clear();
  afficherListeEleves();
  mettreAJourEnteteListe();
  afficherAbsencesNonJustifieesEnseignant();
}""")

# ---------- 4. Stats directeur : cartes comme l'historique ----------
ANCIEN_TOP = """      eleves.slice(0, 5).forEach(x => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
        row.style.cursor = 'pointer';
        row.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
        row.innerHTML =
          '<div class="flex items-center gap-3">' +
            '<span class="avatar text-xs" style="width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: ' + pal.abs + '; font-weight: 700;">' + (x.nom || '?').charAt(0) + '</span>' +
            '<span class="font-medium text-gray-800">' + x.nom + '</span>' +
          '</div>' +
          '<span class="text-sm font-bold" style="color: ' + pal.abs + ';">' + x.total + '</span>';
        topDiv.appendChild(row);
      });"""
NOUVEAU_TOP = """      eleves.slice(0, 5).forEach(x => {
        // Meme carte que dans l'historique (nom / classe / pastille du nombre / chevron)
        const row = document.createElement('div');
        row.className = 'carte-eleve';
        row.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
        row.innerHTML =
          '<div class="absence-card-ligne">' +
            '<span class="absence-card-name">' + x.nom + '</span>' +
            '<span class="absence-card-classe">' + x.classe + '</span>' +
            '<span class="carte-eleve-total">' + x.total + '</span>' +
            '<i class="fas fa-chevron-right absence-card-icon"></i>' +
          '</div>';
        topDiv.appendChild(row);
      });"""
allok &= remplace_apres('cartes du top eleves (stats directeur)',
                        "const topDiv = document.getElementById('dir-top-absents')", ANCIEN_TOP, NOUVEAU_TOP)

# ---------- 4bis. suppression d'une classe : confirmation obligatoire ----------
allok &= remplace('bouton supprimer la classe',
                  '<button onclick="supprimerClasseCourante()" class="btn-danger w-full"><i class="fas fa-trash"></i> Supprimer cette classe</button>',
                  '<button onclick="demanderSuppressionClasse()" class="btn-danger w-full"><i class="fas fa-trash"></i> Supprimer cette classe</button>')

JS_CLASSE = '''// Suppression d'une classe : confirmation obligatoire (elle emporte ses eleves et leurs signalements)
function demanderSuppressionClasse() {
  const cl = classes.find(c => c.id === classeDetailCourante);
  if (!cl) return;
  demanderConfirmation('Supprimer la classe ' + cl.nom + ' et ses ' + cl.eleves.length + " élève(s) ? Les signalements liés seront aussi supprimés.", function () {
    supprimerClasseCourante();
  });
}

function supprimerClasseCourante() {'''
allok &= remplace('fonction demanderSuppressionClasse', 'function supprimerClasseCourante() {', JS_CLASSE)


# ---------- 5. recherche d'eleve durcie ----------
ANCIEN_FICHE = """  const cl = classes.find(c => c.nom === nomClasse);
  if (!cl) { afficherToast('Élève introuvable', 'error'); return; }
  const el = cl.eleves.find(e => libelleEleve(e) === nom);
  if (!el) { afficherToast('Élève introuvable', 'error'); return; }
  ouvrirFicheEleve(el.id, cl.id);"""
NOUVEAU_FICHE = """  const cible = String(nom || '').replace(/\\s+/g, ' ').trim();
  const cl = classes.find(c => c.nom === nomClasse)
    || classes.find(c => String(c.nom || '').toLowerCase() === String(nomClasse || '').toLowerCase());
  if (!cl) { afficherToast('Élève introuvable', 'error'); return; }
  const meme = e => String(libelleEleve(e) || '').replace(/\\s+/g, ' ').trim() === cible;
  const el = cl.eleves.find(meme)
    || cl.eleves.find(e => String(e.nom || '').replace(/\\s+/g, ' ').trim() === cible)
    || cl.eleves.find(e => String(e.nomFr || '').replace(/\\s+/g, ' ').trim() === cible)
    || cl.eleves.find(e => String(e.nomArabe || '').replace(/\\s+/g, ' ').trim() === cible);
  if (!el) { afficherToast('Élève introuvable', 'error'); return; }
  ouvrirFicheEleve(el.id, cl.id);"""
allok &= remplace('recherche d eleve durcie', ANCIEN_FICHE, NOUVEAU_FICHE)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.40', 'AbsenceTrack v3.41', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.41 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('function afficherCartesAbsentsNonJustifies', 1),
                     ('function afficherCartesAbsentsJour', 1),
                     ('function afficherAbsencesNonJustifieesEnseignant', 1),
                     ("afficherCartesAbsentsNonJustifies('dir-absences-list'", 1),
                     ('id="ens-absences-passees"', 1),
                     ('afficherAbsencesNonJustifieesEnseignant()', 3),
                     ("'<span class=\"carte-eleve-total\">' + x.total", 2),
                     ('const meme = e =>', 1),
                     ('function demanderSuppressionClasse', 1),
                     ('onclick="demanderSuppressionClasse()"', 1),
                     ('onclick="supprimerClasseCourante()"', 0),
                     ('id="page-profil"', 1), ('id="page-dir-stats"', 1),
                     ("afficherCartesAbsentsJour('surv-absences-list')", 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-52s = %d' % (cle, n))
    allok &= (n == attendu)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
