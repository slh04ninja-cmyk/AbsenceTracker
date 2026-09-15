// Test jsdom : v3.62 — hauteur unique des boutons, cartes des professeurs, xlsx chargé à la demande
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

setTimeout(() => {
  // ---------- 1. Hauteur unique des boutons d'action ----------
  t('variable --btn-h définie (44px)', /--btn-h:\s*44px/.test(css));
  const regle = css.match(/\.btn-primary[^{]*\{[^}]*height: var\(--btn-h\)[^}]*\}/);
  t('règle de hauteur unique présente', !!regle, regle ? regle[0].replace(/\s+/g, ' ').slice(0, 90) : 'absente');
  const couverts = ['btn-primary', 'btn-secondary', 'btn-danger', 'btn-success', 'btn-warning', 'btn-fermer', 'btn-outline-danger', 'btn-mini-profil'];
  t('les 8 classes de boutons couvertes', couverts.every(cl => regle && regle[0].indexOf('.' + cl) >= 0),
    couverts.filter(cl => !regle || regle[0].indexOf('.' + cl) < 0).join(',') || 'toutes');
  t('height + min + max identiques', /height: var\(--btn-h\); min-height: var\(--btn-h\); max-height: var\(--btn-h\)/.test(regle ? regle[0] : ''));
  t('petits boutons de liste exclus (.btn-inline)', /\.btn-inline \{[^}]*height: auto/.test(css));
  // les 2 boutons de la modale "Nom de l'enseignant" partagent la même hauteur
  win.switchProfil !== undefined;
  const b1 = doc.querySelector('#modal-renommer .btn-fermer');
  const b2 = doc.querySelector('#modal-renommer .btn-primary');
  t('modale enseignant : boutons Fermer + Enregistrer présents', !!b1 && !!b2);
  t('modale enseignant : même gabarit pour les 2 boutons',
    !!regle && regle[0].indexOf('.btn-fermer') >= 0 && regle[0].indexOf('.btn-primary') >= 0 &&
    b1.className.split(/\s+/).indexOf('btn-fermer') >= 0 && b2.className.split(/\s+/).indexOf('btn-primary') >= 0);
  // le bouton "Générer" et le bouton Profil utilisent aussi un gabarit de la liste
  t('bouton unique du mot de passe (plus de petit bouton « Générer » à côté du champ)',
    !!doc.getElementById('btn-mdp-action') &&
    doc.querySelectorAll('#modal-renommer .btn-mini-profil[onclick*="genererMotDePasseProf"]').length === 0);

  // ---------- 2. Cartes de la div Professeurs ----------
  connecter();
  function connecter() {
    const d = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
    doc.getElementById('login-email').value = d.email;
    doc.getElementById('login-password').value = d.password;
    win.connexion();
    win.switchProfil();
  }
  const carteProfs = doc.getElementById('dir-profs-list').closest('.stat-card');
  t('carte Professeurs en version compacte (carte-settings)', carteProfs.classList.contains('carte-settings'), carteProfs.className);
  const items = Array.from(doc.querySelectorAll('#dir-profs-list > div'));
  t('11 professeurs listés', items.length === 11, items.length);
  t('cartes de hauteur fixe (44px via la regle partagee)',
    items.every(i => !!i.querySelector('.carte-ligne-titre')) &&
    /--carte-ligne-h: 44px/.test(html) &&
    html.indexOf('.js-annulations > div, .js-personnel > div {') > 0, items[0].style.height);
  t('texte tronqué proprement (ellipsis)',
    /\.carte-ligne-titre \{[^}]*text-overflow: ellipsis/.test(html) && !!items[0].querySelector('.carte-ligne-sous'));
  t('bouton Modifier en .btn-inline (petit)', items[0].querySelector('button').className.indexOf('btn-inline') >= 0,
    items[0].querySelector('button').className);
  t('pas de doublon de padding (py-2/px-3 retirés)', items[0].className.indexOf('py-2') < 0 && items[0].className.indexOf('px-3') < 0,
    items[0].className);

  // ---------- 3. xlsx à la demande ----------
  t('aucun script xlsx bloquant dans la page', doc.querySelector('script[src*="xlsx"]') === null);
  t('XLSX non chargé à l ouverture', typeof win.XLSX === 'undefined', typeof win.XLSX);
  t('chargeur disponible', typeof win.eval('typeof chargerXLSX') === 'string' && win.eval('typeof chargerXLSX') === 'function');
  win.XLSX = { utils: {}, read: function () {} };
  let resolu = null;
  win.eval('xlsxPret()').then(v => { resolu = v; });
  t('xlsxPret() résout true quand XLSX est présent', true);   // vérifié juste après
  t('polices Font Awesome non bloquantes (media=print + onload)',
    /font-awesome[\s\S]{0,140}media="print"[\s\S]{0,60}onload/.test(html));

  setTimeout(() => {
    t('xlsxPret() a bien résolu true', resolu === true, String(resolu));
    t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
    console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
    process.exit(ok ? 0 : 1);
  }, 120);
}, 400);
