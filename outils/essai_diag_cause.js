/* outils/essai_diag_cause.js — SONDE DE CAUSE (preuve, pas supposition)
 *
 * Objet : montrer POURQUOI les seances annulees deduites d'une absence d'enseignant
 * n'arrivent jamais (0 ligne). On reproduit exactement la forme des donnees de la base
 * reelle (etablissement 55300S07) :
 *   - la fiche du prof porte DEUX identifiants : code = 'math-prof1' ET
 *     email = 'math-prof1@exemple.ma'  (en base reelle : code math-prof1, email ...@taalim.ma)
 *   - l'emploi du temps vient de la table `seances` (prof_id)
 *   - l'absence du personnel vient de la table `absences_personnel` (prof_id)
 * On lit ensuite, cote application, ce que valent les identifiants utilises par la
 * comparaison de 04-gestion.js. Ecole temoin, effacee a la fin.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-DIAG';
const MAIL = 'temoin.diag@exemple.ma';
const MDP = 'Temoin.Diag.1234';
const MAIL_PROF = 'math.diag1@exemple.ma';
const CODE_PROF = 'math-diag1';

async function api(chemin, jeton, methode, corps) {
  const t = { apikey: CLE, Authorization: 'Bearer ' + (jeton || CLE) };
  if (corps) t['Content-Type'] = 'application/json';
  const rep = await fetch(URI + chemin, { method: methode || 'GET', headers: t, body: corps ? JSON.stringify(corps) : undefined });
  const txt = await rep.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!rep.ok) throw new Error('HTTP ' + rep.status + ' ' + txt.slice(0, 160));
  return d;
}
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
  console.log('=== SONDE : pourquoi les seances deduites d une absence valent 0 ===');
  try {
    let j0;
    try { j0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    catch (e) { j0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    try { await api('/rest/v1/rpc/premier_directeur', j0, 'POST', { p_code_etab: CODE, p_nom_etab: 'Ecole temoin (diagnostic)', p_nom: 'Directeur temoin' }); } catch (e) {}
    const jeton = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    const profil = (await api('/rest/v1/profils?select=id,etablissement_id', jeton))[0];
    const etab = profil.etablissement_id;

    let prof = (await api('/rest/v1/profils?select=id,code,email&email=eq.' + MAIL_PROF, jeton))[0];
    if (!prof) {
      await api('/rest/v1/profils', jeton, 'POST', { etablissement_id: etab, nom: 'Prof Maths', role: 'enseignant', matiere: 'math', email: MAIL_PROF, code: CODE_PROF });
      prof = (await api('/rest/v1/profils?select=id,code,email&email=eq.' + MAIL_PROF, jeton))[0];
    }
    let cls = await api('/rest/v1/classes?select=id', jeton);
    if (!cls.length) { await api('/rest/v1/classes', jeton, 'POST', { etablissement_id: etab, nom: 'TCSF-1' }); cls = await api('/rest/v1/classes?select=id', jeton); }
    const sc = await api('/rest/v1/seances?select=id', jeton);
    if (!sc.length) {
      await api('/rest/v1/seances', jeton, 'POST', { etablissement_id: etab, prof_id: prof.id, classe_id: cls[0].id, jour: 1, debut: '08:00', fin: '10:00', matiere: 'math' });
    }
    // l'absence du personnel, telle que l'ecrit l'application (prof_id, pas de code)
    const ap = await api('/rest/v1/absences_personnel?select=id', jeton);
    if (!ap.length) {
      await api('/rest/v1/absences_personnel', jeton, 'POST', { etablissement_id: etab, prof_id: prof.id, role_absent: 'enseignant', debut: '2026-10-05', fin: '2026-10-05', portee: 'journee', motif: 'Absence' });
    }
    console.log('OK    ecole temoin prete (fiche prof : code=' + prof.code + ' / email=' + prof.email + ')');

    win.document.getElementById('login-email').value = MAIL;
    win.document.getElementById('login-password').value = MDP;
    await win.eval('connexionParLaBase(true)');
    win.localStorage.setItem('etiquetteEcole', String(etab));
    await win.eval('chargerDonneesDuServeur(true)');
    await pause(2500);

    console.log('');
    console.log('--- ce que la BASE a rendu, cote application ---');
    console.log('  cle de l emploi du temps  : ' + win.eval('Object.keys(tableauxService).join(" , ")'));
    console.log('  champ "prof" de la seance : ' + win.eval('(function(){var k=Object.keys(tableauxService)[0];return JSON.stringify(tableauxService[k][0].prof);})()'));
    console.log('  profCode de l absence lue : ' + win.eval('JSON.stringify(indispoProfs[0] && indispoProfs[0].profCode)'));
    console.log('');
    console.log('--- ce que la comparaison de 04-gestion.js a sous la main ---');
    console.log('  nomProfCode(profCode)     : ' + win.eval('JSON.stringify(nomProfCode(indispoProfs[0].profCode))'));
    console.log('  nomsProfs[profCode]       : ' + win.eval('JSON.stringify(nomsProfs[indispoProfs[0].profCode])'));
    console.log('  role de l absence         : ' + win.eval('JSON.stringify(roleAbsence(indispoProfs[0]))'));
    const n = win.eval('seancesAnnuleesParAbsence().length');
    console.log('  >>> seances deduites calculees : ' + n);
    console.log('  >>> seancesAnnulees (memoire)  : ' + win.eval('seancesAnnulees.length'));
    console.log('');
    console.log('--- la MEME absence, mais avec le CODE du prof (comme le choix du formulaire) ---');
    const n2 = win.eval('(function(){var s=indispoProfs[0].profCode; indispoProfs[0].profCode="' + CODE_PROF + '"; var r=seancesAnnuleesParAbsence().length; indispoProfs[0].profCode=s; return r;})()');
    console.log('  >>> seances deduites avec le code : ' + n2);
    console.log('');
    console.log('--- nomProfCode(undefined) : l etiquette fantome ---');
    console.log('  nomProfCode(undefined)    : ' + win.eval('JSON.stringify(nomProfCode(undefined))'));
    console.log('  nomProfCode("")           : ' + win.eval('JSON.stringify(nomProfCode(""))'));
    console.log('  erreurs JS                : ' + JSON.stringify(erreurs.slice(0, 3)));
    console.log('');
    console.log('VERDICT : ' + (n === 0 ? 'la comparaison echoue (0 seance deduite)' : 'la comparaison trouve ' + n + ' seance(s)') +
      ' ; avec le code seul : ' + n2);
  } catch (e) { console.log('ERREUR : ' + (e && e.message ? e.message : e)); }
  process.exit(0);
}, 1300);
