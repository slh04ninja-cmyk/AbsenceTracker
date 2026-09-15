
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const FIXE = new Date('2026-09-12T10:00:00').getTime();
const vc = new VirtualConsole(); const err = [];
vc.on('jsdomError', e => err.push(String(e.message||e).slice(0,100)));
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://localhost/', pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(w){ const V=w.Date; w.Date = class extends V { constructor(...a){super(...(a.length?a:[FIXE]))} static now(){return FIXE} };
    w.localStorage.setItem('testHistoGenere_v6','1'); } });
const win = dom.window, doc = win.document;
const nb = () => JSON.parse(win.localStorage.getItem('seancesAnnulees')||'[]').length;
const modale = () => !doc.getElementById('modal-confirmation').classList.contains('hidden');
const msg = () => doc.getElementById('message-confirmation').textContent;
setTimeout(() => {
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email; doc.getElementById('login-password').value = db.password;
  win.connexion();
  // annulation directe via Gestion
  win.switchDirPage('dir-gestion'); win.basculerSegments('seg-fermeture','seg-ferm-seance');
  win.preparerFormulaireAnnulation();
  doc.getElementById('annul-date').value='2026-09-15'; doc.getElementById('annul-classe').value='TCSF-1';
  win.majCreneauxAnnulation();
  const opts=doc.getElementById('annul-creneau').options; doc.getElementById('annul-creneau').value=opts[0].value;
  doc.getElementById('annul-motif').value='Reunion'; win.confirmerAnnulationSeance();
  console.log('annulation creee : ' + nb() + ' en base');

  // --- bouton reel du Dashboard directeur ---
  win.switchDirPage('directeur');
  let b = doc.querySelector('#annul-liste .btn-inline');
  console.log('Dashboard directeur : bouton "' + (b?b.textContent:'AUCUN') + '"');
  if (b) { b.onclick(); console.log('  apres clic -> modale=' + modale() + ' | msg="' + msg() + '" | en base=' + nb()); win.annulerConfirmation(); }

  // --- bouton reel de Gestion (Annulation de seances) ---
  win.switchDirPage('dir-gestion');
  b = doc.querySelector('#annulations-liste .btn-inline');
  console.log('Gestion : bouton "' + (b?b.textContent:'AUCUN') + '"');
  if (b) { b.onclick(); console.log('  apres clic -> modale=' + modale() + ' | msg="' + msg() + '" | en base=' + nb()); win.annulerConfirmation(); }

  // --- dashboard du surveillant ---
  if (typeof win.switchDirPage === 'function') win.switchDirPage('directeur');
  const surv = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';})[0])"));
  console.log('--- reconnexion comme surveillant ' + surv.email);
  win.deconnexion ? win.deconnexion() : null;
  doc.getElementById('login-email').value = surv.email; doc.getElementById('login-password').value = surv.password;
  win.connexion();
  console.log('role connecte = ' + win.eval('utilisateurConnecte.role'));
  if (typeof win.afficherSeancesAnnulees === 'function') win.afficherSeancesAnnulees();
  b = doc.querySelector('#annul-liste-surv .btn-inline');
  console.log('Dashboard surveillant : bouton "' + (b?b.textContent:'AUCUN') + '"');
  if (b) { b.onclick(); console.log('  apres clic -> modale=' + modale() + ' | msg="' + msg() + '" | en base=' + nb()); }
  console.log('erreurs: ' + err.length + (err.length?' | '+err.slice(0,2).join(' ;; '):''));
  process.exit(0);
}, 900);
