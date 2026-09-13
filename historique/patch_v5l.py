# -*- coding: utf-8 -*-
"""patch_v5l.py -> v3.75   (a appliquer sur AbsenceTrack-v3.73-backup.html)

Carte « Surveillants » de la page RH :
  - bouton « Ajouter un surveillant »  (nouveau)
  - bouton « Modifier »                 (existait deja)
  - bouton « Supprimer » dans la fenetre de modification, avec confirmation (nouveau)
  - la liste des surveillants est PERSISTEE (ils ne viennent d'aucun import)

Carte « Identifiants » (bas de la page RH) :
  - genere email + mot de passe pour les SURVEILLANTS et les ENSEIGNANTS
  - un seul PDF, deux sous-titres : « Surveillants » puis « Enseignants »

Reutilise : abrevMatiere(), genererMotDePasse(), motsDePasse/sauvegarderMotsDePasse(),
demanderConfirmation(), afficherToast(), le motif chargerXLSX() pour le chargement du PDF.
Le moteur PDF est EXTRAIT de _pdf/identifiants.js (le fichier teste en Node).
"""
import io, re, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
ok = True

def sub_once(ancien, nouveau, label):
    global html, ok
    n = html.count(ancien)
    if n != 1:
        print('!! %s : %d occurrence(s) (attendu 1)' % (label, n)); ok = False; return
    html = html.replace(ancien, nouveau, 1)
    print('OK %s' % label)

# ============================================================================
# 1. HTML — bouton « Ajouter un surveillant » (carte Surveillants, vue Liste)
# ============================================================================
ancien = ('          <p class="aide">Corriger le nom d\'un surveillant, définir ou générer son mot de passe de connexion.</p>\n'
          '          <div id="dir-surveillants-list" class="js-personnel"></div>')
nouveau = ('          <p class="aide">Ajouter un surveillant, corriger son nom, définir son mot de passe. Ses identifiants de connexion sont générés avec ceux des enseignants.</p>\n'
           '          <button type="button" class="btn-primary w-full btn-ripple mb-3" onclick="ouvrirAjoutSurveillant()"><i class="fas fa-user-plus"></i> Ajouter un surveillant</button>\n'
           '          <div id="dir-surveillants-list" class="js-personnel"></div>')
sub_once(ancien, nouveau, 'bouton Ajouter un surveillant')

# ============================================================================
# 1 bis. HTML — carte « Identifiants du personnel » en bas de la page RH
# ============================================================================
ancre_html = ('<div id="indispo-liste" class="js-absences-personnel"></div>\n'
              '        </div>\n'
              '      </div>\n')
carte = '''
      <!-- Identifiants : emails + mots de passe des surveillants et des enseignants -->
      <div class="stat-card mb-4 carte-settings" id="identifiants-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-key text-blue-900 mr-2"></i>Identifiants du personnel</h3>
        <p class="aide">Un email et un mot de passe sont engendrés pour chaque personne, puis la liste est téléchargée en PDF (surveillants puis enseignants) pour la remettre à chacun.</p>
        <button type="button" class="btn-primary w-full btn-ripple" onclick="demanderIdentifiants()"><i class="fas fa-file-pdf"></i> Télécharger les identifiants</button>
      </div>
'''
sub_once(ancre_html, ancre_html + carte, 'carte Identifiants en bas de RH')

# ============================================================================
# 2. HTML — bouton « Supprimer » dans la fenetre de modification
# ============================================================================
ancien = ('      <div class="flex gap-3">\n'
          '        <button onclick="fermerRenommageProf()" class="btn-fermer flex-1">Fermer</button>\n'
          '        <button onclick="confirmerRenommageProf()" class="btn-primary flex-1"><i class="fas fa-save"></i> Enregistrer</button>\n'
          '      </div>')
nouveau = ('      <button type="button" id="renommer-supprimer" class="hidden w-full btn-fermer mb-2" style="border: 2px solid #dc2626; color: #dc2626; background: transparent;" onclick="supprimerProfilCourant()"><i class="fas fa-trash"></i> Supprimer ce surveillant</button>\n'
           '      <div class="flex gap-3">\n'
           '        <button onclick="fermerRenommageProf()" class="btn-fermer flex-1">Fermer</button>\n'
           '        <button onclick="confirmerRenommageProf()" class="btn-primary flex-1"><i class="fas fa-save"></i> Enregistrer</button>\n'
           '      </div>')
sub_once(ancien, nouveau, 'bouton Supprimer dans la modale')

# ============================================================================
# 3. JS — persistance de la liste des surveillants (aucun import ne les fournit)
# ============================================================================
ancien = 'appliquerNomsProfs(); appliquerMotsDePasse();'
if html.count(ancien) != 1:
    # la ligne exacte peut differer : on cherche l'appel seul
    m = re.search(r'appliquerNomsProfs\(\);\s*appliquerMotsDePasse\(\);', html)
    if not m:
        print('!! appel de demarrage introuvable'); ok = False
    else:
        ancien = m.group(0)
if ok:
    nouveau = ancien + ' appliquerListeSurveillants();'
    sub_once(ancien, nouveau, 'demarrage : appliquerListeSurveillants()')

persistance = r'''
// ========== SURVEILLANTS : ajout, modification, suppression ==========
// Ils ne viennent d'aucun fichier importe (ni MASSAR ni FET n'en contiennent) : c'est
// le directeur qui les cree. La liste est donc conservee localement ; les emails et
// mots de passe generes vivent dans motsDePasse (comme pour les enseignants).
let surveillantsRH = null;        // null = jamais modifiee : on garde les surveillants de demonstration
let creationProfil = false;       // true quand la fenetre sert a AJOUTER un surveillant

function chargerSurveillantsRH() {
  try {
    const brut = localStorage.getItem('surveillantsRH');
    const obj = brut ? JSON.parse(brut) : null;
    return Array.isArray(obj) ? obj : null;
  } catch (e) { return null; }
}

// La liste courante : celle enregistree, sinon celle deduite des comptes existants
function listeSurveillantsRH() {
  if (surveillantsRH) return surveillantsRH.map(s => ({ cle: s.cle, code: s.code, nom: s.nom, email: s.email || '' }));
  return comptes.filter(c => c.role === 'surveillant')
    .map(c => ({ cle: c.code || c.email, code: c.code || null, nom: c.nom, email: c.email || '' }));
}

function sauvegarderSurveillantsRH(liste) {
  surveillantsRH = liste;
  localStorage.setItem('surveillantsRH', JSON.stringify(liste));
  appliquerListeSurveillants();
}

// Reconstruit les surveillants des comptes a partir de la liste conservee
function appliquerListeSurveillants() {
  if (!surveillantsRH) return;
  for (let i = comptes.length - 1; i >= 0; i--) {
    if (comptes[i].role === 'surveillant') comptes.splice(i, 1);
  }
  surveillantsRH.forEach(s => {
    comptes.push({
      email: s.email || '',
      password: (s.email && motsDePasse[s.email]) ? motsDePasse[s.email] : '',
      role: 'surveillant',
      nom: s.nom,
      code: s.code || null
    });
  });
  appliquerNomsProfs();
  appliquerMotsDePasse();
}

// Modification d'un surveillant (nom ou email) dans la liste conservee
function majSurveillantRH(cle, changement) {
  const liste = listeSurveillantsRH();
  const cible = liste.find(s => s.cle === cle || s.code === cle || s.email === cle);
  if (!cible) return false;
  Object.keys(changement || {}).forEach(k => { cible[k] = changement[k]; });
  sauvegarderSurveillantsRH(liste);
  return true;
}

// Ouvrir la fenetre en mode AJOUT
function ouvrirAjoutSurveillant() {
  creationProfil = true;
  profARenommer = null;
  const t = document.getElementById('renommer-titre');   if (t) t.textContent = 'Nouveau surveillant';
  const n = document.getElementById('renommer-nom');      if (n) n.value = '';
  const m = document.getElementById('renommer-mdp');      if (m) m.value = '';
  const i = document.getElementById('renommer-info');     if (i) i.textContent = "Ses identifiants de connexion seront generes avec le bouton « Telecharger les identifiants ».";
  const e = document.getElementById('renommer-email');    if (e) e.textContent = '';
  const s = document.getElementById('renommer-success');  if (s) s.classList.add('hidden');
  const b = document.getElementById('renommer-supprimer');if (b) b.classList.add('hidden');
  document.getElementById('modal-renommer').classList.remove('hidden');
}

// Suppression, avec confirmation (comme partout ailleurs)
function supprimerProfilCourant() {
  const cle = profARenommer;
  if (!cle) return;
  const prof = comptes.find(c => c.code === cle || c.email === cle);
  if (!prof) return;
  if (prof.role !== 'surveillant') { afficherToast('Suppression impossible depuis cet ecran', 'error'); return; }
  fermerRenommageProf();
  demanderConfirmation('Supprimer le surveillant « ' + (prof.nom || '') + ' » ? Son identifiant ne sera plus attribue.',
    function () {
      const liste = listeSurveillantsRH().filter(s => (s.cle || s.code) !== (prof.code || prof.email));
      sauvegarderSurveillantsRH(liste);
      if (prof.email && motsDePasse[prof.email]) { delete motsDePasse[prof.email]; sauvegarderMotsDePasse(); }
      afficherListeProfs();
      afficherToast('Surveillant supprime', 'success');
    });
}
'''

# la persistance est placee juste apres le bloc « personnel » existant
ancre = """function afficherListeProfs() {
  afficherComptes('dir-profs-list', 'enseignant');
  afficherComptes('dir-surveillants-list', 'surveillant');
}
"""
sub_once(ancre, ancre + persistance, 'bloc surveillants (ajout/modif/suppression)')

# ============================================================================
# 4. JS — ouverture de la modale de modification : bouton Supprimer + mode normal
# ============================================================================
ancien = """function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code || x.email === code);
  if (!c) return;
  profARenommer = c.code || c.email;"""
nouveau = """function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code || x.email === code);
  if (!c) return;
  creationProfil = false;
  profARenommer = c.code || c.email;
  const btnSup = document.getElementById('renommer-supprimer');
  if (btnSup) btnSup.classList.toggle('hidden', c.role !== 'surveillant');"""
sub_once(ancien, nouveau, 'ouvrirRenommageProf : bouton Supprimer')

# ============================================================================
# 5. JS — confirmerRenommageProf : creation d'un surveillant + persistence du renommage
# ============================================================================
ancien = """function confirmerRenommageProf() {
  const code = profARenommer;
  if (!code) return;
  const champ = document.getElementById('renommer-nom');
  const nouveau = champ ? String(champ.value || '').replace(/\\s+/g, ' ').trim() : '';
  if (nouveau.length < 3) { afficherToast('Nom trop court (3 caractères minimum)', 'error'); return; }
  const prof = comptes.find(c => c.code === code || c.email === code);"""
nouveau = """function confirmerRenommageProf() {
  const champ = document.getElementById('renommer-nom');
  const nouveau = champ ? String(champ.value || '').replace(/\\s+/g, ' ').trim() : '';
  if (nouveau.length < 3) { afficherToast('Nom trop court (3 caractères minimum)', 'error'); return; }

  // --- AJOUT d'un surveillant ---
  if (creationProfil) {
    const liste = listeSurveillantsRH();
    const cle = 'surv-' + Date.now();
    liste.push({ cle: cle, code: cle, nom: nouveau, email: '' });
    creationProfil = false;
    nomsProfs[cle] = nouveau; sauvegarderNomsProfs();
    sauvegarderSurveillantsRH(liste);
    fermerRenommageProf();
    afficherListeProfs();
    afficherToast('Surveillant ajoute · ses identifiants seront generes avec le PDF', 'success');
    return;
  }

  const code = profARenommer;
  if (!code) return;
  const prof = comptes.find(c => c.code === code || c.email === code);"""
sub_once(ancien, nouveau, 'confirmerRenommageProf : creation')

# le renommage doit aussi etre enregistre dans la liste des surveillants
ancien = """  if (maj > 0) localStorage.setItem('absences', JSON.stringify(absences));
  afficherListeProfs();"""
nouveau = """  if (maj > 0) localStorage.setItem('absences', JSON.stringify(absences));
  // un surveillant ne vient pas d'un import : son nom doit etre conserve dans sa liste
  if (prof && prof.role === 'surveillant') majSurveillantRH(prof.code || prof.email, { nom: nouveau });
  afficherListeProfs();"""
sub_once(ancien, nouveau, 'renommage persiste pour les surveillants')

# message final adapte au role
ancien = """  fermerRenommageProf();
  afficherToast('Enseignant renommé' + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'success');"""
nouveau = """  fermerRenommageProf();
  const quoi = (prof && prof.role === 'surveillant') ? 'Surveillant modifie' : 'Enseignant renomme';
  afficherToast(quoi + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'success');"""
sub_once(ancien, nouveau, 'message adapte au role')

# ============================================================================
# 6. JS — le moteur (table arabe, generation, PDF) + la popup et le fichier
# ============================================================================
arabe = io.open('_arabe_fn.js', encoding='utf-8').read()
src = io.open('_pdf/identifiants.js', encoding='utf-8').read()
src = re.sub(r'// -+\n// 1\. Abreviation de la matiere[\s\S]*?(?=// -+\n// 2\. Mot de passe)', '', src)
src = re.sub(r'// -+\n// 2\. Mot de passe[\s\S]*?(?=// Un mot de passe est repris tel quel)', '', src)
src = re.sub(r"if \(typeof module !== 'undefined'[\s\S]*$", '', src).rstrip() + '\n'
police = io.open('fonts/police_arabe_b64.js', encoding='utf-8').read()
police = police[police.index('const POLICE_ARABE_B64'):].rstrip()

glue = r'''
// ========== IDENTIFIANTS : emails, mots de passe et PDF ==========
// Une bibliotheque PDF ecrit de gauche a droite et ne sait pas joindre les lettres
// arabes : on met donc les lettres en forme nous-memes (formeArabe) et on laisse
// pdf-lib appliquer le sens droite -> gauche (il le fait DEJA : lui donner un texte
// deja inverse produirait un rendu « miroir »).

''' + police + r'''

function base64VersOctets(b64) {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

// Bibliotheque PDF chargee a la demande (motif identique au lecteur Excel)
let pdfChargement = null;
function chargerBibliothequePDF() {
  if (window.PDFLib && window.fontkit) return Promise.resolve(true);
  if (pdfChargement) return pdfChargement;
  const charger = function (src) {
    return new Promise(function (resoudre, rejeter) {
      const sc = document.createElement('script');
      sc.src = src;
      sc.onload = function () { resoudre(true); };
      sc.onerror = function () { rejeter(new Error('script indisponible')); };
      document.head.appendChild(sc);
    });
  };
  pdfChargement = charger('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js')
    .then(function () { return charger('https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'); })
    .then(function () {
      if (!window.PDFLib || !window.fontkit) throw new Error('bibliotheque PDF incomplete');
      return true;
    })
    .catch(function (e) { pdfChargement = null; throw e; });
  return pdfChargement;
}
async function pdfPret() {
  try { await chargerBibliothequePDF(); return true; }
  catch (e) { afficherToast('Generateur de PDF indisponible (connexion internet requise)', 'error'); return false; }
}

// Un identifiant est a generer si l'email manque/est hors convention, ou si le mot de passe est inutilisable
function identifiantAGenerer(compte) {
  const mdp = motsDePasse[compte.email] || compte.password;
  return !emailIdentifiantConforme(compte.email) || !motDePasseAcceptable(mdp);
}

// Popup de controle avant d'agir
function demanderIdentifiants() {
  const surveillants = comptes.filter(c => c.role === 'surveillant');
  const enseignants = comptes.filter(c => c.role === 'enseignant');
  const personnel = surveillants.concat(enseignants);
  if (!personnel.length) { afficherToast('Aucun compte a pourvoir', 'error'); return; }
  const aGenerer = personnel.filter(identifiantAGenerer).length;
  const detail = surveillants.length + ' surveillant(s), ' + enseignants.length + ' enseignant(s)';
  const message = aGenerer > 0
    ? aGenerer + ' identifiant(s) a generer (' + detail + '). Le fichier PDF va etre telecharge.'
    : 'Les ' + personnel.length + ' identifiants existent deja (' + detail + ') : le PDF sera telecharge a nouveau avec les memes mots de passe.';
  demanderConfirmation(message, telechargerIdentifiants);
}

// Generation + enregistrement + PDF (un seul fichier, deux sous-titres)
async function telechargerIdentifiants() {
  const surveillants = comptes.filter(c => c.role === 'surveillant');
  const enseignants = comptes.filter(c => c.role === 'enseignant');
  if (!surveillants.length && !enseignants.length) return;
  if (!(await pdfPret())) return;
  try {
    const emailsPris = comptes.map(c => c.email).filter(Boolean);
    const sourceDe = function (liste, prefixe, separateur) {
      return liste.map(function (c) {
        return { nom: c.nom, matiere: c.matiere, abreviation: prefixe, separateur: separateur,
                 email: c.email, password: motsDePasse[c.email] || c.password };
      });
    };
    const lignesSurv = genererIdentifiants(sourceDe(surveillants, 'surv', ''), emailsPris);
    const lignesEns = genererIdentifiants(sourceDe(enseignants, null, '-prof'),
                                          emailsPris.concat(lignesSurv.map(function (l) { return l.email; })));

    // enregistrement : re-telecharger le PDF redonne toujours les memes identifiants
    const enregistrer = function (liste, lignes) {
      lignes.forEach(function (l, i) {
        const c = liste[i];
        if (!c) return;
        c.email = l.email;
        if (l.password) { c.password = l.password; motsDePasse[l.email] = l.password; }
      });
    };
    enregistrer(surveillants, lignesSurv);
    enregistrer(enseignants, lignesEns);
    sauvegarderMotsDePasse();
    const listeSurv = listeSurveillantsRH();
    listeSurv.forEach(function (s, i) { if (surveillants[i]) s.email = surveillants[i].email || ''; });
    sauvegarderSurveillantsRH(listeSurv);

    const lib = window.PDFLib;
    const sections = [
      { titre: 'Surveillants', lignes: lignesSurv },
      { titre: 'Enseignants', lignes: lignesEns }
    ];
    const doc = await construirePdfIdentifiants(lib, lib.PDFDocument, window.fontkit,
      base64VersOctets(POLICE_ARABE_B64), sections, {
        etablissement: (etablissement && etablissement.nom) || '',
        annee: (anneeScolaire && anneeScolaire.libelle) || '',
        date: dateAffichage(jourCourant())
      });
    const octets = await doc.save();
    telechargerFichier(octets, 'identifiants.pdf');
    afficherListeProfs();
    afficherToast((lignesSurv.length + lignesEns.length) + ' identifiants enregistres et telecharges', 'success');
  } catch (e) {
    afficherToast('Generation du PDF impossible : ' + (e && e.message ? e.message : e), 'error');
  }
}

// Telechargement du fichier produit
function telechargerFichier(octets, nom) {
  const blob = new Blob([octets], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  setTimeout(function () { URL.revokeObjectURL(url); if (lien.parentNode) lien.parentNode.removeChild(lien); }, 2000);
}
'''

ancre = """function afficherListeProfs() {
  afficherComptes('dir-profs-list', 'enseignant');
  afficherComptes('dir-surveillants-list', 'surveillant');
}
"""
# on insere le moteur juste apres le bloc personnel (sans retoucher l'ancre : elle a deja servi)
sub_once(persistance, persistance + '\n' + arabe.rstrip() + '\n\n' + src + '\n' + glue,
         'moteur identifiants + PDF')

# ============================================================================
# 7. label de version
# ============================================================================
sub_once('AbsenceTrack v3.73', 'AbsenceTrack v3.75', 'label v3.75')

if not ok:
    print('=== PATCH ANNULE (ancres non trouvees) ==='); sys.exit(1)

shutil.copyfile(F, 'AbsenceTrack-v3.73-backup.html')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)' % (F, len(html.encode('utf-8'))))
