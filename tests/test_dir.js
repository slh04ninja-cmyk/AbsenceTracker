// Test jsdom : connexion DIRECTEUR + theme lot 5 (AbsenceTrack v3.27)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
vc.on('error', m => erreurs.push('error: ' + m));

const dom = new JSDOM(html, {
  beforeParse(win) { win.localStorage.setItem('modeDemonstration', '1'); },   // banc de DEMONSTRATION
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc });
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const clic = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const css = doc.querySelector('style').textContent;

setTimeout(() => {
  const dir = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = dir.email;
  doc.getElementById('login-password').value = dir.password;
  win.connexion();

  t('connexion directeur', doc.getElementById('page-directeur').classList.contains('active'), dir.nom);
  t('classe role-directeur posee sur <body>', doc.body.classList.contains('role-directeur'),
    Array.from(doc.body.classList).join(' '));
  t('aucun role enseignant/surveillant residuel',
    !doc.body.classList.contains('role-enseignant') && !doc.body.classList.contains('role-surveillant'));

  // feuille de style : autant de regles directeur que surveillant
  const nbSurv = (css.match(/\.role-surveillant/g) || []).length;
  const nbDir = (css.match(/\.role-directeur/g) || []).length;
  t('regles directeur >= regles surveillant', nbDir >= nbSurv, nbSurv + ' / ' + nbDir);
  // v3.71 : un seul theme clair pour les 3 roles
  t('palette claire unique pour les 3 roles',
    /body\.role-enseignant, body\.role-surveillant, body\.role-directeur \{\s*--lot-fond: #F4F6FA;/.test(css) &&
    css.indexOf('--lot-primaire: #26395A;') > 0 && css.indexOf('--lot-accent: #E15F67;') > 0 &&
    css.indexOf('--lot-bordure: #D7E0EA;') > 0 && css.indexOf('--lot-secondaire: #0C829F;') > 0);
  t('appbar directeur coloree', css.indexOf('.role-directeur .appbar') > 0);
  t('boutons directeur colores',
    css.indexOf('.role-directeur .btn-primary') > 0 && css.indexOf('.role-directeur .btn-fermer') > 0);
  t('cartes/nav directeur colorees',
    css.indexOf('.role-directeur .stat-card-absences') > 0 && css.indexOf('.role-directeur .nav-item.active') > 0);
  t('liste deroulante directeur coloree',
    css.indexOf('.role-directeur .sd-trigger') > 0 && css.indexOf('.role-directeur .sd-option.actif') > 0);
  t('accent corail (#E15F67) present', css.indexOf('#E15F67') > 0);
  t('LOTS_ROLE : les 3 roles partagent la palette claire',
    win.eval("LOTS_ROLE.directeur.primaire") === '#26395A' &&
    win.eval("LOTS_ROLE.enseignant.primaire") === '#26395A' &&
    win.eval("LOTS_ROLE.surveillant.accent") === '#E15F67' &&
    win.eval("typeof LOT_CLAIR") === 'object');
  t('plus aucune couleur de lot par role (theme clair unifie)',
    ['#F82667', '#33018D', '#F868A3', '#AB1370', '#53068A', '#68CCA1', '#9CC0CA'].every(c => css.indexOf(c) < 0));
  t('fond de page, listes teintees et bordures visibles',
    css.indexOf('background: var(--lot-fond);') > 0 &&
    css.indexOf('background: var(--lot-clair); border-color: var(--lot-bordure);') > 0 &&
    css.indexOf('.js-annulations > div, .js-personnel > div {') > 0 && css.indexOf('background: #FFFFFF; border: 1px solid var(--lot-bordure);') > 0);

  // une liste deroulante restante fonctionne (dir-motif a ete supprime en v3.33)
  const sd = doc.getElementById('stats-periode').closest('.sd');
  clic(sd.querySelector('.sd-trigger'));
  t('liste deroulante ouverte (page stats)', sd.classList.contains('ouvert'));
  clic(sd.querySelectorAll('.sd-option')[2]);
  t('valeur ecrite dans le select', doc.getElementById('stats-periode').value === 'mois', doc.getElementById('stats-periode').value);
  t('une liste maison par <select>', doc.querySelectorAll('.sd').length === doc.querySelectorAll('select').length,
    doc.querySelectorAll('.sd').length + ' / ' + doc.querySelectorAll('select').length);

  // retour au login : le role doit etre retire
  win.eval("utilisateurConnecte = null; appliquerRoleTheme();");
  t('role-directeur retire a la deconnexion', !doc.body.classList.contains('role-directeur'),
    Array.from(doc.body.classList).join(' '));

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
