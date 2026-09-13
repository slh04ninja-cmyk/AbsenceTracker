// fichier: app/js/13-fiches.js
// ========== FICHE ELEVE ==========
let ficheEleveId = null;
let ficheClasseId = null;

function ligneFiche(titre, valeur) {
  return '<div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">' + titre + '</span><span class="text-sm font-semibold text-gray-800">' + valeur + '</span></div>';
}

// Cascade de la fiche eleve : les lignes de l'historique montent l'une apres l'autre, et les
// boutons restent INERTES tant qu'ils sont invisibles (un appui a l'aveugle ne doit rien faire).
let ficheAnimMinuterie = null;

function animerFicheEleve() {
  const modal = document.getElementById('modal-fiche-eleve');
  if (!modal) return;
  const cont = document.getElementById('fiche-historique');
  if (cont) {
    Array.prototype.forEach.call(cont.children, function (ligne, i) {
      ligne.classList.add('fiche-ligne');
      ligne.style.animationDelay = Math.min(0.24 + i * 0.05, 0.6).toFixed(2) + 's';
    });
  }
  const blocs = modal.querySelectorAll('.fiche-anim');
  Array.prototype.forEach.call(blocs, function (b) { b.classList.remove('pret'); });
  // relance l'animation meme si la fiche etait deja ouverte
  Array.prototype.forEach.call(blocs, function (b) { b.style.animation = 'none'; });
  void modal.offsetWidth;
  Array.prototype.forEach.call(blocs, function (b) { b.style.animation = ''; });
  if (ficheAnimMinuterie) clearTimeout(ficheAnimMinuterie);
  ficheAnimMinuterie = setTimeout(function () {
    Array.prototype.forEach.call(blocs, function (b) { b.classList.add('pret'); });
  }, 820);
}

function ouvrirFicheEleve(eleveId, classeId) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  ficheEleveId = eleveId;
  ficheClasseId = classeId;
  document.getElementById('fiche-titre').textContent = libelleEleve(el);
  let lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  // Un enseignant ne voit que les Ab/Rd qu'il a lui-meme signales
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') {
    lignes = lignes.filter(a => a.enseignant === utilisateurConnecte.nom);
  }
  const nbAbs = lignes.filter(a => typeEffectif(a) !== 'retard').length;
  const nbRet = lignes.filter(a => typeEffectif(a) === 'retard').length;
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', nbAbs + ' ' + (nbAbs < 2 ? 'absence' : 'absences') + ' · ' + nbRet + ' ' + (nbRet < 2 ? 'retard' : 'retards'));

  const cont = document.getElementById('fiche-historique');
  if (lignes.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    // Tri par datetime decroissant (date puis heure)
    const tri = lignes.slice().sort((a, b) => {
      const da = String(a.dateISO || '');
      const db = String(b.dateISO || '');
      if (da !== db) return db.localeCompare(da);
      return String(b.heure || '').localeCompare(String(a.heure || ''));
    });
    cont.innerHTML = tri.map(a => {
      const retard = typeEffectif(a) === 'retard';
      const code = codeApprobation(a);
      const marque = retard ? 'Rd' : 'Ab';
      const palM = couleursAbsRd();
      const styleMarque = 'color: ' + (retard ? palM.rd : palM.abs) + '; font-weight: 800;';
      const info = abrevMatiere(a.matiere) + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      // Un Ab/Rd regle a toujours sa ligne d'approbation ; si l'enregistrement est ancien
      // (pas de justifieLe), on retombe sur la datetime de l'absence, puis sur '—'.
      const quandApprobation = a.justifieLe || (a.dateISO ? (String(a.dateISO) + (a.heure ? ' ' + a.heure : '')) : '');
      const ligneApprobation = code
        ? '<div class="flex justify-between items-center mt-1"><span class="text-xs text-gray-500">Approuvé le ' + (quandApprobation ? dateHeureApprobation(quandApprobation) : '—') + '</span><span style="' + styleMarque + '; font-size: 12px;">' + code + '</span></div>'
        : '';
      return '<div class="py-2 border-b border-gray-200"><div class="flex justify-between items-center"><span class="text-sm font-semibold text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + styleMarque + '">' + marque + '</span></div>' + ligneApprobation + '<p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
    }).join('');
  }
  animerFicheEleve();
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}

function ouvrirFicheEleveParNom(nom, nomClasse) {
  const cible = String(nom || '').replace(/\s+/g, ' ').trim();
  const cl = classes.find(c => c.nom === nomClasse)
    || classes.find(c => String(c.nom || '').toLowerCase() === String(nomClasse || '').toLowerCase());
  if (!cl) { afficherToast('Élève introuvable', 'error'); return; }
  const meme = e => String(libelleEleve(e) || '').replace(/\s+/g, ' ').trim() === cible;
  const el = cl.eleves.find(meme)
    || cl.eleves.find(e => String(e.nom || '').replace(/\s+/g, ' ').trim() === cible)
    || cl.eleves.find(e => String(e.nomFr || '').replace(/\s+/g, ' ').trim() === cible)
    || cl.eleves.find(e => String(e.nomArabe || '').replace(/\s+/g, ' ').trim() === cible);
  if (!el) { afficherToast('Élève introuvable', 'error'); return; }
  ouvrirFicheEleve(el.id, cl.id);
}

function fermerFicheEleve() {
  if (ficheAnimMinuterie) clearTimeout(ficheAnimMinuterie);
  const mf = document.getElementById('modal-fiche-eleve');
  if (mf) Array.prototype.forEach.call(mf.querySelectorAll('.fiche-anim.pret'), function (b) { b.classList.remove('pret'); });
  document.getElementById('modal-fiche-eleve').classList.add('hidden');
  ficheEleveId = null;
  ficheClasseId = null;
}

async function exporterFicheEleve() {
  if (!(await xlsxPret())) return;
  if (!ficheEleveId) return;
  const cl = classes.find(c => c.id === ficheClasseId);
  const el = cl ? cl.eleves.find(e => e.id === ficheEleveId) : null;
  if (!el) return;
  const lignes = absences.filter(a => a.eleveId === ficheEleveId && a.classe === cl.nom);
  const rows = lignes.map(a => ({
    Date: a.date || '',
    Seance: libelleSeance(a.seance),
    Heure: a.heure || '',
    Type: libelleType(typeEffectif(a)),
    Duree: a.duree || '',
    Matiere: a.matiere || '',
    Enseignant: a.enseignant || '',
    Statut: libelleStatutAbs(a),
    Motif: a.motif || '',
    JustifiePar: a.justifiePar || '',
    JustifieLe: a.justifieLe || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucun incident' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fiche');
  XLSX.writeFile(wb, 'fiche_' + (el.nom || 'eleve').replace(/\s+/g, '_') + '.xlsx');
  afficherToast('Fiche exportée', 'success');
}

// ========== PROFIL & MOT DE PASSE ==========
// Page Profil : RH pour le directeur (identite compacte + bouton Profil + rubriques RH)
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
    afficherListeProfs();
    afficherIndispos();
  }
}

function switchProfil(el) {
  afficherEcran('profil');
  afficherTableauServiceProfil();
  afficherRH();
  // Cacher tous les nav profil
  ['profil-nav-ens', 'profil-nav-surv', 'profil-nav-dir'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Afficher le bon nav selon le rôle
  if (utilisateurConnecte) {
    let navId = 'profil-nav-ens';
    if (utilisateurConnecte.role === 'surveillant') navId = 'profil-nav-surv';
    else if (utilisateurConnecte.role === 'directeur') navId = 'profil-nav-dir';
    const nav = document.getElementById(navId);
    if (nav) nav.style.display = 'flex';
    const nomEl = document.getElementById('profil-nom');
    const roleEl = document.getElementById('profil-role');
    if (nomEl) nomEl.textContent = utilisateurConnecte.nom;
    if (roleEl) roleEl.textContent = utilisateurConnecte.role.charAt(0).toUpperCase() + utilisateurConnecte.role.slice(1) + (utilisateurConnecte.matiere ? ' · ' + utilisateurConnecte.matiere : '');
  }
  // Reset champs
  document.getElementById('profil-ancien').value = '';
  document.getElementById('profil-nouveau').value = '';
  document.getElementById('profil-confirmer').value = '';
  document.getElementById('profil-error').classList.add('hidden');
  document.getElementById('profil-success').classList.add('hidden');
}

function validerMotDePasse(mdp) {
  if (mdp.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères';
  if (!/[a-zA-Z]/.test(mdp)) return 'Le mot de passe doit contenir au moins une lettre';
  if (!/[0-9]/.test(mdp)) return 'Le mot de passe doit contenir au moins un chiffre';
  if (/[^a-zA-Z0-9]/.test(mdp)) return 'Le mot de passe ne doit contenir que des lettres et des chiffres (pas de caractères spéciaux)';
  return null;
}

function motDePasseSaisi(prefixe) {
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
  const sucDiv = document.getElementById(p + '-success');

  errDiv.classList.add('hidden');
  sucDiv.classList.add('hidden');

  if (!ancien || !nouveau || !confirmer) {
    errDiv.textContent = 'Veuillez remplir tous les champs';
    errDiv.classList.remove('hidden');
    return;
  }
  if (ancien !== utilisateurConnecte.password) {
    errDiv.textContent = "L'ancien mot de passe est incorrect";
    errDiv.classList.remove('hidden');
    return;
  }
  const erreur = validerMotDePasse(nouveau);
  if (erreur) {
    errDiv.textContent = erreur;
    errDiv.classList.remove('hidden');
    return;
  }
  if (nouveau !== confirmer) {
    errDiv.textContent = 'Les deux mots de passe ne correspondent pas';
    errDiv.classList.remove('hidden');
    return;
  }
  if (nouveau === ancien) {
    errDiv.textContent = 'Le nouveau mot de passe doit différer de l\'ancien';
    errDiv.classList.remove('hidden');
    return;
  }
  // Mettre à jour dans comptes + persister (via Depot)
  const idx = comptes.findIndex(c => c.email === utilisateurConnecte.email);
  if (idx >= 0) {
    comptes[idx].password = nouveau;
    utilisateurConnecte.password = nouveau;
    Depot.ecrireJSON('utilisateur', utilisateurConnecte);
  }
  motsDePasse[utilisateurConnecte.email] = nouveau;
  sauvegarderMotsDePasse();
  ['ancien', 'nouveau', 'confirmer'].forEach(k => { const el = document.getElementById(p + '-' + k); if (el) el.value = ''; });
  sucDiv.textContent = 'Mot de passe modifié avec succès !';
  sucDiv.classList.remove('hidden');
  afficherToast('Mot de passe modifié', 'modif');
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
  const nom = champNom ? String(champNom.value || '').replace(/\s+/g, ' ').trim() : '';
  if (nom && nom.length < 3) { afficherToast('Nom trop court (3 caractères minimum)', 'error'); return; }
  if (nom) {
    const cle = utilisateurConnecte.code || utilisateurConnecte.email;
    const ancien = utilisateurConnecte.nom;
    nomsProfs[cle] = nom;
    sauvegarderNomsProfs();
    comptes.forEach(c => { if (c.email === utilisateurConnecte.email) c.nom = nom; });
    utilisateurConnecte.nom = nom;
    Depot.ecrireJSON('utilisateur', utilisateurConnecte);
    if (ancien && ancien !== nom) {
      let maj = 0;
      absences.forEach(a => { if (a.enseignant === ancien) { a.enseignant = nom; maj++; } });
      if (maj > 0) Depot.ecrireJSON('absences', absences);
    }
    const elNom = document.getElementById('profil-nom');
    if (elNom) elNom.textContent = nom;
  }
  // Mot de passe : uniquement si les champs sont remplis
  if (!motDePasseSaisi('mdpdir').vide) { changerMotDePasse('mdpdir'); return; }
  const suc = document.getElementById('mdpdir-success');
  if (suc) { suc.textContent = 'Profil enregistré'; suc.classList.remove('hidden'); }
  afficherToast('Profil enregistré', 'modif');
}

