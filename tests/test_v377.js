// test_v377.js — PERSISTANCE APRÈS RECHARGEMENT.
// Le bug corrigé (v3.77) : un surveillant ajouté disparaissait au redémarrage parce que
// la liste enregistrée n'était jamais relue. Les suites existantes ne pouvaient pas le
// voir : elles restaient dans la même session. Ici on recharge vraiment l'application
// avec le même stockage local, comme le ferait le directeur en rouvrant l'app.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }] }];
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

function ouvrir(magasin) {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
      win.localStorage.setItem('absenceTrackVersion', 'v3.0');
      win.localStorage.setItem('testHistoGenere_v6', '1');
      win.localStorage.setItem('classes', JSON.stringify(classes));
      win.localStorage.setItem('absences', '[]');
      // 2e ouverture : on restitue tout le stockage local de la 1re
      Object.keys(magasin || {}).forEach(cle => win.localStorage.setItem(cle, magasin[cle]));
    }
  });
  return { win: dom.window, doc: dom.window.document, erreurs };
}

function connecter(inst, role) {
  const c = JSON.parse(inst.win.eval("JSON.stringify(comptes.filter(function(x){return x.role==='" + role + "';})[0])"));
  inst.doc.getElementById('login-email').value = c.email;
  inst.doc.getElementById('login-password').value = c.password;
  inst.win.connexion();
  return c;
}

// ======================= 1re ouverture : on modifie des choses =======================
const a = ouvrir(null);
setTimeout(() => {
  connecter(a, 'directeur');

  // (1) ajout d'un surveillant
  a.win.ouvrirAjoutSurveillant();
  a.doc.getElementById('renommer-nom').value = 'الحارس الليلي';
  a.win.confirmerRenommageProf();

  // (2) modification du nom d'un enseignant (doit survivre aussi)
  const codeProf = a.win.eval("comptes.filter(function(c){return c.role==='enseignant';})[0].code");
  a.win.ouvrirRenommageProf(codeProf);
  a.doc.getElementById('renommer-nom').value = 'أيوب الكمرة المعدل';
  a.win.confirmerRenommageProf();

  // (3) génération des identifiants : on remplace le PDF (pdf-lib) par un faux document
  //     pour ne tester que ce qui est enregistré
  a.win.pdfPret = () => Promise.resolve(true);
  a.win.construirePdfIdentifiants = function () {
    return Promise.resolve({ save: function () { return Promise.resolve(new Uint8Array([37, 80, 68, 70])); } });
  };
  a.win.Blob = function () { return {}; };
  a.win.URL.createObjectURL = function () { return 'blob:test'; };
  a.win.URL.revokeObjectURL = function () {};
  a.win.HTMLAnchorElement.prototype.click = function () {};
  a.win.demanderIdentifiants();
  a.win.validerConfirmation();

  setTimeout(() => {
    const survAvant = JSON.parse(a.win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';}))"));
    t('avant rechargement : 3 surveillants', survAvant.length === 3, survAvant.length);
    t('avant rechargement : le surveillant ajouté est présent',
      survAvant.some(s => s.nom === 'الحارس الليلي'));
    t('avant rechargement : les emails sont générés',
      survAvant.every(s => /^surv\d+@taalim\.ma$/.test(s.email)), survAvant.map(s => s.email).join(' '));

    // instantané du stockage local
    const magasin = {};
    for (let i = 0; i < a.win.localStorage.length; i++) {
      const cle = a.win.localStorage.key(i);
      magasin[cle] = a.win.localStorage.getItem(cle);
    }
    t('la liste des surveillants est bien enregistrée',
      Array.isArray(JSON.parse(magasin.surveillantsRH || 'null')) && JSON.parse(magasin.surveillantsRH).length === 3);
    t('les mots de passe générés sont enregistrés',
      Object.keys(JSON.parse(magasin.motsDePasse || '{}')).length >= 3,
      Object.keys(JSON.parse(magasin.motsDePasse || '{}')).length);

    // ======================= 2e ouverture : rechargement =======================
    const b = ouvrir(magasin);
    setTimeout(() => {
      const survApres = JSON.parse(b.win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';}))"));
      t('APRÈS RECHARGEMENT : le surveillant ajouté est toujours là (le bug corrigé)',
        survApres.some(s => s.nom === 'الحارس الليلي'),
        survApres.map(s => s.nom).join(' | '));
      t('APRÈS RECHARGEMENT : il y a toujours 3 surveillants', survApres.length === 3, survApres.length);
      t('APRÈS RECHARGEMENT : ses identifiants sont conservés',
        survApres.filter(s => s.nom === 'الحارس الليلي').every(s => /^surv\d+@taalim\.ma$/.test(s.email)) &&
        survApres.every(s => /^surv\d+@taalim\.ma$/.test(s.email)),
        survApres.map(s => s.email).join(' '));
      t('APRÈS RECHARGEMENT : le mot de passe est retrouvé',
        survApres.every(s => /^[a-zA-Z0-9]{8}$/.test(s.password)), survApres.map(s => s.password).join(' '));
      // le reste de la persistance ne doit pas avoir souffert
      connecter(b, 'directeur');
      b.win.switchProfil();     // la page RH affiche les listes du personnel
      t('APRÈS RECHARGEMENT : la liste RH affiche les 3 surveillants',
        b.doc.querySelectorAll('#dir-surveillants-list > div').length === 3,
        b.doc.querySelectorAll('#dir-surveillants-list > div').length);
      const profs = JSON.parse(b.win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='enseignant';}))"));
      t('APRÈS RECHARGEMENT : le nom modifié de l enseignant est conservé',
        profs.some(p => p.nom === 'أيوب الكمرة المعدل'), profs[0].nom);
      t('APRÈS RECHARGEMENT : les 11 enseignants sont là avec leurs emails',
        profs.length === 11 && profs.every(p => /^[a-z]+-prof\d+@taalim\.ma$/.test(p.email)));

      // et une suppression doit survivre aussi
      const cle = survApres.find(s => s.nom === 'الحارس الليلي').code;
      b.win.ouvrirRenommageProf(cle);
      b.win.supprimerProfilCourant();
      b.win.validerConfirmation();
      const magasin2 = {};
      for (let i = 0; i < b.win.localStorage.length; i++) {
        const c2 = b.win.localStorage.key(i);
        magasin2[c2] = b.win.localStorage.getItem(c2);
      }
      const c3 = ouvrir(magasin2);
      setTimeout(() => {
        const final = JSON.parse(c3.win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';}))"));
        t('APRÈS RECHARGEMENT : la suppression du surveillant est conservée',
          final.length === 2 && !final.some(s => s.nom === 'الحارس الليلي'), final.length);

        t('aucune erreur JS (1re ouverture)', a.erreurs.length === 0, a.erreurs[0] || '');
        t('aucune erreur JS (2e ouverture)', b.erreurs.length === 0, b.erreurs[0] || '');
        t('aucune erreur JS (3e ouverture)', c3.erreurs.length === 0, c3.erreurs[0] || '');
        console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
        process.exit(ok ? 0 : 1);
      }, 1200);
    }, 1200);
  }, 1200);
}, 900);
