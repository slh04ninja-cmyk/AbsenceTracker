// _dump_model.js — affiche la forme exacte des donnees de l'app (1er element de chaque liste)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) { win.localStorage.setItem('absenceTrackVersion', 'v3.0'); } });
const win = dom.window, doc = win.document;
const keys = ['absences','classes','comptes','etablissement','fermeturesEtab','indispoProfs','nomsProfs','motsDePasse','seancesAnnulees','tableauxService_v2','anneeScolaire'];
const forme = (o) => {
  if (o === null || o === undefined) return String(o);
  if (Array.isArray(o)) return '[' + o.length + '] ' + (o.length ? JSON.stringify(o[0]) : '');
  if (typeof o === 'object') {
    const out = {};
    Object.keys(o).forEach(k => {
      const v = o[k];
      if (Array.isArray(v)) out[k] = '[' + v.length + '] ' + (v.length ? JSON.stringify(v[0]) : '');
      else if (v && typeof v === 'object') out[k] = forme(v);
      else out[k] = v;
    });
    return JSON.stringify(out);
  }
  return JSON.stringify(o);
};
setTimeout(() => {
  const d = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = d.email;
  doc.getElementById('login-password').value = d.password;
  win.connexion();
  setTimeout(() => {
    keys.forEach(k => {
      let v;
      try { v = win.eval('JSON.stringify(' + k + ')'); } catch (e) { v = null; }
      let brut = v !== null && v !== undefined ? JSON.parse(v) : null;
      if (brut === null) { try { brut = JSON.parse(win.localStorage.getItem(k)); } catch (e) {} }
      console.log('\n=== ' + k + ' : ' + forme(brut));
    });
    const t = JSON.parse(win.eval('JSON.stringify(comptes[0])'));
    console.log('\n=== comptes[0] : ' + JSON.stringify(t));
    const t2 = JSON.parse(win.eval('JSON.stringify(comptes.find(function(c){return c.role==="surveillant";}))'));
    console.log('=== comptes surveillant : ' + JSON.stringify(t2));
    console.log('=== nb comptes : ' + win.eval('comptes.length'));
    console.log('=== classes : ' + win.eval('JSON.stringify(classes.map(function(c){return {id:c.id,nom:c.nom,nb:(c.eleves||[]).length};}))'));
    process.exit(0);
  }, 2500);
}, 600);
