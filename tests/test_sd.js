// Test jsdom reel : listes deroulantes personnalisees (AbsenceTrack v3.25)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
vc.on('error', m => erreurs.push('error: ' + m));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://localhost/',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const win = dom.window;
const doc = win.document;

let ok = true;
const t = (nom, cond, extra) => {
  console.log((cond ? 'OK   ' : 'ECHEC') + ' ' + nom + (extra !== undefined ? '  [' + extra + ']' : ''));
  if (!cond) ok = false;
};
const clic = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const sdDe = idSelect => doc.getElementById(idSelect).closest('.sd');

setTimeout(() => {
  // 1. toutes les listes ont ete enveloppees
  // Invariante : CHAQUE <select> est enveloppe par une liste maison (pas de nombre en dur)
  const nbSelects = doc.querySelectorAll('select').length;
  t('chaque <select> a sa liste personnalisee', doc.querySelectorAll('.sd').length === nbSelects && nbSelects >= 9,
    doc.querySelectorAll('.sd').length + ' / ' + nbSelects);
  t('chaque liste a bouton + panneau',
    doc.querySelectorAll('.sd-trigger').length === nbSelects && doc.querySelectorAll('.sd-panel').length === nbSelects);
  t('le <select> natif est toujours dans le DOM', nbSelects >= 9, nbSelects);

  // 2. libelles initiaux
  t('libelle initial periode', sdDe('stats-periode').querySelector('.sd-trigger > span').textContent === 'Ce mois',
    sdDe('stats-periode').querySelector('.sd-trigger > span').textContent);
  t('libelle initial type', sdDe('stats-type').querySelector('.sd-trigger > span').textContent === 'Ab + Rd',
    sdDe('stats-type').querySelector('.sd-trigger > span').textContent);

  // 3. ouverture du panneau
  const sdType = sdDe('stats-type');
  clic(sdType.querySelector('.sd-trigger'));
  t('panneau ouvert au clic', sdType.classList.contains('ouvert'));
  t('3 options rendues', sdType.querySelectorAll('.sd-option').length === 3, sdType.querySelectorAll('.sd-option').length);
  t('option courante marquee actif', sdType.querySelectorAll('.sd-option.actif').length === 1 &&
    sdType.querySelector('.sd-option.actif').textContent.indexOf('Ab + Rd') >= 0,
    sdType.querySelector('.sd-option.actif') && sdType.querySelector('.sd-option.actif').textContent);

  // 4. une seule liste ouverte a la fois
  const sdPeriode = sdDe('stats-periode');
  clic(sdPeriode.querySelector('.sd-trigger'));
  t('ouverture simultanee fermee', !sdType.classList.contains('ouvert') && sdPeriode.classList.contains('ouvert'));

  // v3.46 : on retire le tableau de service de math@ pour tester la liste deroulante classique
  win.eval("tableauxService['math-prof1@taalim.ma'] = []; classes = classes.filter(function(c){ return ['TCSF-1','TCSF-2','TCSF-3'].indexOf(c.nom) >= 0; });");

  // 4bis. connexion reelle en enseignant (comptes lus depuis l'app)
  const prof = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='math-prof1@taalim.ma';})[0])"));
  doc.getElementById('login-email').value = prof.email;
  doc.getElementById('login-password').value = prof.password;
  win.connexion();
  t('connexion enseignant OK', doc.getElementById('page-enseignant').classList.contains('active'), prof.nom);
  t('aucune erreur de connexion', doc.getElementById('login-error').classList.contains('hidden'));

  // 5. choix d'une classe via la liste maison -> effet reel dans l'app
  const sdClasse = sdDe('select-classe');
  clic(sdClasse.querySelector('.sd-trigger'));
  const options = sdClasse.querySelectorAll('.sd-option');
  t('classes listees', options.length === 4, options.length); // 3 classes + "Choisir une classe"
  const cible = Array.prototype.find.call(options, o => o.textContent.indexOf('TCSF-3') === 0);
  t('option TCSF-3 trouvee', !!cible, cible && cible.textContent);
  clic(cible);
  t('valeur ecrite dans le select natif', String(doc.getElementById('select-classe').value) === '3',
    doc.getElementById('select-classe').value);
  t('panneau referme apres choix', !sdClasse.classList.contains('ouvert'));
  t('libelle du bouton mis a jour', sdClasse.querySelector('.sd-trigger > span').textContent === cible.textContent,
    sdClasse.querySelector('.sd-trigger > span').textContent);
  t('onchange de l app declenche (zone de saisie affichee)',
    !doc.getElementById('zone-prise-absence').classList.contains('hidden'));
  t('le meme choix suit dans la 2e liste de classes', String(doc.getElementById('select-classe-stats').value) === '3',
    doc.getElementById('select-classe-stats').value);
  t('libelle de la 2e liste synchronise immediatement',
    sdDe('select-classe-stats').querySelector('.sd-trigger > span').textContent === cible.textContent,
    sdDe('select-classe-stats').querySelector('.sd-trigger > span').textContent);
  t('12 eleves listes', doc.getElementById('liste-eleves-enseignant').children.length === 12,
    doc.getElementById('liste-eleves-enseignant').children.length);

  // 6. filtre type -> afficherStatistiques() doit tourner sans erreur
  const avant = doc.getElementById('chart-repartition').innerHTML;
  clic(sdType.querySelector('.sd-trigger'));
  const optRetard = Array.prototype.find.call(sdType.querySelectorAll('.sd-option'), o => o.textContent.indexOf('Retards') === 0);
  clic(optRetard);
  t('filtre type applique', doc.getElementById('stats-type').value === 'retard', doc.getElementById('stats-type').value);
  t('libelle type = Retards (Rd)', sdType.querySelector('.sd-trigger > span').textContent === 'Retards (Rd)',
    sdType.querySelector('.sd-trigger > span').textContent);
  t('stats recalculees (repartition rendue)', doc.getElementById('chart-repartition').innerHTML.length > 0,
    doc.getElementById('chart-repartition').innerHTML.slice(0, 40));
  t('taux de presence ecrit', doc.getElementById('stat-presence').textContent !== '—',
    doc.getElementById('stat-presence').textContent + ' / ' + doc.getElementById('stat-presence-detail').textContent);

  // 7. clic ailleurs ferme la liste
  clic(sdPeriode.querySelector('.sd-trigger'));
  t('liste periode ouverte', sdPeriode.classList.contains('ouvert'));
  clic(doc.body);
  t('clic ailleurs ferme tout', doc.querySelectorAll('.sd.ouvert').length === 0);

  // 8. theme sombre : le style existe bien
  const css = doc.querySelector('style').textContent;
  t('regles sombres presentes', css.indexOf('body.theme-sombre .sd-panel') > 0 && css.indexOf('body.theme-sombre .sd-option.actif') > 0);
  t('couleurs par role presentes', css.indexOf('.role-enseignant .sd-option.actif') > 0 && css.indexOf('.role-surveillant .sd-option.actif') > 0);
  t('animation d ouverture', css.indexOf('@keyframes sd-apparait') > 0);

  if (erreurs.length) {
    console.log('--- erreurs jsdom ---');
    erreurs.slice(0, 6).forEach(e => console.log('   ' + e));
  }
  console.log('\n=== ' + (ok ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit(ok ? 0 : 1);
}, 400);
