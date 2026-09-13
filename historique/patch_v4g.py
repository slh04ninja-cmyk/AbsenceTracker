# -*- coding: utf-8 -*-
"""AbsenceTrack v3.46 : tableaux de service (emploi du temps) par enseignant.

Reponses de l'utilisateur :
1. (c) tableaux codes en dur pour les 5 profs de demo, et la somme des heures d'un prof <= 20 h
2. bloquer la selection de classe POUR LE MOMENT mais garder la div de selection
3. creneaux entre 08:00-12:00 et 14:00-18:00 (seances de 2 h possibles, ex. PC / SVT)
4. creer les classes necessaires aux tests SANS toucher aux donnees existantes

Comportement : le Dashboard enseignant ne propose que la (les) classe(s) du creneau en cours ;
hors seance (repos) aucune classe ne s'affiche et un bloc "en repos" montre le prochain cours
et le tableau du jour. Sans tableau de service, l'enseignant garde le choix libre.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-46s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ================= 1. donnees + helpers (apres classes = chargerClasses()) =================
BLOC = r"""
// ========== TABLEAUX DE SERVICE (emploi du temps des enseignants) ==========
// jour : 1 = lundi ... 6 = samedi ; creneaux dans 08:00-12:00 et 14:00-18:00
// Une seance de 2 h (PC, SVT) = un creneau avec debut/fin plus large.
// Regle : la somme des heures d'un enseignant ne doit pas depasser 20 h.
const tableauxService = {
  'pc@taalim.ma': [
    { jour: 1, debut: '16:00', fin: '18:00', classe: '2BACSPF-1', salle: 'S. Physi 2' },
    { jour: 2, debut: '10:00', fin: '12:00', classe: '2PC1-G1',   salle: 'S. Physi 1' },
    { jour: 2, debut: '14:00', fin: '16:00', classe: 'TCSF-4',    salle: 'S. Physi 1' },
    { jour: 3, debut: '10:00', fin: '12:00', classe: 'TCSF-1',    salle: 'S. Physi 2' },
    { jour: 3, debut: '14:00', fin: '16:00', classe: '2PC1-G2',   salle: 'S. Physi 2' },
    { jour: 4, debut: '08:00', fin: '10:00', classe: 'TCSF-4',    salle: 'S. Physi 1' },
    { jour: 4, debut: '16:00', fin: '18:00', classe: '2BACSPF-1', salle: 'S. Physi 1' },
    { jour: 5, debut: '14:00', fin: '16:00', classe: 'TC1-G1',    salle: 'S. Physi 1' },
    { jour: 5, debut: '16:00', fin: '18:00', classe: '2PC1-G1',   salle: 'S. Physi 1' }
  ],
  'math@taalim.ma': [
    { jour: 1, debut: '08:00', fin: '10:00', classe: '3ème A' },
    { jour: 1, debut: '10:00', fin: '12:00', classe: '4ème A' },
    { jour: 2, debut: '08:00', fin: '10:00', classe: '5ème A' },
    { jour: 3, debut: '08:00', fin: '10:00', classe: '3ème B' },
    { jour: 4, debut: '10:00', fin: '12:00', classe: '4ème B' },
    { jour: 5, debut: '08:00', fin: '10:00', classe: '3ème A' },
    { jour: 5, debut: '10:00', fin: '12:00', classe: '4ème A' },
    { jour: 6, debut: '08:00', fin: '10:00', classe: '5ème A' }
  ],
  'fr@taalim.ma': [
    { jour: 1, debut: '14:00', fin: '16:00', classe: '2BACSPF-1' },
    { jour: 2, debut: '08:00', fin: '10:00', classe: '3ème A' },
    { jour: 2, debut: '10:00', fin: '12:00', classe: '3ème B' },
    { jour: 3, debut: '08:00', fin: '10:00', classe: '4ème A' },
    { jour: 3, debut: '14:00', fin: '16:00', classe: 'TCSF-1' },
    { jour: 4, debut: '08:00', fin: '10:00', classe: '4ème B' },
    { jour: 4, debut: '10:00', fin: '12:00', classe: '5ème A' },
    { jour: 5, debut: '14:00', fin: '16:00', classe: '3ème A' }
  ],
  'ar@taalim.ma': [
    { jour: 1, debut: '08:00', fin: '10:00', classe: '2PC1-G1' },
    { jour: 1, debut: '10:00', fin: '12:00', classe: 'TCSF-4' },
    { jour: 2, debut: '14:00', fin: '16:00', classe: '3ème A' },
    { jour: 2, debut: '16:00', fin: '18:00', classe: '3ème B' },
    { jour: 3, debut: '10:00', fin: '12:00', classe: 'TC1-G1' },
    { jour: 4, debut: '14:00', fin: '16:00', classe: '4ème A' },
    { jour: 4, debut: '16:00', fin: '18:00', classe: '4ème B' },
    { jour: 6, debut: '10:00', fin: '12:00', classe: '5ème A' }
  ],
  'svt@taalim.ma': [
    { jour: 1, debut: '10:00', fin: '12:00', classe: '2PC1-G2' },
    { jour: 1, debut: '14:00', fin: '16:00', classe: '2PC1-G1' },
    { jour: 2, debut: '16:00', fin: '18:00', classe: '2BACSPF-1' },
    { jour: 3, debut: '08:00', fin: '10:00', classe: 'TCSF-1' },
    { jour: 3, debut: '16:00', fin: '18:00', classe: 'TCSF-4' },
    { jour: 4, debut: '08:00', fin: '10:00', classe: '2PC1-G2' },
    { jour: 5, debut: '08:00', fin: '10:00', classe: '2PC1-G1' },
    { jour: 5, debut: '16:00', fin: '18:00', classe: '3ème A' },
    { jour: 6, debut: '08:00', fin: '10:00', classe: '3ème B' }
  ]
};

const NOMS_JOURS = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 7: 'dimanche' };
const CLASSES_TABLEAUX_SERVICE = ['TCSF-4', 'TCSF-1', '2BACSPF-1', '2PC1-G1', '2PC1-G2', 'TC1-G1'];
const NB_ELEVES_CLASSE_SERVICE = 12;

// Ajout des classes des tableaux de service : jamais destructif, on saute celles qui existent
function ajouterClassesTableauxService() {
  let ajoutees = 0;
  CLASSES_TABLEAUX_SERVICE.forEach(nom => {
    if (classes.some(c => c.nom === nom)) return;
    const eleves = [];
    for (let i = 0; i < NB_ELEVES_CLASSE_SERVICE; i++) {
      eleves.push({
        id: nextEleveId++,
        nom: nomsDemo[(i * 7 + nom.length) % nomsDemo.length],
        prenom: prenomsDemo[(i * 3 + nom.length) % prenomsDemo.length],
        massar: 'M' + String(nextEleveId).padStart(5, '0')
      });
    }
    classes.push({ id: nextClasseId++, nom: nom, eleves: eleves });
    ajoutees++;
  });
  if (ajoutees > 0) sauvegarderClasses();
  return ajoutees;
}

// ===== Outils horaires des tableaux de service =====
function hhmmEnMinutes(h) {
  const p = String(h || '0:0').split(':');
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}
function jourSemaineCourant() {
  const j = new Date().getDay();
  return j === 0 ? 7 : j;
}
function emailUtilisateur() {
  return utilisateurConnecte ? String(utilisateurConnecte.email || '') : '';
}
function creneauxDuJour(email, jour) {
  const liste = tableauxService[email] || [];
  return liste.filter(c => c.jour === (jour || jourSemaineCourant()))
              .sort((a, b) => hhmmEnMinutes(a.debut) - hhmmEnMinutes(b.debut));
}
function creneauxEnCours(email) {
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  return creneauxDuJour(email).filter(c => m >= hhmmEnMinutes(c.debut) && m < hhmmEnMinutes(c.fin));
}
function heuresServiceMinutes(email) {
  return (tableauxService[email] || []).reduce((som, c) => som + (hhmmEnMinutes(c.fin) - hhmmEnMinutes(c.debut)), 0);
}
function formatDureeService(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + ' h' + (m ? ' ' + m : '');
}
function prochainCreneau(email) {
  const jour = jourSemaineCourant();
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  const reste = creneauxDuJour(email, jour).filter(c => hhmmEnMinutes(c.debut) > m);
  if (reste.length) return { quand: "aujourd'hui", creneau: reste[0] };
  for (let d = jour + 1; d <= 7; d++) {
    const l = creneauxDuJour(email, d);
    if (l.length) return { quand: NOMS_JOURS[d], creneau: l[0] };
  }
  for (let d = 1; d < jour; d++) {
    const l = creneauxDuJour(email, d);
    if (l.length) return { quand: NOMS_JOURS[d], creneau: l[0] };
  }
  return null;
}

// ===== Application au Dashboard enseignant =====
function afficherReposEnseignant() {
  const bloc = document.getElementById('ens-repos');
  if (!bloc) return;
  bloc.classList.remove('hidden');
  const email = emailUtilisateur();
  const jour = jourSemaineCourant();
  const duJour = creneauxDuJour(email, jour);
  const elJour = document.getElementById('ens-repos-jour');
  if (elJour) {
    elJour.textContent = NOMS_JOURS[jour].charAt(0).toUpperCase() + NOMS_JOURS[jour].slice(1) +
      ' — service ' + formatDureeService(heuresServiceMinutes(email)) + ' / 20 h';
  }
  const prochain = prochainCreneau(email);
  const elProchain = document.getElementById('ens-repos-prochain');
  if (elProchain) {
    elProchain.textContent = prochain
      ? 'Prochain cours : ' + prochain.quand + ' à ' + prochain.creneau.debut + ' · ' + prochain.creneau.classe
      : 'Aucun cours programmé';
  }
  const cont = document.getElementById('ens-repos-creneaux');
  if (cont) {
    cont.innerHTML = '';
    if (duJour.length === 0) {
      cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucun cours aujourd\'hui.</p>';
    } else {
      duJour.forEach(c => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg';
        item.innerHTML = '<span class="font-medium text-gray-700">' + c.classe + '</span>' +
          '<span class="text-sm text-gray-500">' + c.debut + '–' + c.fin + (c.salle ? ' · ' + c.salle : '') + '</span>';
        cont.appendChild(item);
      });
    }
  }
}

// Le tableau de service pilote le Dashboard : une seule classe (celle du creneau), rien en repos
function appliquerTableauService() {
  const select = document.getElementById('select-classe');
  if (!select) return;
  const zone = document.getElementById('zone-prise-absence');
  const repos = document.getElementById('ens-repos');
  const estProf = utilisateurConnecte && utilisateurConnecte.role === 'enseignant';
  const aTableau = estProf && (tableauxService[emailUtilisateur()] || []).length > 0;

  // Pas de tableau de service : comportement classique (choix libre de la classe)
  if (!aTableau) {
    select.disabled = false;
    if (repos) repos.classList.add('hidden');
    return;
  }

  const enCours = creneauxEnCours(emailUtilisateur());
  select.disabled = true;   // bloque pour le moment (la div de selection est conservee)

  if (enCours.length > 0) {
    if (repos) repos.classList.add('hidden');
    select.innerHTML = '';
    enCours.forEach(c => {
      const cl = classes.find(x => x.nom === c.classe);
      if (!cl) return;
      const opt = document.createElement('option');
      opt.value = cl.id;
      opt.textContent = c.classe + ' · ' + c.debut + '–' + c.fin + (c.salle ? ' · ' + c.salle : '');
      select.appendChild(opt);
    });
    const cible = classes.find(x => x.nom === enCours[0].classe);
    if (cible) {
      if (!classeSelectionnee || classeSelectionnee.id !== cible.id) {
        choisirClasse(cible.id);
      } else {
        if (zone) zone.classList.remove('hidden');
        afficherListeEleves();
      }
    }
    return;
  }

  // En repos : aucune classe, aucune zone de saisie
  classeSelectionnee = null;
  elevesCoches.clear();
  decochesManuellement.clear();
  select.innerHTML = '<option value="">— Aucune séance en cours —</option>';
  select.value = '';
  if (zone) zone.classList.add('hidden');
  const liste = document.getElementById('liste-eleves-enseignant');
  if (liste) liste.innerHTML = '';
  if (typeof mettreAJourEnteteListe === 'function') mettreAJourEnteteListe();
  afficherReposEnseignant();
}

// Suivi de l'heure : on reevalue le creneau en cours toutes les minutes
setInterval(function () {
  if (!utilisateurConnecte || utilisateurConnecte.role !== 'enseignant') return;
  const page = document.getElementById('page-enseignant');
  if (page && page.classList.contains('active')) appliquerTableauService();
}, 60000);
"""
allok &= remplace('donnees + helpers des tableaux de service',
                  "classes = chargerClasses();\n",
                  "classes = chargerClasses();\n" + BLOC + "\n// Classes des tableaux de service (ajout non destructif)\najouterClassesTableauxService();\n")

# ================= 2. seanceCourante() suit le creneau =================
ANCIEN_SEANCE = """function seanceCourante() {
  // Test : 00-12 = Matin, 13-23 = Apres-midi   (production : 08-12 / 14-18)
  return new Date().getHours() <= 12 ? 'matin' : 'apres-midi';
}"""
NOUVEAU_SEANCE = """function seanceCourante() {
  // Si l'enseignant a un tableau de service et qu'un creneau est en cours, c'est sa seance.
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') {
    const enCours = creneauxEnCours(emailUtilisateur());
    if (enCours.length > 0) return hhmmEnMinutes(enCours[0].debut) < 12 * 60 ? 'matin' : 'apres-midi';
  }
  // Sinon : 00-12 = Matin, 13-23 = Apres-midi (production : 08-12 / 14-18)
  return new Date().getHours() <= 12 ? 'matin' : 'apres-midi';
}"""
allok &= remplace('seanceCourante suit le creneau', ANCIEN_SEANCE, NOUVEAU_SEANCE)

# ================= 3. HTML : bloc « en repos » =================
REPOS_HTML = """      <div id="ens-repos" class="hidden">
        <div class="stat-card mb-4" style="text-align: center;">
          <i class="fas fa-mug-hot" style="font-size: 30px; color: #94a3b8;"></i>
          <p class="font-bold text-gray-800 mt-2">En repos — aucune séance en cours</p>
          <p class="text-sm text-gray-500 mt-1" id="ens-repos-prochain"></p>
        </div>
        <div class="stat-card">
          <div class="stat-label mb-3">Mon tableau de service — <span id="ens-repos-jour"></span></div>
          <div id="ens-repos-creneaux" class="space-y-2"></div>
        </div>
      </div>
"""
allok &= remplace('bloc en repos (HTML)',
                  '      <div id="zone-prise-absence" class="hidden">',
                  REPOS_HTML + '      <div id="zone-prise-absence" class="hidden">')

# ================= 4. points d'appel =================
allok &= remplace('appel a la connexion',
                  "    afficherInfosProf();\n  } else if (compte.role === 'surveillant') {",
                  "    afficherInfosProf();\n    appliquerTableauService();\n  } else if (compte.role === 'surveillant') {")
allok &= remplace('appel dans switchEnsPage',
                  "  if (page === 'enseignant') afficherListeEleves();",
                  "  if (page === 'enseignant') { afficherListeEleves(); appliquerTableauService(); }")
allok &= remplace('appel dans init()',
                  "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); }",
                  "if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); appliquerTableauService(); }")
allok &= remplace('appel apres enregistrement',
                  "  elevesCoches.clear();\n  afficherListeEleves();\n  mettreAJourEnteteListe();",
                  "  elevesCoches.clear();\n  afficherListeEleves();\n  mettreAJourEnteteListe();\n  appliquerTableauService();")

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.45', 'AbsenceTrack v3.46', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.46 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ================= verifications =================
for cle, attendu in [('const tableauxService', 1), ('function ajouterClassesTableauxService', 1),
                     ('function creneauxEnCours', 1), ('function prochainCreneau', 1),
                     ('function appliquerTableauService', 2), ('function afficherReposEnseignant', 1),
                     ('const CLASSES_TABLEAUX_SERVICE', 1), ('id="ens-repos"', 1),
                     ('id="ens-repos-prochain"', 1), ('id="ens-repos-creneaux"', 1),
                     ('ajouterClassesTableauxService();', 1), ('DEMO_VERSION = ', 1),
                     ('id="page-profil"', 1), ('id="page-dir-stats"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-44s = %d' % (cle, n))
    allok &= (n == attendu)

# DEMO_VERSION inchange (ne pas effacer les donnees existantes)
n = s.count("const DEMO_VERSION = 'v2.1';")
print(('OK   ' if n == 1 else 'ECHEC') + ' DEMO_VERSION inchangee          = %d' % n)
allok &= (n == 1)

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
