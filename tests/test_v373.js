// Test jsdom : v3.73 — les vues Liste de RH (surveillants / enseignants) ont le meme
// affichage que les listes d'absences : zone teintee bordee, 4 cartes avant defilement,
// cartes blanches bordees au titre/sous-titre identiques (renderer partage carteLigne).
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }] }];
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
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const css = Array.from(doc.querySelectorAll('style')).map(x => x.textContent).join('\n');
const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));

setTimeout(() => {
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();
  win.switchProfil();

  // ---------- 1. Les 2 listes partagent la classe des listes de cartes ----------
  const lProfs = doc.getElementById('dir-profs-list'), lSurv = doc.getElementById('dir-surveillants-list');
  t('les 2 listes du personnel portent .js-personnel',
    lProfs.classList.contains('js-personnel') && lSurv.classList.contains('js-personnel'),
    lProfs.className + ' | ' + lSurv.className);
  t('plus aucune trace de .liste-reglages / de la hauteur 286px',
    css.indexOf('liste-reglages') < 0 && css.indexOf('286px') < 0);

  // ---------- 2. CSS commun : meme regle que les absences ----------
  t('regle partagee : absences + personnel (4 cartes / 190px)',
    /\.js-seances-annulees, \.js-absences-personnel, \.js-fermetures, \.js-annulations, \.js-personnel \{/.test(css) &&
    css.indexOf('max-height: 190px; overflow-y: auto') > 0);
  t('hauteur des cartes du personnel = hauteur commune (--carte-ligne-h)',
    css.indexOf('.js-fermetures > div, .js-annulations > div, .js-personnel > div {') > 0);
  t('zone teintee + bordure en theme clair (les 3 roles)',
    css.indexOf('body.role-directeur:not(.theme-sombre) .js-personnel {') > 0 &&
    css.indexOf('background: var(--lot-clair); border-color: var(--lot-bordure);') > 0);
  t('cartes blanches bordees a l interieur (les 3 roles)',
    css.indexOf('body.role-directeur:not(.theme-sombre) .js-personnel > div {') > 0 &&
    css.indexOf('background: #FFFFFF; border: 1px solid var(--lot-bordure);') > 0);
  t('theme sombre pris en compte',
    css.indexOf('body.theme-sombre .js-annulations, body.theme-sombre .js-personnel {') > 0);

  // ---------- 3. Rendu identique aux listes d absences ----------
  doc.getElementById('seg-surv-liste').click();
  const cartesP = Array.from(lProfs.querySelectorAll(':scope > div'));
  const cartesS = Array.from(lSurv.querySelectorAll(':scope > div'));
  t('11 enseignants et 2 surveillants listes', cartesP.length === 11 && cartesS.length === 2,
    cartesP.length + ' / ' + cartesS.length);
  t('chaque carte a le titre et le sous-titre du rendu partage',
    cartesP.every(c => c.querySelector('.carte-ligne-titre') && c.querySelector('.carte-ligne-sous')) &&
    cartesS.every(c => c.querySelector('.carte-ligne-titre') && c.querySelector('.carte-ligne-sous')));
  t('meme structure que la carte d une absence (flex + classe inchangee)',
    cartesP[0].className === 'flex justify-between items-center bg-gray-50 rounded-lg' &&
    cartesP[0].className === cartesS[0].className);
  t('nom dans le titre, matiere + email dans le sous-titre',
    cartesP[0].querySelector('.carte-ligne-titre').textContent.length > 0 &&
    cartesP[0].querySelector('.carte-ligne-sous').textContent.indexOf('@taalim.ma') > 0,
    cartesP[0].querySelector('.carte-ligne-titre').textContent + ' | ' + cartesP[0].querySelector('.carte-ligne-sous').textContent);
  t('carte surveillant : email present',
    cartesS[0].querySelector('.carte-ligne-sous').textContent.indexOf('@taalim.ma') > 0,
    cartesS[0].querySelector('.carte-ligne-sous').textContent);

  // -------- 4. Comparaison directe avec une carte de la liste d absences --------
  const sansAction = win.eval("(function(){var a=carteLigne('Titre test','Sous test',null);return a.className;})()");
  t('carte sans action : meme classe que les listes (carteLigne partage)', sansAction === cartesP[0].className, sansAction);

  // ---------- 5. Le bouton Modifier est toujours fonctionnel ----------
  const btn = cartesP[0].querySelector('button');
  t('bouton Modifier present sur chaque carte',
    !!btn && btn.innerHTML.indexOf('Modifier') > 0 && cartesP.every(c => c.querySelector('button')));
  btn.click();
  t('le bouton ouvre la modale de modification',
    !doc.getElementById('modal-renommer').classList.contains('hidden') &&
    doc.getElementById('renommer-nom').value.length > 0);
  win.fermerRenommageProf();

  // ---------- 6. Vue Absence : les 2 rendus cohabitent dans la meme carte ----------
  doc.getElementById('seg-ens-absence').click();
  win.afficherIndispos();
  const absEns = doc.getElementById('indispo-liste');
  t('la liste d absences reste .js-absences-personnel (vue Absence)',
    absEns.classList.contains('js-absences-personnel') && !absEns.classList.contains('js-personnel'));

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 1200);
