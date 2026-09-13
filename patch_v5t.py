# -*- coding: utf-8 -*-
# patch_v5t.py — v3.81 : l'import MASSAR ne duplique PLUS les eleves
#   BUG : confirmerImport() empilait les eleves du fichier dans la classe existante
#         SANS test de doublon -> 28 eleves, 1 supprime, reimport => 27 + 28 = 55.
#   Correctif :
#     1. identite d'un eleve = son CODE MASSAR (nom mis a jour s'il change, historique conserve)
#     2. apercu qui annonce les changements AVANT validation
#     3. eleves du fichier qui ne sont plus la -> proposition "sorti" (comme l'autre import)
#     4. pour les donnees deja abimees : bouton "Rechercher les doublons" qui FUSIONNE
#        (garde celui qui porte les signalements, rattache les autres)
import io, re, sys

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
orig = s
rapport = []


def rem(nom, ancien, nouveau, n=1):
    global s
    c = s.count(ancien)
    if c != n:
        print('ECHEC %s : %d occurrence(s) au lieu de %d' % (nom, c, n))
        sys.exit(1)
    s = s.replace(ancien, nouveau)
    rapport.append('%s : %d remplacement(s)' % (nom, c))


# ---------- 1. bouton de reparation (doublons deja crees) ----------
HTML_OLD = '''        <div id="tableaux-error" class="hidden mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-center"></div>
      </div>'''
HTML_NEW = '''        <div id="tableaux-error" class="hidden mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-center"></div>

        <p class="text-sm font-bold text-gray-700 sep-titre">Doublons d&rsquo;élèves</p>
        <p class="text-xs text-gray-500 mb-2">Un élève dont le code MASSAR est déjà présent n&rsquo;est jamais dupliqué à l&rsquo;import. Si un ancien import a créé des doublons, cet outil les retrouve et les fusionne en gardant l&rsquo;historique.</p>
        <button onclick="verifierDoublonsEleves()" class="btn-secondary w-full"><i class="fas fa-clone"></i> Rechercher les doublons d&rsquo;élèves</button>
      </div>'''
rem('bouton doublons', HTML_OLD, HTML_NEW)

# ---------- 2. apercu MASSAR : annoncer les changements ----------
rem('apercu par classe',
    "+ c.eleves.length + ' élèves</span></div>';",
    "+ resumeImportClasse(c) + '</span></div>';")

# ---------- 3. helpers + nouveau confirmerImport ----------
ANCRE = 'function confirmerImport() {'
HELPERS = r'''// Cle de comparaison d'un nom (insensible a la casse, aux accents et aux espaces)
function cleNomEleve(e) {
  const base = libelleEleve(e) + ' ' + (e.nomFr || '') + ' ' + (e.nomArabe || '');
  let txt = base.toLowerCase();
  if (txt.normalize) txt = txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return txt.replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
}

// Apercu d'un fichier MASSAR : ce que la classe va devenir (nouveaux / deja presents)
function resumeImportClasse(c) {
  const exist = classes.find(x => String(x.nom).toLowerCase() === String(c.nom).toLowerCase());
  if (!exist) return c.eleves.length + ' élèves · nouvelle classe';
  const vus = {};
  exist.eleves.forEach(e => { if (e.massar) vus['c' + String(e.massar).trim()] = true; });
  const nb = c.eleves.filter(e => !(e.massar && vus['c' + String(e.massar).trim()])).length;
  if (!nb) return c.eleves.length + ' élèves · tous déjà présents';
  return nb + ' à ajouter · ' + (c.eleves.length - nb) + ' déjà présent(s)';
}

'''
rem('ancre confirmerImport', ANCRE, HELPERS + ANCRE)

CONF_OLD_RE = re.compile(r'function confirmerImport\(\) \{.*?\n\}\n', re.S)
m = CONF_OLD_RE.search(s)
if not m or 'existante.eleves.push' not in m.group(0):
    print('ECHEC : confirmerImport introuvable ou inattendu')
    sys.exit(1)

CONF_NEW = r'''function confirmerImport() {
  if (!importData || !importData.classes) return;
  let nouvelles = 0, ajoutes = 0, dejaLa = 0, corriges = 0;
  const aSortir = [];
  importData.classes.forEach(clImport => {
    let existante = classes.find(c => String(c.nom).toLowerCase() === String(clImport.nom).toLowerCase());
    if (!existante) {
      existante = { id: nextClasseId++, nom: clImport.nom, eleves: [] };
      classes.push(existante);
      nouvelles++;
    }
    // Identite d'un eleve = son CODE MASSAR (le nom peut etre corrige dans MASSAR : on le suit).
    // Sans code, on retombe sur le nom. C'est ce qui evite les doublons au reimport.
    const parCode = {}, parNom = {};
    existante.eleves.forEach(e => {
      if (e.massar) parCode['c' + String(e.massar).trim()] = e;
      const k = cleNomEleve(e);
      if (k && !parNom[k]) parNom[k] = e;
    });
    clImport.eleves.forEach(e => {
      const code = e.massar ? 'c' + String(e.massar).trim() : '';
      const deja = (code && parCode[code]) || (!code && parNom[cleNomEleve(e)]) || null;
      if (deja) {
        // deja inscrit : on ne le recree pas, on met seulement son nom a jour
        dejaLa++;
        if (!estSorti(deja)) {
          if (e.nom && e.nom !== deja.nom) { deja.nom = e.nom; corriges++; }
          if (e.nomFr && e.nomFr !== deja.nomFr) deja.nomFr = e.nomFr;
          if (e.nomArabe && e.nomArabe !== deja.nomArabe) deja.nomArabe = e.nomArabe;
        }
        return;
      }
      const nouveau = { id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomFr || e.nomArabe || '', prenom: e.prenom || '', actif: true };
      existante.eleves.push(nouveau);
      if (code) parCode[code] = nouveau;
      const kn = cleNomEleve(nouveau);
      if (kn) parNom[kn] = nouveau;
      ajoutes++;
    });
    // Eleves inscrits qui NE FIGURENT PLUS dans le fichier de cette classe : ils ont
    // peut-etre quitte l'etablissement. On ne decide pas a leur place : on PROPOSE.
    // (Seules les classes presentes dans le fichier sont examinees : un import partiel
    //  ne touche donc jamais les eleves des autres classes.)
    const codesFichier = {};
    clImport.eleves.forEach(e => { if (e.massar) codesFichier['c' + String(e.massar).trim()] = true; });
    existante.eleves.forEach(e => {
      if (estSorti(e) || !e.massar) return;
      if (!codesFichier['c' + String(e.massar).trim()]) aSortir.push({ classeId: existante.id, eleveId: e.id, nom: libelleEleve(e), classe: existante.nom });
    });
  });
  sauvegarderClasses();
  const total = importData.classes.reduce((s, c) => s + c.eleves.length, 0);
  importData = null;
  document.getElementById('import-preview').classList.add('hidden');
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  const resume = nouvelles + ' classe(s) importée(s) · ' + ajoutes + ' élève(s) ajouté(s)' +
    (dejaLa ? ' · ' + dejaLa + ' déjà présent(s)' : '') +
    (corriges ? ' · ' + corriges + ' nom(s) corrigé(s)' : '') + ' — ' + total + ' au total';
  if (aSortir.length) {
    // jamais silencieux : le directeur voit les noms et decide
    const noms = aSortir.map(x => x.nom + ' (' + x.classe + ')').join(', ');
    demanderConfirmation(resume + ' · ' + aSortir.length + ' élève(s) ne figurent plus dans le fichier : ' + noms +
      '. Les marquer comme « sortis » ? Ils disparaîtront de l\'appel du jour mais garderont leur historique.',
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
  }
  afficherToast(resume, 'success');
}
'''
s = s[:m.start()] + CONF_NEW + s[m.end():]
rapport.append('confirmerImport : reecrite (dedoublonnage par code MASSAR)')

# ---------- 4. outil de reparation des doublons deja crees ----------
ANCRE2 = '// ========== RECHERCHE ELEVE =========='
OUTIL = r'''// ========== DOUBLONS D'ELEVES (reparation) ==========
// Un ancien import a pu empiler deux fois la meme liste. On regroupe les eleves qui
// partagent le meme code MASSAR dans une classe, puis on FUSIONNE en gardant celui
// qui porte les signalements (l'historique suit).
function aDesSignalements(el, cl) {
  return absences.some(a => a.eleveId === el.id && a.classe === cl.nom);
}

function chercherDoublonsEleves() {
  const groupes = [];
  classes.forEach(cl => {
    const parCode = {}, parNom = {};
    cl.eleves.forEach(e => {
      if (e.massar) {
        const k = 'c' + String(e.massar).trim();
        (parCode[k] = parCode[k] || []).push(e);
      } else {
        const k = cleNomEleve(e);
        if (k) (parNom[k] = parNom[k] || []).push(e);
      }
    });
    Object.keys(parCode).forEach(k => {
      if (parCode[k].length > 1) groupes.push({ classe: cl, eleves: parCode[k], sur: 'code MASSAR' });
    });
    // Sans code MASSAR, on ne fusionne que si UN SEUL exemplaire porte des signalements
    // (sinon on pourrait confondre deux homonymes : on ne touche a rien).
    Object.keys(parNom).forEach(k => {
      const liste = parNom[k];
      if (liste.length < 2) return;
      const avec = liste.filter(e => aDesSignalements(e, cl));
      if (avec.length !== 1) return;
      groupes.push({ classe: cl, eleves: liste, sur: 'nom' });
    });
  });
  return groupes;
}

function verifierDoublonsEleves() {
  const groupes = chercherDoublonsEleves();
  if (!groupes.length) {
    afficherToast('Aucun doublon d\'élève détecté', 'success');
    return;
  }
  const nb = groupes.reduce(function (acc, g) { return acc + g.eleves.length - 1; }, 0);
  const detail = groupes.map(function (g) {
    return libelleEleve(g.eleves[0]) + ' (' + g.classe.nom + ' ×' + g.eleves.length + ')';
  }).join(', ');
  demanderConfirmation(nb + ' doublon(s) détecté(s) : ' + detail +
    '. Les fusionner ? Le signalement de chaque élève est conservé (une seule fiche par élève).',
    function () { fusionnerDoublonsEleves(groupes); });
}

function fusionnerDoublonsEleves(groupes) {
  let fusionnes = 0, rattaches = 0, ecartes = 0;
  groupes.forEach(function (g) {
    const cl = g.classe;
    const nbSig = function (e) { return absences.filter(a => a.eleveId === e.id && a.classe === cl.nom).length; };
    // on garde l'exemplaire qui porte le plus de signalements (a egalite : le plus ancien)
    const tries = g.eleves.slice().sort(function (a, b) { return nbSig(b) - nbSig(a) || a.id - b.id; });
    const garde = tries[0];
    tries.slice(1).forEach(function (doublon) {
      absences = absences.filter(function (a) {
        if (a.eleveId !== doublon.id || a.classe !== cl.nom) return true;
        // meme eleve + meme jour + meme seance deja present -> le doublon exact disparait
        const dejaLa = absences.some(function (b) {
          return b !== a && b.eleveId === garde.id && b.classe === cl.nom &&
            b.dateISO === a.dateISO && (b.seance || 'matin') === (a.seance || 'matin');
        });
        if (dejaLa) { ecartes++; return false; }
        a.eleveId = garde.id;
        rattaches++;
        return true;
      });
      cl.eleves = cl.eleves.filter(function (e) { return e.id !== doublon.id; });
      fusionnes++;
    });
    // le nom garde doit rester lisible meme s'il etait vide sur l'exemplaire conserve
    if (!garde.nom) garde.nom = garde.nomFr || garde.nomArabe || '';
  });
  sauvegarderClasses();
  localStorage.setItem('absences', JSON.stringify(absences));
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  afficherToast(fusionnes + ' doublon(s) fusionné(s)' +
    (rattaches ? ' · ' + rattaches + ' signalement(s) rattaché(s)' : '') +
    (ecartes ? ' · ' + ecartes + ' en double écarté(s)' : ''), 'success');
}

'''
rem('ancre recherche eleve', ANCRE2, OUTIL + ANCRE2)

# ---------- 5. version ----------
rem('label version', 'AbsenceTrack v3.80 — Prototype', 'AbsenceTrack v3.81 — Prototype')

# ---------- verifications ----------
assert 'existante.eleves.push' in s
io.open(F, 'w', encoding='utf-8').write(s)

# JS valide ?
import subprocess
js = re.search(r'<script>(?!.*src=)(.*?)</script>', s, re.S)
sc = re.findall(r'<script>(.*?)</script>', s, re.S)
bloc = max(sc, key=len)
_tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check_v5t.js'
io.open(_tmp, 'w', encoding='utf-8').write(bloc)
r = subprocess.run(['node', '--check', _tmp], capture_output=True, text=True)
print('node --check :', 'OK' if r.returncode == 0 else r.stderr[:400])

o, n = s.count('<div'), s.count('</div>')
print('divs : %d / %d %s' % (o, n, 'OK' if o == n else 'DESEQUILIBRE'))
print('taille : %d -> %d' % (len(orig), len(s)))
for x in rapport:
    print(' -', x)
