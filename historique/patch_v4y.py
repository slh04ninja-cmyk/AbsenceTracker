# -*- coding: utf-8 -*-
# patch_v4y.py -> v3.61 (partie 2/2)
# - Mots de passe persistants (changement de mot de passe + mot de passe genere par le directeur)
# - Popup "Mon profil" du directeur (nom + mot de passe)
# - Section RH affichee dans la page Profil/RH selon le role
# - Liste des professeurs compacte + email + mot de passe genere dans la modale de modification
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
# 1. Mots de passe persistants + generes
# ══════════════════════════════════════════════════════════════════
rep("""let nomsProfs = chargerNomsProfs();
function sauvegarderNomsProfs() { localStorage.setItem('nomsProfs', JSON.stringify(nomsProfs)); }
function appliquerNomsProfs() {
  comptes.forEach(c => { if (c.code && nomsProfs[c.code]) c.nom = nomsProfs[c.code]; });
}""",
"""let nomsProfs = chargerNomsProfs();
function sauvegarderNomsProfs() { localStorage.setItem('nomsProfs', JSON.stringify(nomsProfs)); }
function appliquerNomsProfs() {
  comptes.forEach(c => {
    const cle = c.code || c.email;
    if (cle && nomsProfs[cle]) c.nom = nomsProfs[cle];
  });
}
// Mots de passe modifies ou generes : persistes par email (avant, le changement etait perdu au rechargement)
function chargerMotsDePasse() {
  try {
    const brut = localStorage.getItem('motsDePasse');
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
let motsDePasse = chargerMotsDePasse();
function sauvegarderMotsDePasse() { localStorage.setItem('motsDePasse', JSON.stringify(motsDePasse)); }
function appliquerMotsDePasse() {
  comptes.forEach(c => { if (motsDePasse[c.email]) c.password = motsDePasse[c.email]; });
}
// Mot de passe aleatoire valide (lettres + chiffres, sans caracteres speciaux)
function genererMotDePasse(longueur) {
  const n = longueur || 8;
  const lettres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const chiffres = '23456789';
  const tous = lettres + chiffres;
  const tirer = t => t[Math.floor(Math.random() * t.length)];
  let mdp = tirer(lettres) + tirer(chiffres);
  while (mdp.length < n) mdp += tirer(tous);
  return mdp.split('').sort(() => Math.random() - 0.5).join('');
}
function genererMotDePasseProf() {
  const champ = document.getElementById('renommer-mdp');
  if (!champ) return;
  champ.value = genererMotDePasse(8);
  const suc = document.getElementById('renommer-success');
  if (suc) suc.classList.add('hidden');
}""",
    1, 'JS : mots de passe persistants + generateur')

# ══════════════════════════════════════════════════════════════════
# 2. changerMotDePasse(prefixe) : formulaire de page + popup du directeur
# ══════════════════════════════════════════════════════════════════
rep("""function changerMotDePasse() {
  const ancien = document.getElementById('profil-ancien').value;
  const nouveau = document.getElementById('profil-nouveau').value;
  const confirmer = document.getElementById('profil-confirmer').value;
  const errDiv = document.getElementById('profil-error');
  const sucDiv = document.getElementById('profil-success');""",
"""function motDePasseSaisi(prefixe) {
  const lire = k => { const el = document.getElementById(prefixe + '-' + k); return el ? String(el.value || '') : ''; };
  const ancien = lire('ancien');
  const nouveau = lire('nouveau');
  const confirmer = lire('confirmer');
  return { ancien: ancien, nouveau: nouveau, confirmer: confirmer, vide: (!ancien && !nouveau && !confirmer) };
}

// prefixe = 'profil' (page Profil) ou 'mdpdir' (popup Mon profil du directeur)
function changerMotDePasse(prefixe) {
  const p = prefixe || 'profil';
  const champs = motDePasseSaisi(p);
  const ancien = champs.ancien;
  const nouveau = champs.nouveau;
  const confirmer = champs.confirmer;
  const errDiv = document.getElementById(p + '-error');
  const sucDiv = document.getElementById(p + '-success');""",
    1, 'changerMotDePasse : parametre prefixe')

rep("""  // Mettre à jour dans comptes
  const idx = comptes.findIndex(c => c.email === utilisateurConnecte.email);
  if (idx >= 0) {
    comptes[idx].password = nouveau;
    utilisateurConnecte.password = nouveau;
    localStorage.setItem('utilisateur', JSON.stringify(utilisateurConnecte));
  }
  document.getElementById('profil-ancien').value = '';
  document.getElementById('profil-nouveau').value = '';
  document.getElementById('profil-confirmer').value = '';
  sucDiv.textContent = 'Mot de passe modifié avec succès !';
  sucDiv.classList.remove('hidden');
  afficherToast('Mot de passe modifié', 'success');
}""",
"""  // Mettre à jour dans comptes + persister (localStorage 'motsDePasse')
  const idx = comptes.findIndex(c => c.email === utilisateurConnecte.email);
  if (idx >= 0) {
    comptes[idx].password = nouveau;
    utilisateurConnecte.password = nouveau;
    localStorage.setItem('utilisateur', JSON.stringify(utilisateurConnecte));
  }
  motsDePasse[utilisateurConnecte.email] = nouveau;
  sauvegarderMotsDePasse();
  ['ancien', 'nouveau', 'confirmer'].forEach(k => { const el = document.getElementById(p + '-' + k); if (el) el.value = ''; });
  sucDiv.textContent = 'Mot de passe modifié avec succès !';
  sucDiv.classList.remove('hidden');
  afficherToast('Mot de passe modifié', 'success');
}

// ========== POPUP "MON PROFIL" (directeur) ==========
function ouvrirProfilDir() {
  if (!utilisateurConnecte) return;
  const nom = document.getElementById('mdpdir-nom');
  if (nom) nom.value = utilisateurConnecte.nom || '';
  const mail = document.getElementById('mdpdir-email');
  if (mail) mail.textContent = 'Connexion : ' + (utilisateurConnecte.email || '');
  ['ancien', 'nouveau', 'confirmer'].forEach(k => { const el = document.getElementById('mdpdir-' + k); if (el) el.value = ''; });
  const err = document.getElementById('mdpdir-error');
  if (err) err.classList.add('hidden');
  const suc = document.getElementById('mdpdir-success');
  if (suc) suc.classList.add('hidden');
  document.getElementById('modal-profil-dir').classList.remove('hidden');
}
function fermerProfilDir() {
  const m = document.getElementById('modal-profil-dir');
  if (m) m.classList.add('hidden');
}
function enregistrerProfilDir() {
  if (!utilisateurConnecte) return;
  const champNom = document.getElementById('mdpdir-nom');
  const nom = champNom ? String(champNom.value || '').replace(/\\s+/g, ' ').trim() : '';
  if (nom && nom.length < 3) { afficherToast('Nom trop court (3 caractères minimum)', 'error'); return; }
  if (nom) {
    const cle = utilisateurConnecte.code || utilisateurConnecte.email;
    const ancien = utilisateurConnecte.nom;
    nomsProfs[cle] = nom;
    sauvegarderNomsProfs();
    comptes.forEach(c => { if (c.email === utilisateurConnecte.email) c.nom = nom; });
    utilisateurConnecte.nom = nom;
    localStorage.setItem('utilisateur', JSON.stringify(utilisateurConnecte));
    if (ancien && ancien !== nom) {
      let maj = 0;
      absences.forEach(a => { if (a.enseignant === ancien) { a.enseignant = nom; maj++; } });
      if (maj > 0) localStorage.setItem('absences', JSON.stringify(absences));
    }
    const elNom = document.getElementById('profil-nom');
    if (elNom) elNom.textContent = nom;
  }
  // Mot de passe : uniquement si les champs sont remplis
  if (!motDePasseSaisi('mdpdir').vide) { changerMotDePasse('mdpdir'); return; }
  const suc = document.getElementById('mdpdir-success');
  if (suc) { suc.textContent = 'Profil enregistré'; suc.classList.remove('hidden'); }
  afficherToast('Profil enregistré', 'success');
}""",
    1, 'JS : popup Mon profil')

# ══════════════════════════════════════════════════════════════════
# 3. Section RH : affichage selon le role + hooks
# ══════════════════════════════════════════════════════════════════
rep("""function afficherGestionDir() {
  afficherParametres();
  bornerDatesAnnee();
  remplirProfsIndispo();
  afficherFermetures();
  afficherIndispos();
  afficherListeProfs();""",
"""function afficherGestionDir() {
  afficherParametres();
  bornerDatesAnnee();
  afficherFermetures();""",
    1, 'afficherGestionDir : cartes RH retirees')

rep("""function switchProfil(el) {
  afficherEcran('profil');
  afficherTableauServiceProfil();""",
"""// Page Profil : RH pour le directeur (identite compacte + bouton Profil + rubriques RH)
function afficherRH() {
  const estDir = !!utilisateurConnecte && utilisateurConnecte.role === 'directeur';
  const rh = document.getElementById('profil-rh');
  if (rh) rh.style.display = estDir ? 'block' : 'none';
  const btnP = document.getElementById('btn-profil-dir');
  if (btnP) btnP.style.display = estDir ? 'inline-flex' : 'none';
  // le formulaire de mot de passe reste sur la page pour les autres roles (il est dans le popup pour le directeur)
  const mdpPage = document.getElementById('profil-mdp-page');
  if (mdpPage) mdpPage.style.display = estDir ? 'none' : 'block';
  if (estDir) {
    bornerDatesAnnee();
    remplirProfsIndispo();
    afficherIndispos();
    afficherListeProfs();
  }
}

function switchProfil(el) {
  afficherEcran('profil');
  afficherTableauServiceProfil();
  afficherRH();""",
    1, 'JS : afficherRH + hook switchProfil')

rep("""function init() {
  appliquerNomsProfs();
  majEtiquetteAnnee();""",
"""function init() {
  appliquerNomsProfs();
  appliquerMotsDePasse();
  majEtiquetteAnnee();""",
    1, 'init : mots de passe persistants')

# ══════════════════════════════════════════════════════════════════
# 4. Liste des professeurs : padding minimal + modale (email + mot de passe)
# ══════════════════════════════════════════════════════════════════
rep("""    item.className = 'flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg';
    item.innerHTML = '<div><p class="font-medium text-gray-700">' + (c.nom || '') + '</p>' +
      '<p class="text-xs text-gray-500">' + (c.matiere || '') + ' · ' + (c.code || '') + '</p></div>';""",
"""    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.innerHTML = '<div style="min-width: 0;"><p class="font-medium text-gray-700" style="font-size: 13px;">' + (c.nom || '') + '</p>' +
      '<p class="text-xs text-gray-500">' + (c.matiere || '') + ' · ' + (c.email || '') + '</p></div>';""",
    1, 'liste profs : cartes compactes + email')

rep("""        <div id="dir-profs-list" class="space-y-2"></div>""",
    """        <div id="dir-profs-list" class="liste-reglages"></div>""",
    1, 'liste profs : conteneur a defilement')

rep("""function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code);
  if (!c) return;
  profARenommer = code;
  const champ = document.getElementById('renommer-nom');
  if (champ) champ.value = c.nom || '';
  const info = document.getElementById('renommer-info');
  if (info) info.textContent = (c.matiere || '') + ' · ' + code;
  document.getElementById('modal-renommer').classList.remove('hidden');
}""",
"""function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code);
  if (!c) return;
  profARenommer = code;
  const champ = document.getElementById('renommer-nom');
  if (champ) champ.value = c.nom || '';
  const info = document.getElementById('renommer-info');
  if (info) info.textContent = (c.matiere || '') + ' · ' + code;
  const mail = document.getElementById('renommer-email');
  if (mail) mail.textContent = 'Email de connexion : ' + (c.email || '');
  const mdp = document.getElementById('renommer-mdp');
  if (mdp) mdp.value = '';
  const suc = document.getElementById('renommer-success');
  if (suc) suc.classList.add('hidden');
  document.getElementById('modal-renommer').classList.remove('hidden');
}""",
    1, 'ouvrirRenommageProf : email + reset mdp')

rep("""  const prof = comptes.find(c => c.code === code);
  const ancien = prof ? prof.nom : '';
  nomsProfs[code] = nouveau;
  sauvegarderNomsProfs();
  if (prof) prof.nom = nouveau;""",
"""  const prof = comptes.find(c => c.code === code);
  const ancien = prof ? prof.nom : '';
  nomsProfs[code] = nouveau;
  sauvegarderNomsProfs();
  if (prof) prof.nom = nouveau;
  // Mot de passe de connexion (genere ou saisi) : valide puis persiste
  const champMdp = document.getElementById('renommer-mdp');
  const mdp = champMdp ? String(champMdp.value || '').trim() : '';
  if (mdp) {
    const souci = validerMotDePasse(mdp);
    if (souci) { afficherToast(souci, 'error'); return; }
    if (prof) { prof.password = mdp; motsDePasse[prof.email] = mdp; sauvegarderMotsDePasse(); }
  }""",
    1, 'confirmerRenommageProf : mot de passe')

rep("""  if (maj > 0) localStorage.setItem('absences', JSON.stringify(absences));
  fermerRenommageProf();
  afficherListeProfs();
  afficherToast('Enseignant renommé' + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'success');
}""",
"""  if (maj > 0) localStorage.setItem('absences', JSON.stringify(absences));
  afficherListeProfs();
  if (mdp && prof) {
    // On laisse la modale ouverte pour que le directeur note les identifiants
    const suc = document.getElementById('renommer-success');
    if (suc) {
      suc.textContent = 'Connexion : ' + prof.email + ' / ' + mdp;
      suc.classList.remove('hidden');
    }
    afficherToast('Mot de passe défini', 'success');
    return;
  }
  fermerRenommageProf();
  afficherToast('Enseignant renommé' + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'success');
}""",
    1, 'confirmerRenommageProf : identifiants affiches')

# HTML : modale de renommage enrichie (email + mot de passe + conditions)
rep("""      <p class="text-sm text-gray-500 mb-3 text-center" id="renommer-info"></p>
      <div class="form-group">
        <label>Nom complet</label>
        <input type="text" id="renommer-nom" placeholder="Nom et prénom">
      </div>
      <div class="flex gap-3">
        <button onclick="fermerRenommageProf()" class="btn-fermer flex-1">Annuler</button>
        <button onclick="confirmerRenommageProf()" class="btn-primary flex-1"><i class="fas fa-save"></i> Enregistrer</button>
      </div>""",
"""      <p class="text-xs text-gray-500 mb-2 text-center" id="renommer-info"></p>
      <p class="text-xs text-gray-500 mb-2 text-center" id="renommer-email"></p>
      <div id="renommer-success" class="hidden bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg p-2 mb-2 text-center" style="word-break: break-all;"></div>
      <div class="form-group">
        <label>Nom complet</label>
        <input type="text" id="renommer-nom" placeholder="Nom et prénom">
      </div>
      <div class="form-group">
        <label>Mot de passe de connexion</label>
        <div class="flex gap-2">
          <input type="text" id="renommer-mdp" placeholder="8 caractères (lettres + chiffres)" style="flex: 1; min-width: 0;">
          <button type="button" onclick="genererMotDePasseProf()" class="btn-mini-profil" style="border-color: #059669; color: #059669;"><i class="fas fa-dice"></i> Générer</button>
        </div>
      </div>
      <ul class="text-xs text-gray-600 space-y-1 mb-3">
        <li><i class="fas fa-check-circle text-green-500 mr-2"></i>8 caractères, lettres et chiffres (sans caractères spéciaux)</li>
      </ul>
      <div class="flex gap-3">
        <button onclick="fermerRenommageProf()" class="btn-fermer flex-1">Fermer</button>
        <button onclick="confirmerRenommageProf()" class="btn-primary flex-1"><i class="fas fa-save"></i> Enregistrer</button>
      </div>""",
    1, 'HTML : modale renommage + mdp')

rep("""  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl">
    <div class="flex items-center px-5 pt-4 pb-2">
      <span style="width: 28px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center">Nom de l'enseignant</h2>""",
"""  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl carte-settings">
    <div class="flex items-center px-5 pt-4 pb-2">
      <span style="width: 28px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center">Nom de l'enseignant</h2>""",
    1, 'modale renommage compacte')

# ══════════════════════════════════════════════════════════════════
# 5. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.60', 'AbsenceTrack v3.61', 1, 'label v3.61')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
