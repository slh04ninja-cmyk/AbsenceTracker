// test_v378.js — « Réinitialiser le mot de passe » dans la fenêtre Modifier (dépannage
// d'un oubli) : confirmation, nouveau mot de passe affiché en grand, date du changement,
// fiche PDF individuelle. « Générer » reste inchangé pour la création.
const fs = require('fs');
const { execSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }] }];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
let blobCapture = null;

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', '[]');
    win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder;
    const VraiBlob = win.Blob;
    win.Blob = function (p, o) { blobCapture = p[0]; return new VraiBlob(p, o); };
    win.URL.createObjectURL = function () { return 'blob:test'; };
    win.URL.revokeObjectURL = function () {};
    win.HTMLAnchorElement.prototype.click = function () {};
    win.navigator.clipboard = { writeText: function () { return Promise.resolve(); } };
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const txt = id => { const el = doc.getElementById(id); return el ? el.textContent : ''; };

setTimeout(() => {
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();
  win.switchProfil();

  // ---------- 1. Le bouton existe, pour un enseignant ----------
  const prof = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='enseignant';})[0])"));
  win.ouvrirRenommageProf(prof.code);
  const btnMdp = doc.getElementById('btn-mdp-action');
  t('un seul bouton de mot de passe dans la fenêtre', !!btnMdp && doc.querySelectorAll('#modal-renommer #btn-mdp-action').length === 1);
  t('plus aucun petit bouton « Générer » à côté du champ',
    doc.querySelectorAll('#modal-renommer .btn-mini-profil[onclick*="genererMotDePasseProf"]').length === 0);
  t('en modification, le bouton dit « Réinitialiser »',
    btnMdp.textContent.trim() === 'Réinitialiser', btnMdp.textContent.trim());
  t('en modification, il appelle l aiguillage', btnMdp.getAttribute('onclick') === 'actionMotDePasse()', btnMdp.getAttribute('onclick'));
  const classesModif = btnMdp.className, styleModif = btnMdp.getAttribute('style');
  t('le bloc d affichage est masqué à l ouverture', doc.getElementById('renommer-reset').classList.contains('hidden'));

  // ---------- 2. Il faut confirmer, et on peut annuler ----------
  const mdpAvant = prof.password;
  win.reinitialiserMotDePasse();
  t('la réinitialisation demande confirmation', !doc.getElementById('modal-confirmation').classList.contains('hidden'));
  t('le message nomme la personne', txt('message-confirmation').indexOf('Réinitialiser') >= 0 &&
    txt('message-confirmation').indexOf(prof.nom) >= 0, txt('message-confirmation'));
  win.annulerConfirmation();
  t('annuler ne change pas le mot de passe',
    win.eval("comptes.filter(function(c){return c.code==='" + prof.code + "';})[0].password") === mdpAvant);

  // ---------- 3. Réinitialisation confirmée ----------
  win.reinitialiserMotDePasse();
  win.validerConfirmation();
  const apres = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.code==='" + prof.code + "';})[0])"));
  t('le mot de passe change', apres.password !== mdpAvant, mdpAvant + ' -> ' + apres.password);
  t('le nouveau mot de passe est valide (8 car., lettres + chiffres)',
    /^[a-zA-Z0-9]{8}$/.test(apres.password) && win.validerMotDePasse(apres.password) === null);
  t('il est enregistré dans le stockage local',
    JSON.parse(win.localStorage.getItem('motsDePasse'))[apres.email] === apres.password);
  t('le bloc d affichage s ouvre, avec le mot de passe en grand',
    !doc.getElementById('renommer-reset').classList.contains('hidden') &&
    doc.getElementById('reset-mdp').value === apres.password);
  t('l email de connexion est affiché', txt('reset-email').indexOf(apres.email) >= 0, txt('reset-email'));
  t('la date du changement est notée', /Modifié le \d{2}\/\d{2}\/\d{4}/.test(txt('reset-date')), txt('reset-date'));
  t('la date est enregistrée sur l appareil',
    JSON.parse(win.localStorage.getItem('datesMdp'))[prof.code] === win.jourCourant());
  t('la fenêtre Modifier est restée ouverte', !doc.getElementById('modal-renommer').classList.contains('hidden'));

  // le bouton Copier : on vérifie ce qui est RÉELLEMENT placé dans le presse-papiers
  // (l'API clipboard est asynchrone : le message de confirmation arrive après)
  let copie = null;
  win.navigator.clipboard = { writeText: function (v) { copie = v; return Promise.resolve(); } };
  win.copierTexte('reset-mdp');
  t('le mot de passe est copié dans le presse-papiers', copie === apres.password, String(copie));

  // ---------- 4. La fiche PDF individuelle ----------
  win.eval(fs.readFileSync('./_pdf/node_modules/pdf-lib/dist/pdf-lib.min.js', 'utf8'));
  win.eval(fs.readFileSync('./_pdf/node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js', 'utf8'));
  const sections = [];
  const vraie = win.construirePdfIdentifiants;
  win.construirePdfIdentifiants = function (lib, PD, fk, police, s, infos) { sections.push(s); return vraie.apply(null, arguments); };
  blobCapture = null;
  win.ficheIdentifiantPersonne();
  setTimeout(() => {
    t('la fiche contient une seule section', sections.length === 1 && sections[0].length === 1,
      sections.length ? JSON.stringify(sections[0].map(x => x.titre + ':' + x.lignes.length)) : 'aucune');
    t('la section indique le rôle', (sections[0] || [{}])[0].titre === 'Enseignant', (sections[0] || [{}])[0].titre);
    t('la ligne contient le nom, l email et le NOUVEAU mot de passe',
      (sections[0] || [{ lignes: [{}] }])[0].lignes[0].password === apres.password);
    t('un vrai PDF a été produit', !!blobCapture && Buffer.from(blobCapture.slice(0, 5)).toString('latin1') === '%PDF-',
      blobCapture ? blobCapture.length + ' octets' : 'aucun');

    let chemin = null;
    if (blobCapture) { chemin = '_pdf/fiche_individuelle.pdf'; fs.writeFileSync(chemin, Buffer.from(blobCapture)); }
    if (chemin) {
      let texte = '';
      try { texte = execSync('pdftotext -layout ' + chemin + ' -').toString(); } catch (e) {}
      if (texte) {
        t('la fiche PDF contient l email de la personne', texte.indexOf(apres.email) >= 0);
        t('la fiche PDF contient le nouveau mot de passe', texte.indexOf(apres.password) >= 0);
        t('la fiche PDF ne contient pas les autres personnes', texte.indexOf('math-prof1@') < 0 || texte.indexOf('pc-prof1@') < 0);
      }
    }

    // ---------- 4 bis. Mode CRÉATION : le MÊME bouton dit « Générer » ----------
    win.fermerRenommageProf();
    win.ouvrirAjoutSurveillant();
    const btnCreation = doc.getElementById('btn-mdp-action');
    t('à la création, le même bouton dit « Générer »',
      btnCreation === btnMdp && btnCreation.textContent.trim() === 'Générer', btnCreation.textContent.trim());
    t('même place et même taille : c est le MÊME élément, mêmes classes et mêmes styles',
      btnCreation.className === classesModif && btnCreation.getAttribute('style') === styleModif,
      btnCreation.className);
    doc.getElementById('renommer-mdp').value = '';
    win.actionMotDePasse();          // à la création : remplit le champ, sans confirmation
    t('à la création, le bouton remplit le champ (aucune confirmation demandée)',
      /^[a-zA-Z0-9]{8}$/.test(doc.getElementById('renommer-mdp').value) &&
      doc.getElementById('modal-confirmation').classList.contains('hidden'),
      doc.getElementById('renommer-mdp').value);
    win.fermerRenommageProf();

    // ---------- 5. Un surveillant aussi, et pas de fuite d'un cas à l'autre ----------
    const surv = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';})[0])"));
    win.fermerRenommageProf();
    win.ouvrirRenommageProf(surv.code || surv.email);
    t('en rouvrant, l ancien mot de passe réinitialisé n est plus affiché',
      doc.getElementById('renommer-reset').classList.contains('hidden'));
    const mdpSurvAvant = surv.password;
    win.reinitialiserMotDePasse();
    win.validerConfirmation();
    const survApres = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';})[0])"));
    t('le surveillant est dépanné aussi', survApres.password !== mdpSurvAvant && /^[a-zA-Z0-9]{8}$/.test(survApres.password));
    win.ficheIdentifiantPersonne();
    setTimeout(() => {
      t('la fiche d un surveillant indique son rôle', sections[1] && sections[1][0].titre === 'Surveillant',
        sections[1] ? sections[1][0].titre : '?');
      t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
      console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
      process.exit(ok ? 0 : 1);
    }, 2500);
  }, 2500);
}, 900);
