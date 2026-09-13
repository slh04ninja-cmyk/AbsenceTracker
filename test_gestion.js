// Test jsdom : page Gestion du directeur (v3.39) — recherche supprimee, import multi-fichiers,
// eleves uniquement dans le popup de classe.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [
  { id: 1, nom: '3eme A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed', massar: 'M001' }, { id: 2, nom: 'Benali', prenom: 'Fatima', massar: 'M002' }] },
  { id: 2, nom: '3eme B', eleves: [{ id: 3, nom: 'Alami', prenom: 'Youssef' }] }
];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('absences', '[]');
    win.localStorage.setItem('testHistoGenere_v1', '1');
    win.localStorage.setItem('testHistoGenere_v2', '1');
    win.localStorage.setItem('testHistoGenere_v3', '1');
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const compte = role => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='" + role + "';})[0])"));
const clic = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const modalClAttente = doc.getElementById('modal-classe-detail');
const attendre = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await attendre(300);
  // v3.46 : les classes des tableaux de service sont ajoutees automatiquement -> on garde les notres
  win.eval("classes = classes.filter(function(c){ return " + JSON.stringify(['3eme A','3eme B']) + ".indexOf(c.nom) >= 0; });");
  doc.getElementById('login-email').value = compte('directeur').email;
  doc.getElementById('login-password').value = compte('directeur').password;
  win.connexion();
  win.switchDirPage('dir-gestion');


  // 1. carte de recherche supprimee
  t('carte « Rechercher un élève » supprimee',
    doc.getElementById('recherche-eleve-dir') === null && doc.getElementById('resultats-recherche-dir') === null &&
    doc.getElementById('page-dir-gestion').innerHTML.indexOf('Rechercher un élève') < 0);

  // 2. cartes de classes sans liste d'eleves
  const cartes = Array.from(doc.querySelectorAll('#dir-classes-list > div'));
  t('une carte par classe', cartes.length === 2, cartes.length);
  t('carte : nom et effectif sur la MEME ligne',
    cartes[0].textContent.indexOf('3eme A') >= 0 && cartes[0].textContent.indexOf('2 élèves') >= 0 &&
    !!cartes[0].querySelector('.fa-chevron-right') &&
    cartes[0].querySelectorAll('div').length === 1 && cartes[0].querySelectorAll('span').length >= 3,
    cartes[0].textContent.trim());
  t('carte basse (px-4 py-2, plus de p-4)', cartes[0].className.indexOf('px-4 py-2') > 0, cartes[0].className);
  t('popup de classe centre a l ecran',
    modalClAttente.className.indexOf('items-center justify-center') > 0, modalClAttente.className);
  t('aucun eleve affiche dans la carte',
    cartes[0].textContent.indexOf('El Amrani') < 0 && cartes[0].textContent.indexOf('Benali') < 0 &&
    cartes[0].innerHTML.indexOf('supprimerEleve') < 0);
  t('clic sur la carte = ouvrirDetailClasse',
    (cartes[0].getAttribute('onclick') || '').indexOf('ouvrirDetailClasse(1)') >= 0, cartes[0].getAttribute('onclick'));

  // 3. les eleves apparaissent dans le popup
  clic(cartes[0]);
  const modalCl = doc.getElementById('modal-classe-detail');
  t('popup de classe ouvert au clic', !modalCl.classList.contains('hidden'));
  t('popup : titre = classe', doc.getElementById('detail-classe-titre').textContent === '3eme A');
  const lignes = doc.querySelectorAll('#detail-classe-eleves > div');
  t('popup : 2 eleves listes', lignes.length === 2, lignes.length);
  t('popup : nom + code MASSAR + bouton supprimer',
    lignes[0].textContent.indexOf('El Amrani') >= 0 && lignes[0].textContent.indexOf('M001') >= 0 &&
    lignes[0].innerHTML.indexOf('demanderSuppressionEleve') > 0, lignes[0].textContent.trim());

  // suppression apres confirmation
  const nbElevesAvant = JSON.parse(win.localStorage.getItem('classes'))[0].eleves.length;
  clic(lignes[0].querySelector('.js-supprimer-eleve'));
  t('la confirmation s affiche (et pas la suppression directe)',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') &&
    doc.getElementById('message-confirmation').textContent.indexOf('El Amrani') > 0 &&
    JSON.parse(win.localStorage.getItem('classes'))[0].eleves.length === nbElevesAvant,
    doc.getElementById('message-confirmation').textContent);
  t('confirmation au-dessus du popup de classe (z-index 400)',
    doc.getElementById('modal-confirmation').style.zIndex === '400');
  win.annulerConfirmation();
  t('Annuler ne supprime rien',
    JSON.parse(win.localStorage.getItem('classes'))[0].eleves.length === nbElevesAvant &&
    doc.getElementById('modal-confirmation').classList.contains('hidden'));

  clic(doc.querySelectorAll('#detail-classe-eleves > div')[0].querySelector('.js-supprimer-eleve'));
  win.validerConfirmation();
  t('Confirmer supprime l eleve et met a jour le popup',
    JSON.parse(win.localStorage.getItem('classes'))[0].eleves.length === nbElevesAvant - 1 &&
    doc.querySelectorAll('#detail-classe-eleves > div').length === 1,
    JSON.parse(win.localStorage.getItem('classes'))[0].eleves.length + ' restant(s)');
  win.fermerDetailClasse();
  t('popup referme', doc.getElementById('modal-classe-detail').classList.contains('hidden'));

  // 4. import multi-fichiers
  const input = doc.getElementById('file-massar');
  t('champ de fichier en mode multiple', input.hasAttribute('multiple'));

  // on stubbe XLSX + le lecteur de feuille pour tester la plomberie des fichiers
  win.XLSX = { read: function () { return { SheetNames: ['feuille'], Sheets: { feuille: {} } }; } };
  let appels = 0;
  win.analyserFeuilleMASSAR = function () {
    appels++;
    return { nom: 'CLASSE ' + appels, eleves: [{ id: 900 + appels, nom: 'Eleve ' + appels, prenom: '', massar: 'X' + appels }] };
  };
  const f1 = new win.File([new Uint8Array([1, 2])], 'masar1.xlsx');
  const f2 = new win.File([new Uint8Array([3, 4])], 'masar2.xlsx');
  win.importerMassar({ files: [f1, f2], value: '' });
  await attendre(120);
  t('les 2 fichiers ont ete lus', appels === 2, String(appels));
  t('2 classes fusionnees dans l apercu', win.eval('importData.classes.length') === 2, win.eval('importData.classes.length'));
  t('apercu : « 2 classe(s) detectee(s) dans 2 fichier(s) »',
    doc.getElementById('preview-classe-nom').textContent === '2 classe(s) détectée(s) dans 2 fichier(s)',
    doc.getElementById('preview-classe-nom').textContent);
  t('apercu : total des eleves', doc.getElementById('preview-eleves-count').textContent === '2 élève(s) au total',
    doc.getElementById('preview-eleves-count').textContent);
  t('apercu visible', !doc.getElementById('import-preview').classList.contains('hidden'));
  t('apercu : 1 ligne par classe', doc.getElementById('preview-eleves-list').querySelectorAll('div').length === 2,
    doc.getElementById('preview-eleves-list').querySelectorAll('div').length);

  // confirmation
  const avant = JSON.parse(win.localStorage.getItem('classes')).length;
  win.confirmerImport();
  await attendre(50);
  const apres = JSON.parse(win.localStorage.getItem('classes')).length;
  t('confirmation : 2 classes ajoutees et sauvegardees', apres === avant + 2, avant + ' -> ' + apres);
  t('apercu masque apres confirmation', doc.getElementById('import-preview').classList.contains('hidden'));
  t('toast de confirmation', doc.getElementById('toast').textContent.indexOf('2 classe(s) importée(s)') >= 0,
    doc.getElementById('toast').textContent);
  t('liste des classes rafraichie', doc.querySelectorAll('#dir-classes-list > div').length === 4,
    doc.querySelectorAll('#dir-classes-list > div').length);

  // 5. fichier invalide seul -> message d erreur
  const f3 = new win.File([new Uint8Array([1])], 'notes.csv');
  win.importerMassar({ files: [f3], value: '' });
  await attendre(120);
  t('fichier non xlsx refuse avec message',
    !doc.getElementById('import-error').classList.contains('hidden') &&
    doc.getElementById('import-error').textContent.indexOf('notes.csv') >= 0,
    doc.getElementById('import-error').textContent);

  // 5bis. suppression d'une classe : confirmation obligatoire
  win.switchDirPage('dir-gestion');
  const boutonSupprClasse = () => Array.from(doc.querySelectorAll('#modal-classe-detail button'))
    .find(b => b.textContent.indexOf('Supprimer cette classe') >= 0);
  const nbClassesAvant = JSON.parse(win.localStorage.getItem('classes')).length;
  clic(doc.querySelectorAll('#dir-classes-list > div')[nbClassesAvant - 1]);   // la derniere, pour garder la classe 1
  clic(boutonSupprClasse());
  t('suppression de classe : confirmation demandee',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') &&
    doc.getElementById('message-confirmation').textContent.indexOf('Supprimer la classe') === 0 &&
    doc.getElementById('message-confirmation').textContent.indexOf('élève(s)') > 0,
    doc.getElementById('message-confirmation').textContent);
  t('la classe est encore la tant qu on n a pas confirme',
    JSON.parse(win.localStorage.getItem('classes')).length === nbClassesAvant &&
    !!doc.getElementById('detail-classe-eleves'));
  win.annulerConfirmation();
  t('Annuler : classe conservee et popup toujours ouvert',
    JSON.parse(win.localStorage.getItem('classes')).length === nbClassesAvant &&
    !doc.getElementById('modal-classe-detail').classList.contains('hidden'));
  clic(boutonSupprClasse());
  win.validerConfirmation();
  t('Confirmer : classe supprimee, popup ferme, liste rafraichie',
    JSON.parse(win.localStorage.getItem('classes')).length === nbClassesAvant - 1 &&
    doc.getElementById('modal-classe-detail').classList.contains('hidden') &&
    doc.querySelectorAll('#dir-classes-list > div').length === nbClassesAvant - 1,
    JSON.parse(win.localStorage.getItem('classes')).length + ' classe(s) restante(s)');

  // 6. regression : la confirmation generique ne casse pas l enregistrement des absences
  doc.getElementById('login-email').value = '';
  doc.getElementById('login-password').value = '';
  const prof = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='math-prof1@taalim.ma';})[0])"));
  doc.getElementById('login-email').value = prof.email;
  doc.getElementById('login-password').value = prof.password;
  win.connexion();
  win.choisirClasse(1);
  win.eval("elevesCoches.set(2, 'absence')");
  win.afficherConfirmationAbsences();
  t('enregistrement : la modale demande confirmation',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') &&
    doc.getElementById('message-confirmation').textContent.indexOf('1 signalement') > 0,
    doc.getElementById('message-confirmation').textContent);
  const nbAbsAvant = JSON.parse(win.localStorage.getItem('absences') || '[]').length;
  win.validerConfirmation();
  t('Confirmer enregistre bien l absence',
    JSON.parse(win.localStorage.getItem('absences')).length === nbAbsAvant + 1,
    nbAbsAvant + ' -> ' + JSON.parse(win.localStorage.getItem('absences')).length);

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
})();
