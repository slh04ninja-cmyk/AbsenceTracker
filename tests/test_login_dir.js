const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(fs.readFileSync('AbsenceTrack-v2.html', 'utf8'), {
  beforeParse(win) { win.localStorage.setItem('modeDemonstration', '1'); },   // banc de DEMONSTRATION
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const essai = (email) => { doc.getElementById('login-email').value = email; doc.getElementById('login-password').value = '12345'; win.connexion(); return { actif: doc.getElementById('page-directeur').classList.contains('active'), err: doc.getElementById('login-error').classList.contains('hidden') }; };
setTimeout(() => {
  const a = essai('3@taalim.ma');
  t('ancien 3@ refuse', !a.actif && !a.err, a.actif ? 'connecte' : 'refuse');
  const b = essai('d@taalim.ma');
  t('nouveau d@ accepte (page directeur)', b.actif && b.err);
  t('role-directeur pose', doc.body.classList.contains('role-directeur'), Array.from(doc.body.classList).join(' '));
  t('compte directeur = d@taalim.ma', win.eval("comptes.filter(function(c){return c.role==='directeur';})[0].email") === 'd@taalim.ma');
  t('aide de connexion mise a jour', doc.body.innerHTML.indexOf('Directeur : d @taalim.ma') > 0);
  t('aucune trace de 3 @taalim.ma', doc.body.innerHTML.indexOf('3 @taalim.ma') < 0 && doc.body.innerHTML.indexOf('3@taalim.ma') < 0);
  if (erreurs.length) { console.log('--- erreurs ---'); erreurs.slice(0,3).forEach(e => console.log('  ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
