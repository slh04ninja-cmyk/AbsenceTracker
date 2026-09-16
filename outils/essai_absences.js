/* outils/essai_absences.js — PREUVE : ajouter/supprimer une absence de prof, et les
 * seances annulees qui en decoulent, se font bien DANS LA BASE Supabase.
 * Ecole temoin, effacee apres l'essai.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-ABS';
const MAIL = 'temoin.abs@exemple.ma';
const MDP = 'Temoin.Abs.1234';

async function api(chemin, jeton, methode, corps) {
  const t = { apikey: CLE, Authorization: 'Bearer ' + (jeton || CLE) };
  if (corps) t['Content-Type'] = 'application/json';
  const rep = await fetch(URI + chemin, { method: methode || 'GET', headers: t, body: corps ? JSON.stringify(corps) : undefined });
  const txt = await rep.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!rep.ok) throw new Error('HTTP ' + rep.status + ' ' + txt.slice(0, 140));
  return d;
}
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const pause = ms => new Promise(r => setTimeout(r, ms));
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 160)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.fetch = fetch; win.alert = () => {};
    win.localStorage.setItem('installationServeur', '1');
    win.localStorage.setItem('etiquetteEcole', '');
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== ABSENCES DE PROF + SEANCES ANNULEES : DANS LA BASE ? (ecole temoin) ===');
  try {
    let j0;
    try { j0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    catch (e) { j0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    try { await api('/rest/v1/rpc/premier_directeur', j0, 'POST', { p_code_etab: CODE, p_nom_etab: 'Ecole temoin (absences)', p_nom: 'Directeur temoin' }); } catch (e) {}
    const jeton = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    const profil = (await api('/rest/v1/profils?select=id,etablissement_id', jeton))[0];
    const etab = profil.etablissement_id;
    const deja = (await api('/rest/v1/profils?select=email', jeton)).map(p => p.email);
    if (deja.indexOf('math-prof1@exemple.ma') < 0) {
      await api('/rest/v1/profils', jeton, 'POST', { etablissement_id: etab, nom: 'Prof Maths', role: 'enseignant', matiere: 'math', email: 'math-prof1@exemple.ma', code: 'math-prof1' });
    }
    const prof = (await api('/rest/v1/profils?select=id&email=eq.math-prof1@exemple.ma', jeton))[0];
    let cls = await api('/rest/v1/classes?select=id', jeton);
    if (!cls.length) { await api('/rest/v1/classes', jeton, 'POST', { etablissement_id: etab, nom: 'TCSF-1' }); cls = await api('/rest/v1/classes?select=id', jeton); }
    const sc = await api('/rest/v1/seances?select=id', jeton);
    if (!sc.length) {
      await api('/rest/v1/seances', jeton, 'POST', { etablissement_id: etab, prof_id: prof.id, classe_id: cls[0].id, jour: 1, debut: '08:00', fin: '10:00', matiere: 'math' });
    }
    console.log('OK    ecole temoin prete (1 classe, 1 prof, 1 seance le lundi)');

    win.document.getElementById('login-email').value = MAIL;
    win.document.getElementById('login-password').value = MDP;
    await win.eval('connexionParLaBase(true)');
    win.localStorage.setItem('etiquetteEcole', String(etab));
    await win.eval('chargerDonneesDuServeur(true)');
    console.log('--- seances chargees de la base : ' + win.eval('Object.keys(tableauxService).reduce(function(n,k){return n+tableauxService[k].length;},0)'));

    // 1. AJOUTER UNE ABSENCE DE PROF (lundi 05/10 -> mercredi 07/10)
    win.eval('(function(){function opt(id,v){var s=document.getElementById(id);var o=document.createElement("option");o.value=v;s.appendChild(o);s.value=v;}' +
      'opt("indispo-prof","math-prof1@exemple.ma");' +
      'document.getElementById("indispo-debut").value="2026-10-05";document.getElementById("indispo-fin").value="2026-10-07";' +
      'document.getElementById("indispo-portee").value="journee";document.getElementById("indispo-motif").value="Maladie";' +
      'enregistrerAbsence("indispo","indispo-prof","enseignant");})()');
    await pause(5000);
    const a1 = await api('/rest/v1/absences_personnel?select=id,debut,fin,motif', jeton);
    t('1. absence du prof ECRITE dans la base', a1.length === 1 && a1[0].motif === 'Maladie', JSON.stringify(a1));
    const c1 = await api('/rest/v1/annulations_seances?select=id,date_seance,debut,motif', jeton);
    t('2. seances annulees qui en decoulent ECRITES dans la base', c1.length >= 1 && /Absence de/.test(c1[0].motif || ''), JSON.stringify(c1));
    console.log('--- annulations sur le telephone : ' + win.eval('seancesAnnulees.length'));

    // 3. SUPPRIMER L'ABSENCE -> ses seances sont RETABLIES (telephone ET base)
    const idAbs = win.eval('indispoProfs[0].id');
    win.eval('vraimentSupprimerIndispo(' + JSON.stringify(idAbs) + ')');
    await pause(6000);
    const a2 = await api('/rest/v1/absences_personnel?select=id', jeton);
    t('3. absence du prof SUPPRIMEE de la base', a2.length === 0, a2.length);
    const c2 = await api('/rest/v1/annulations_seances?select=id,motif', jeton);
    t('4. seances RETABLIES : elles quittent la base', c2.length === 0, JSON.stringify(c2));
    console.log('--- annulations restantes sur le telephone : ' + win.eval('seancesAnnulees.length'));
    t('5. aucune erreur JS', erreurs.length === 0, JSON.stringify(erreurs.slice(0, 2)));
    console.log(ok ? 'TOUT OK — ces operations se font bien dans la base Supabase.' : 'ECHEC — voir ci-dessus.');
  } catch (e) { console.log('ERREUR : ' + (e && e.message ? e.message : e)); }
  process.exit(ok ? 0 : 1);
}, 1300);
