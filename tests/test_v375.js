// test_v375.js — carte « Surveillants » (ajouter / modifier / supprimer) et identifiants
// du personnel : emails + mots de passe des surveillants ET des enseignants,
// popup de contrôle, un seul PDF avec deux sous-titres (Surveillants puis Enseignants).
// Le PDF est réellement produit ici (pdf-lib chargé dans la page), puis relu avec
// pdftotext pour vérifier les deux sections.
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
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', '[]');
    win.TextEncoder = TextEncoder;
    win.TextDecoder = TextDecoder;
    const VraiBlob = win.Blob;
    win.Blob = function (parties, options) { blobCapture = parties[0]; return new VraiBlob(parties, options); };
    win.URL.createObjectURL = function () { return 'blob:test'; };
    win.URL.revokeObjectURL = function () {};
    win.HTMLAnchorElement.prototype.click = function () {};
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const txt = id => (doc.getElementById(id) || {}).textContent || '';
const nbSurv = () => win.eval("comptes.filter(function(c){return c.role==='surveillant';}).length");

setTimeout(() => {
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();
  win.switchProfil();

  // ================= 1. La carte Surveillants : les 3 actions =================
  t('bouton « Ajouter un surveillant » dans la carte Surveillants',
    !!doc.querySelector('#surv-card button[onclick="ouvrirAjoutSurveillant()"]') &&
    txt('surv-card').indexOf('Ajouter un surveillant') >= 0);
  t('le bouton est dans la vue Liste', !!doc.querySelector('#vue-surv-liste button[onclick="ouvrirAjoutSurveillant()"]'));
  t('2 surveillants de démonstration au départ', nbSurv() === 2, nbSurv());
  const carteSurv = doc.querySelector('#dir-surveillants-list > div');
  t('chaque carte de surveillant a son bouton Modifier',
    !!carteSurv && !!carteSurv.querySelector('button') && carteSurv.querySelector('button').textContent.indexOf('Modifier') >= 0);

  // ---- ajout ----
  win.ouvrirAjoutSurveillant();
  t('la fenêtre s ouvre en mode ajout', !doc.getElementById('modal-renommer').classList.contains('hidden') &&
    txt('renommer-titre').indexOf('Nouveau surveillant') >= 0, txt('renommer-titre'));
  t('le champ nom est vide et le bouton Supprimer est caché',
    doc.getElementById('renommer-nom').value === '' && doc.getElementById('renommer-supprimer').classList.contains('hidden'));
  doc.getElementById('renommer-nom').value = 'Ab';
  win.confirmerRenommageProf();
  t('nom trop court refusé (aucun surveillant ajouté)', nbSurv() === 2 && txt('toast').indexOf('court') >= 0, txt('toast'));
  doc.getElementById('renommer-nom').value = 'الحارس الثالث';
  win.confirmerRenommageProf();
  t('surveillant ajouté', nbSurv() === 3, nbSurv());
  t('la fenêtre est refermée', doc.getElementById('modal-renommer').classList.contains('hidden'));
  t('il apparaît dans la liste RH', txt('dir-surveillants-list').indexOf('الثالث') >= 0 || doc.querySelectorAll('#dir-surveillants-list > div').length === 3);
  t('la liste est conservée (le stockage local contient les 3)',
    JSON.parse(win.localStorage.getItem('surveillantsRH') || '[]').length === 3);

  // ---- suppression, avec confirmation ----
  const cleAjoute = JSON.parse(win.localStorage.getItem('surveillantsRH'))[2].cle;
  win.ouvrirRenommageProf(cleAjoute);
  t('le bouton Supprimer est visible pour un surveillant',
    !doc.getElementById('renommer-supprimer').classList.contains('hidden'));
  win.supprimerProfilCourant();
  t('la suppression demande confirmation', !doc.getElementById('modal-confirmation').classList.contains('hidden'));
  win.annulerConfirmation();
  t('annuler conserve le surveillant', nbSurv() === 3, nbSurv());
  win.ouvrirRenommageProf(cleAjoute);
  win.supprimerProfilCourant();
  win.validerConfirmation();
  t('après confirmation, le surveillant est supprimé', nbSurv() === 2, nbSurv());
  t('la liste conservée est mise à jour',
    JSON.parse(win.localStorage.getItem('surveillantsRH') || '[]').length === 2);

  // ---- modification (le bouton Supprimer ne doit PAS apparaître pour un enseignant) ----
  const cleProf = win.eval("comptes.filter(function(c){return c.role==='enseignant';})[0].code");
  win.ouvrirRenommageProf(cleProf);
  t('pas de bouton Supprimer pour un enseignant',
    doc.getElementById('renommer-supprimer').classList.contains('hidden'));
  win.fermerRenommageProf();

  // on rajoute le surveillant pour la suite (3 surveillants à pourvoir)
  win.ouvrirAjoutSurveillant();
  doc.getElementById('renommer-nom').value = 'الحارس الثالث';
  win.confirmerRenommageProf();
  t('3 surveillants pour la suite', nbSurv() === 3);

  // ================= 2. Popup de contrôle =================
  const etatAvant = win.eval("JSON.stringify(comptes.filter(function(c){return c.role!=='directeur';}).map(function(c){return c.email+'|'+c.password;}))");
  win.demanderIdentifiants();
  const modale = doc.getElementById('modal-confirmation');
  t('la popup de confirmation s ouvre', !modale.classList.contains('hidden'));
  const msg = txt('message-confirmation');
  t('le message distingue surveillants et enseignants', /3 surveillant/.test(msg) && /11 enseignant/.test(msg), msg);
  t('le message annonce les identifiants à générer (14)', /14 identifiant/.test(msg), msg);
  win.annulerConfirmation();
  t('annuler ne modifie aucun identifiant',
    win.eval("JSON.stringify(comptes.filter(function(c){return c.role!=='directeur';}).map(function(c){return c.email+'|'+c.password;}))") === etatAvant);

  // ================= 3. Génération réelle + PDF =================
  win.eval(fs.readFileSync('./node_modules/pdf-lib/dist/pdf-lib.min.js', 'utf8'));
  win.eval(fs.readFileSync('./node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js', 'utf8'));
  t('pdf-lib et fontkit disponibles dans la page', !!win.PDFLib && !!win.fontkit);

  // on capture les sections transmises au générateur (le PDF est quand même produit pour de vrai)
  const sectionsCapturees = [];
  const vraie = win.construirePdfIdentifiants;
  win.construirePdfIdentifiants = function (lib, PDFDocument, fk, police, sections, infos) {
    sectionsCapturees.push(sections);
    return vraie.apply(null, arguments);
  };

  blobCapture = null;
  win.demanderIdentifiants();
  win.validerConfirmation();

  setTimeout(() => {
    t('deux sections transmises au PDF', sectionsCapturees.length === 1 && sectionsCapturees[0].length === 2,
      sectionsCapturees.length ? sectionsCapturees[0].map(s => s.titre + ':' + s.lignes.length).join(' ') : 'aucune');
    const s = sectionsCapturees[0] || [];
    t('section 1 = Surveillants (3 lignes)', (s[0] || {}).titre === 'Surveillants' && (s[0] || {}).lignes.length === 3);
    t('section 2 = Enseignants (11 lignes)', (s[1] || {}).titre === 'Enseignants' && (s[1] || {}).lignes.length === 11);

    const surveillants = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';}))"));
    const profs = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='enseignant';}))"));
    t('emails des surveillants en surv1@ / surv2@ / surv3@',
      surveillants.map(c => c.email).join(' ') === 'surv1@taalim.ma surv2@taalim.ma surv3@taalim.ma',
      surveillants.map(c => c.email).join(' '));
    t('emails des enseignants conformes',
      profs.every(c => /^[a-z]+-prof\d+@taalim\.ma$/.test(c.email)) && new Set(profs.map(c => c.email)).size === 11,
      profs[0] && profs[0].email);
    const tous = surveillants.concat(profs);
    t('mots de passe de 8 caractères, tous différents et conformes',
      tous.every(c => /^[a-zA-Z0-9]{8}$/.test(c.password)) && new Set(tous.map(c => c.password)).size === 14);
    t('14 identifiants enregistrés dans le stockage local',
      Object.keys(JSON.parse(win.localStorage.getItem('motsDePasse') || '{}')).length >= 14,
      Object.keys(JSON.parse(win.localStorage.getItem('motsDePasse') || '{}')).length);
    t('les emails des surveillants sont conservés dans leur liste',
      JSON.parse(win.localStorage.getItem('surveillantsRH')).every(x => /^surv\d+@taalim\.ma$/.test(x.email)),
      JSON.parse(win.localStorage.getItem('surveillantsRH')).map(x => x.email).join(' '));

    t('un fichier a été produit', !!blobCapture && blobCapture.length > 2000, blobCapture ? blobCapture.length + ' octets' : 'aucun');
    let cheminPdf = null;
    if (blobCapture) {
      if (!fs.existsSync('_pdf')) fs.mkdirSync('_pdf', { recursive: true });
      cheminPdf = '_pdf/pdf_du_test_app.pdf';
      fs.writeFileSync(cheminPdf, Buffer.from(blobCapture));
      t('c est bien un PDF', Buffer.from(blobCapture.slice(0, 5)).toString('latin1') === '%PDF-');
    }

    // ---- relecture du PDF produit : les deux sous-titres et les emails y sont ----
    if (cheminPdf) {
      let texte = '';
      try { texte = execSync('pdftotext -layout ' + cheminPdf + ' -').toString(); } catch (e) { texte = ''; }
      if (texte) {
        t('le PDF contient le sous-titre « Surveillants »', texte.indexOf('Surveillants') >= 0);
        t('le PDF contient le sous-titre « Enseignants »', texte.indexOf('Enseignants') >= 0);
        t('les emails des surveillants sont dans le PDF',
          texte.indexOf('surv1@taalim.ma') >= 0 && texte.indexOf('surv3@taalim.ma') >= 0);
        t('les emails des enseignants sont dans le PDF',
          texte.indexOf('math-prof1@taalim.ma') >= 0 && texte.indexOf('hg-prof1@taalim.ma') >= 0);
        t('les 3 colonnes sont présentes',
          texte.indexOf('Nom') >= 0 && texte.indexOf('Email de connexion') >= 0 && texte.indexOf('Mot de passe') >= 0);
        t('aucun mot de passe de démonstration dans le PDF', texte.indexOf('12345') < 0 && texte.indexOf('s1@taalim') < 0);
      } else {
        console.log('(pdftotext indisponible : relecture du PDF ignorée)');
      }
    }

    // ================= 4. Stabilité =================
    // on compare l'ENSEMBLE des identifiants (l'app peut réordonner les comptes)
    const avant = tous.map(c => c.email + '|' + c.password).sort().join(',');
    blobCapture = null;
    win.demanderIdentifiants();
    t('le message signale que tout existe déjà', /existent deja/i.test(txt('message-confirmation')), txt('message-confirmation'));
    win.validerConfirmation();
    setTimeout(() => {
      const apres = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role!=='directeur';}).map(function(c){return c.email+'|'+c.password;}))")).sort().join(',');
      t('re-télécharger redonne les MÊMES identifiants', avant === apres);
      t('le PDF est produit une seconde fois', !!blobCapture && blobCapture.length > 2000);

      // ================= 5. Mise en forme arabe intacte =================
      const ref = JSON.parse(fs.readFileSync('tests/fixtures/_ref_arabe.json', 'utf8'));
      const noms = Object.keys(ref).filter(n => n.indexOf('الحاضي') >= 0 || n.indexOf('خليفي') >= 0 || n.indexOf('القامة') >= 0);
      const justes = noms.filter(n => win.eval("formeArabe('" + n.replace(/'/g, "\\'") + "')") === ref[n]);
      t('mise en forme arabe conforme à la référence Python', justes.length === noms.length && noms.length > 0,
        noms.length - justes.length + ' écart(s) sur ' + noms.length);

      t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
      console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
      process.exit(ok ? 0 : 1);
    }, 2500);
  }, 3000);
}, 900);
