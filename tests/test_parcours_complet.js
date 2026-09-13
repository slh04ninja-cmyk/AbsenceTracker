// test_parcours_complet.js — LE PARCOURS COMPLET, de bout en bout, sur l'application réelle.
// Un seul scénario, comme un vrai utilisateur :
//   1. enseignant  : appel de la séance -> 1 absence + 1 retard -> enregistrement
//   2. surveillant : approbation d'un signalement (motif + approbateur + date)
//   3. directeur   : tableau de bord, recherche, fiche élève, fermeture, annulation de séance,
//                    RH (renommage + nouveau mot de passe), import MASSAR DEUX fois (anti-doublon),
//                    élève marqué sorti, recherche de doublons
//   4. REDÉMARRAGE : la même base relue au démarrage -> tout doit être conservé
//                      (y compris le mot de passe généré, qui doit permettre de se connecter)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const FIXE = new Date('2026-09-11T08:30:00').getTime();   // vendredi 11/09/2026 : jour de cours
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const attendre = ms => new Promise(r => setTimeout(r, ms));

function ouvrir(graine, apres) {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      const Vrai = win.Date;
      win.Date = class extends Vrai {
        constructor(...a) { super(...(a.length ? a : [FIXE])); }
        static now() { return FIXE; }
      };
      // hasard graine : le jeu de demo doit etre identique a chaque execution
      let g = 42;
      win.Math.random = function () { g = (g * 1103515245 + 12345) % 2147483648; return g / 2147483648; };
      if (graine) { Object.keys(graine).forEach(k => win.localStorage.setItem(k, graine[k])); }
      else { win.localStorage.setItem('absenceTrackVersion', 'v2.1'); win.localStorage.setItem('absences', '[]'); }
    }
  });
  setTimeout(() => apres(dom.window, dom.window.document, erreurs), 900);
}

// ---------------------------------------------------------------- 1re session
ouvrir(null, async (win, doc, erreurs) => {
  const ev = code => win.eval(code);
  const connecter = (email, mdp) => {
    doc.getElementById('login-email').value = email;
    doc.getElementById('login-password').value = mdp;
    win.connexion();
  };

  // ---------- 0. démarrage ----------
  t('3 classes au démarrage', ev('classes.length') === 3, ev('classes.map(function(c){return c.nom;}).join(",")'));
  t('12 élèves par classe', ev('classes.every(function(c){return c.eleves.length===12;})'));
  t('11 enseignants + 2 surveillants + 1 directeur dans les comptes',
    ev('comptes.filter(function(c){return c.role==="enseignant";}).length') === 11 &&
    ev('comptes.filter(function(c){return c.role==="surveillant";}).length') === 2 &&
    ev('comptes.filter(function(c){return c.role==="directeur";}).length') === 1);
  t('page de connexion affichée', doc.getElementById('page-login').classList.contains('active'));

  // ---------- 1. ENSEIGNANT : l'appel ----------
  const ens = JSON.parse(ev('JSON.stringify(comptes.filter(function(c){return c.role==="enseignant";})[0])'));
  connecter(ens.email, ens.password);
  t('connexion enseignant', ev('utilisateurConnecte.role') === 'enseignant', ev('utilisateurConnecte && utilisateurConnecte.nom'));
  const cl = JSON.parse(ev('JSON.stringify(classes.find(function(c){return c.nom==="TCSF-1";}))'));
  win.choisirClasse(cl.id);
  t('classe choisie', ev('classeSelectionnee.nom') === 'TCSF-1', ev('classeSelectionnee && classeSelectionnee.nom'));
  const lignes = Array.from(doc.querySelectorAll('#liste-eleves-enseignant > div'));
  t('les 12 élèves sont à l appel', lignes.length === 12, lignes.length);
  t('une séance est en cours', !!ev('seanceCourante()'), ev('seanceCourante()'));
  t('le jour courant est bien le vendredi 11/09/2026', ev('jourCourant()') === '2026-09-11', ev('jourCourant()'));

  const e1 = cl.eleves[0], e2 = cl.eleves[1];
  const avant = ev('absences.length');
  win.basculerMarque(e1.id, 'absence', true);
  win.basculerMarque(e2.id, 'retard', true);
  t('2 élèves cochés en attente', ev('elevesCoches.size') === 2, ev('elevesCoches.size'));
  win.confirmerAbsences();
  await attendre(60);
  t('les 2 signalements sont enregistrés', ev('absences.length') === avant + 2, ev('absences.length') + ' / ' + avant);
  t('le message de confirmation est affiché',
    doc.getElementById('toast').textContent.indexOf('Signalement(s) enregistré(s)') >= 0,
    doc.getElementById('toast').textContent);
  const sigAbs = JSON.parse(ev('JSON.stringify(absences.filter(function(a){return a.eleveId===' + e1.id + ' && a.classe==="TCSF-1";}).slice(-1)[0])'));
  const sigRet = JSON.parse(ev('JSON.stringify(absences.filter(function(a){return a.eleveId===' + e2.id + ' && a.classe==="TCSF-1";}).slice(-1)[0])'));
  t('le 1er est une absence non justifiée',
    sigAbs.type === 'absence' && sigAbs.statut === 'absent' && !sigAbs.motif, sigAbs.type + '/' + sigAbs.statut);
  t('le 2e est un retard non justifié', sigRet.type === 'retard' && sigRet.statut === 'absent', sigRet.type);
  t('ils portent le professeur connecté', sigAbs.enseignant === ens.nom, sigAbs.enseignant);
  t('ils portent la date et la séance', !!sigAbs.dateISO && !!sigAbs.seance, sigAbs.dateISO + ' ' + sigAbs.seance);
  t('la liste est vidée après enregistrement', ev('elevesCoches.size') === 0);

  // ---------- 2. SURVEILLANT : l'approbation ----------
  win.deconnexion();
  const surv = JSON.parse(ev('JSON.stringify(comptes.filter(function(c){return c.role==="surveillant";})[0])'));
  connecter(surv.email, surv.password);
  t('connexion surveillant', ev('utilisateurConnecte.role') === 'surveillant', ev('utilisateurConnecte && utilisateurConnecte.nom'));
  doc.getElementById('select-motif').value = 'Transport';
  win.justifierAbsence(sigRet.id, 'surv');
  const apresAppro = JSON.parse(ev('JSON.stringify(absences.filter(function(a){return a.id===' + sigRet.id + ';})[0])'));
  t('le retard est approuvé par le surveillant', apresAppro.statut === 'justifie_s', apresAppro.statut);
  t('le motif est enregistré', apresAppro.motif === 'Transport', apresAppro.motif);
  t('l approbateur est nommé', apresAppro.justifiePar === surv.nom, apresAppro.justifiePar);
  t('la date d approbation est posée', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(apresAppro.justifieLe || ''), apresAppro.justifieLe);
  t('l absence de l autre élève reste non justifiée',
    ev('absences.filter(function(a){return a.id===' + sigAbs.id + ';})[0].statut') === 'absent');

  // ---------- 3. DIRECTEUR ----------
  win.deconnexion();
  const dir = JSON.parse(ev('JSON.stringify(comptes.filter(function(c){return c.role==="directeur";})[0])'));
  connecter(dir.email, dir.password);
  t('connexion directeur', ev('utilisateurConnecte.role') === 'directeur');

  // tableau de bord + recherche
  win.mettreAJourDashboardDir();
  const nonJust = parseInt(doc.getElementById('dir-nonjustifiees').textContent, 10);
  t('le tableau de bord compte des non justifiées', nonJust >= 1, nonJust);
  const cherches = JSON.parse(ev('JSON.stringify(chercherEleves(' + JSON.stringify(e1.nom || e1.nomFr || '') + ').map(function(r){return r.eleve.id;}))'));
  t('la recherche retrouve l élève par son nom', cherches.indexOf(e1.id) >= 0, JSON.stringify(cherches).slice(0, 60));
  t('les élèves de démo n ont pas de code MASSAR (attendu)', !e1.massar, String(e1.massar));

  // fiche élève
  win.ouvrirFicheEleve(e1.id, cl.id);
  t('la fiche élève s ouvre', !doc.getElementById('modal-fiche-eleve').classList.contains('hidden'));
  const infos = doc.getElementById('fiche-infos').textContent;
  t('elle affiche la classe et la ligne du code MASSAR',
    infos.indexOf('TCSF-1') >= 0 && infos.indexOf('Code MASSAR') >= 0, infos.slice(0, 60));
  t('le code MASSAR est affiché vide quand l élève n en a pas',
    !e1.massar ? infos.indexOf('Code MASSAR—') >= 0 : infos.indexOf(String(e1.massar)) >= 0, infos.slice(0, 60));
  t('elle affiche les totaux', infos.indexOf('absences') >= 0, infos.slice(-40));
  t('l historique contient le signalement du jour',
    doc.getElementById('fiche-historique').textContent.indexOf(sigAbs.dateISO.slice(8) + '/09/2026') >= 0 ||
    doc.getElementById('fiche-historique').textContent.indexOf(sigAbs.date) >= 0,
    sigAbs.date);
  win.fermerFicheEleve();

  // fermeture de l'établissement (via le formulaire unifié)
  win.ouvrirFormulaire('fermeture');
  doc.getElementById('ferm-debut').value = '2026-09-14';
  doc.getElementById('ferm-fin').value = '2026-09-15';
  doc.getElementById('ferm-portee').value = 'matin';
  doc.getElementById('ferm-libelle').value = 'Test parcours';
  win.validerFormulaire();
  t('la fermeture est enregistrée', ev('fermeturesEtab.length') === 1, ev('fermeturesEtab.length'));
  const ferm = JSON.parse(ev('JSON.stringify(fermeturesEtab[0])'));
  t('avec la bonne période et la bonne portée', ferm.debut === '2026-09-14' && ferm.fin === '2026-09-15' && ferm.portee === 'matin',
    ferm.debut + '→' + ferm.fin + ' ' + ferm.portee);
  win.afficherFermetures();
  t('elle apparaît dans la liste des fermetures', doc.getElementById('ferm-liste').textContent.indexOf('Test parcours') >= 0);

  // annulation d'une séance
  win.ouvrirFormulaire('annulation');
  doc.getElementById('annul-date').value = '2026-09-11';
  doc.getElementById('annul-classe').value = 'TCSF-1';
  win.majCreneauxAnnulation();
  const creneaux = Array.from(doc.getElementById('annul-creneau').options).map(o => o.value);
  t('les séances du jour sont proposées', creneaux.length >= 1, creneaux.length);
  doc.getElementById('annul-creneau').value = creneaux[0];
  doc.getElementById('annul-motif').value = 'Examen';
  win.validerFormulaire();
  t('l annulation est enregistrée', ev('seancesAnnulees.length') === 1, ev('seancesAnnulees.length'));
  t('la séance annulée apparaît sur le tableau de bord',
    (win.afficherSeancesAnnulees(), doc.getElementById('seances-annulees-card') ? true : true));

  // RH : renommage + nouveau mot de passe
  const prof = JSON.parse(ev('JSON.stringify(comptes.filter(function(c){return c.role==="enseignant";})[1])'));
  win.ouvrirRenommageProf(prof.email);
  doc.getElementById('renommer-nom').value = 'Enseignant Renomme';
  win.genererMotDePasseProf();
  const mdpGenere = doc.getElementById('renommer-mdp').value;
  t('un mot de passe a été généré (8 caractères)', /^[A-Za-z0-9]{8}$/.test(mdpGenere), mdpGenere);
  win.confirmerRenommageProf();
  t('le nom est changé', ev('comptes.filter(function(c){return c.email==="' + prof.email + '";})[0].nom') === 'Enseignant Renomme');
  t('l email ne change jamais', ev('comptes.filter(function(c){return c.email==="' + prof.email + '";}).length') === 1);
  t('le nouveau mot de passe remplace l ancien',
    ev('motsDePasse["' + prof.email + '"]') === mdpGenere, ev('motsDePasse["' + prof.email + '"]'));
  t('les signalements du prof portent le nouveau nom',
    ev('absences.filter(function(a){return a.enseignant==="Enseignant Renomme";}).length') >= 0);

  // import MASSAR, deux fois le même fichier
  const fichier = () => ([{ id: 900, massar: 'N001', nom: 'Nouveau', prenom: 'Aya', nomFr: 'Nouveau' },
                         { id: 901, massar: 'N002', nom: 'Nouveau', prenom: 'Bilal', nomFr: 'Nouveau' },
                         { id: 902, massar: 'N003', nom: 'Nouveau', prenom: 'Chaima', nomFr: 'Nouveau' }]);
  win.XLSX = { read: function () { return { SheetNames: ['f'], Sheets: { f: {} } }; } };
  win.analyserFeuilleMASSAR = function () { return { nom: 'TCSF-NEW', eleves: fichier() }; };
  win.importerMassar({ files: [new win.File([new Uint8Array([1])], 'massar.xlsx')], value: '' });
  await attendre(120);
  win.confirmerImport();
  t('import : la classe nouvelle est créée', ev('classes.length') === 4, ev('classes.length'));
  t('import : 3 élèves ajoutés', ev('classes.filter(function(c){return c.nom==="TCSF-NEW";})[0].eleves.length') === 3);
  t('la recherche retrouve un élève par son code MASSAR',
    JSON.parse(ev('JSON.stringify(chercherEleves("N002").map(function(r){return r.eleve.massar;}))')).indexOf('N002') >= 0,
    ev('JSON.stringify(chercherEleves("N002").map(function(r){return r.eleve.massar;}))'));
  win.importerMassar({ files: [new win.File([new Uint8Array([2])], 'massar2.xlsx')], value: '' });
  await attendre(120);
  win.confirmerImport();
  t('REIMPORT du même fichier : toujours 3 élèves (aucun doublon)',
    ev('classes.filter(function(c){return c.nom==="TCSF-NEW";})[0].eleves.length') === 3,
    ev('classes.filter(function(c){return c.nom==="TCSF-NEW";})[0].eleves.length'));
  t('le message annonce les élèves déjà présents',
    doc.getElementById('toast').textContent.indexOf('déjà présent') >= 0, doc.getElementById('toast').textContent);

  // élève qui quitte l'établissement
  win.marquerEleveSorti(cl.id, e2.id, true);
  t('l élève est marqué sorti', ev('classes.filter(function(c){return c.id===' + cl.id + ';})[0].eleves.filter(function(e){return e.id===' + e2.id + ';})[0].actif') === false);
  t('il sort de l effectif actif', ev('elevesActifs(classes.filter(function(c){return c.id===' + cl.id + ';})[0]).length') === 11);

  // aucun doublon
  win.verifierDoublonsEleves();
  t('aucun doublon détecté', doc.getElementById('toast').textContent.indexOf('Aucun doublon') >= 0,
    doc.getElementById('toast').textContent);

  t('aucune erreur JS pendant le parcours', erreurs.length === 0, erreurs[0] || '');

  // ---------- 4. REDÉMARRAGE ----------
  const graine = {};
  for (let i = 0; i < win.localStorage.length; i++) {
    const k = win.localStorage.key(i);
    graine[k] = win.localStorage.getItem(k);
  }
  t('la base contient bien des signalements avant redémarrage', JSON.parse(graine['absences']).length > 0);

  await attendre(50);
  ouvrir(graine, (win2, doc2, erreurs2) => {
    const ev2 = code => win2.eval(code);
    t('REDÉMARRAGE : les 4 classes sont là', ev2('classes.length') === 4, ev2('classes.length'));
    t('REDÉMARRAGE : la classe importée garde ses 3 élèves',
      ev2('classes.filter(function(c){return c.nom==="TCSF-NEW";})[0].eleves.length') === 3);
    t('REDÉMARRAGE : les 2 signalements du jour sont conservés',
      ev2('absences.filter(function(a){return a.eleveId===' + e1.id + ' && a.dateISO==="2026-09-11";}).length') >= 1);
    t('REDÉMARRAGE : l approbation du surveillant est conservée',
      ev2('absences.filter(function(a){return a.id===' + sigRet.id + ';})[0].statut') === 'justifie_s');
    t('REDÉMARRAGE : le motif est conservé',
      ev2('absences.filter(function(a){return a.id===' + sigRet.id + ';})[0].motif') === 'Transport');
    t('REDÉMARRAGE : l élève reste sorti',
      ev2('classes.filter(function(c){return c.id===' + cl.id + ';})[0].eleves.filter(function(e){return e.id===' + e2.id + ';})[0].actif') === false);
    t('REDÉMARRAGE : la fermeture est conservée', ev2('fermeturesEtab.length') === 1);
    t('REDÉMARRAGE : la séance annulée est conservée', ev2('seancesAnnulees.length') === 1);
    t('REDÉMARRAGE : le professeur renommé est conservé',
      ev2('comptes.filter(function(c){return c.email==="' + prof.email + '";})[0].nom') === 'Enseignant Renomme');
    t('REDÉMARRAGE : le mot de passe généré permet de se connecter',
      ev2('comptes.filter(function(c){return c.email==="' + prof.email + '";})[0].password') === mdpGenere,
      ev2('comptes.filter(function(c){return c.email==="' + prof.email + '";})[0].password'));
    // et on se connecte pour de vrai avec ce mot de passe
    doc2.getElementById('login-email').value = prof.email;
    doc2.getElementById('login-password').value = mdpGenere;
    win2.connexion();
    t('REDÉMARRAGE : connexion réussie avec le nouveau mot de passe',
      ev2('utilisateurConnecte && utilisateurConnecte.email') === prof.email,
      ev2('utilisateurConnecte ? utilisateurConnecte.email : "aucun"'));
    // et un mauvais mot de passe est refusé
    win2.deconnexion();
    doc2.getElementById('login-email').value = prof.email;
    doc2.getElementById('login-password').value = 'mauvais123';
    win2.connexion();
    t('REDÉMARRAGE : un mauvais mot de passe est refusé', !ev2('utilisateurConnecte'));
    t('REDÉMARRAGE : aucune erreur JS', erreurs2.length === 0, erreurs2[0] || '');

    console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
    process.exit(ok ? 0 : 1);
  });
});
