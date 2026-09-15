
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const FIXE = new Date('2026-09-12T10:00:00').getTime();
const vc = new VirtualConsole();
const erreurs = [];
vc.on('jsdomError', e => erreurs.push(String(e.message||e).slice(0,120)));
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://localhost/', pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(win){ const V=win.Date; win.Date = class extends V { constructor(...a){super(...(a.length?a:[FIXE]))} static now(){return FIXE} };
    win.localStorage.setItem('testHistoGenere_v6','1'); } });
const win = dom.window, doc = win.document;
setTimeout(() => {
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();
  // une absence prof -> seance annulee marquee "Absence prof"
  win.switchProfil();
  win.basculerSegments('seg-enseignants','seg-ens-absence');
  doc.getElementById('indispo-prof').value='fr-prof1';
  doc.getElementById('indispo-debut').value='2026-09-15';
  doc.getElementById('indispo-fin').value='2026-09-18';
  doc.getElementById('indispo-portee').value='journee';
  doc.getElementById('indispo-motif').value='Maladie';
  win.enregistrerIndispo();
  win.switchDirPage('directeur');
  const dump = (quoi) => {
    const tags = Array.from(doc.querySelectorAll('#annul-liste .tag-avenir'));
    console.log('--- ' + quoi + ' : body.class="' + doc.body.className + '" tags=' + tags.length);
    tags.slice(0,2).forEach(t => {
      const cs = win.getComputedStyle(t);
      console.log('    texte="' + t.textContent + '" color=' + cs.color + ' bg=' + cs.backgroundColor + ' fontSize=' + cs.fontSize);
    });
    const p = doc.querySelector('#annul-liste .carte-ligne-titre');
    if (p) { const cs = win.getComputedStyle(p); console.log('    titre: whiteSpace=' + cs.whiteSpace + ' overflow=' + cs.overflow + ' color=' + cs.color);
      console.log('    titre texte complet = "' + p.textContent + '"'); }
    const b = doc.querySelector('#annul-liste .btn-inline');
    if (b) { const cs = win.getComputedStyle(b); console.log('    bouton "' + b.textContent + '" color=' + cs.color); } else console.log('    pas de bouton (seance issue absence)');
    const g = doc.querySelector('#annul-liste > div');
    if (g) { const cs = win.getComputedStyle(g); console.log('    carte: bg=' + cs.backgroundColor + ' class=' + g.className); }
  };
  dump('CLAIR (defaut)');
  if (typeof win.basculerTheme === 'function') win.basculerTheme(); else { doc.body.classList.add('theme-sombre'); }
  dump('SOMBRE');
  console.log('erreurs jsdom: ' + erreurs.length + (erreurs.length ? ' | ' + erreurs.slice(0,3).join(' ;; ') : ''));
  process.exit(0);
}, 900);
