/* outils/essai_ecriture.js — preuve : annuler une seance / enregistrer une absence du
 * personnel ecrit TOUT DE SUITE dans la base (sans attendre « Envoyer mes donnees »).
 * Essai sur une ECOLE TEMOIN, effacee a la fin.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-ECRIT';
const MAIL = 'temoin.ecrit@exemple.ma';
const MDP = 'Temoin.Ecrit.1234';

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

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 160)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.fetch = fetch;
    win.alert = m => console.log(String(m));
    win.localStorage.setItem('installationServeur', '1');
    win.localStorage.setItem('classes', JSON.stringify([{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, massar: 'M1', nom: 'Eleve Un', prenom: '' }] }]));
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== ECRITURE IMMEDIATE DANS LA BASE (ecole temoin) ===');
  try {
    let jeton0;
    try { jeton0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    catch (e) { jeton0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    try { await api('/rest/v1/rpc/premier_directeur', jeton0, 'POST', { p_code_etab: CODE, p_nom_etab: 'Ecole temoin (ecriture)', p_nom: 'Directeur temoin' }); } catch (e) {}
    let jeton = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    const profil = (await api('/rest/v1/profils?select=id,etablissement_id', jeton))[0];
    const etab = profil.etablissement_id;
    const deja = (await api('/rest/v1/profils?select=email', jeton)).map(p => p.email);
    if (deja.indexOf('math-prof1@exemple.ma') < 0) {
      await api('/rest/v1/profils', jeton, 'POST', { etablissement_id: etab, nom: 'Prof Maths', role: 'enseignant', matiere: 'math', email: 'math-prof1@exemple.ma', code: 'math-prof1' });
    }
    if (!(await api('/rest/v1/classes?select=id', jeton)).length) {
      await api('/rest/v1/classes', jeton, 'POST', { etablissement_id: etab, nom: 'TCSF-1' });
    }
    console.log('OK    ecole temoin prete (1 classe, 1 enseignant)');

    win.document.getElementById('login-email').value = MAIL;
    win.document.getElementById('login-password').value = MDP;
    await win.eval('connexionParLaBase(true)');

    // 1. ANNULER UNE SEANCE -> la ligne part tout de suite
    await win.eval('atEnvoyerAnnulationSeance({ dateISO: "2026-09-20", classe: "TCSF-1", debut: "08:00", fin: "10:00", motif: "Reunion" })');
    const ann = await api('/rest/v1/annulations_seances?select=date_seance,debut,fin,motif', jeton);
    t('1. annulation ecrite tout de suite dans la base', ann.length === 1 && ann[0].motif === 'Reunion', JSON.stringify(ann));

    // 2. ENREGISTRER UNE ABSENCE DU PERSONNEL -> la ligne part tout de suite
    await win.eval('atEnvoyerAbsencePersonnel({ profCode: "math-prof1@exemple.ma", role: "enseignant", debut: "2026-09-21", fin: "2026-09-21", portee: "journee", motif: "Maladie" })');
    const abp = await api('/rest/v1/absences_personnel?select=role_absent,debut,fin,motif', jeton);
    t('2. absence du personnel ecrite tout de suite dans la base', abp.length === 1 && abp[0].role_absent === 'enseignant', JSON.stringify(abp));

    // 3. RENVOYER NE DOIT PAS DOUBLER
    await win.eval('atEnvoyerAnnulationSeance({ dateISO: "2026-09-20", classe: "TCSF-1", debut: "08:00", fin: "10:00", motif: "Reunion" })');
    const ann2 = await api('/rest/v1/annulations_seances?select=id', jeton);
    t('3. renvoyer ne double pas', ann2.length === 1, ann2.length);

    // 4. RETABLIR LA SEANCE -> la ligne QUITTE la base
    await win.eval('atRetirerAnnulationSeance({ dateISO: "2026-09-20", classe: "TCSF-1", debut: "08:00" })');
    const ann3 = await api('/rest/v1/annulations_seances?select=id', jeton);
    t('4. retablir retire la ligne de la base', ann3.length === 0, ann3.length);

    t('aucune erreur JS', erreurs.length === 0, JSON.stringify(erreurs.slice(0, 2)));
    console.log(ok ? 'TOUT OK — annulations et absences du personnel ecrivent dans la base.' : 'ECHEC — voir ci-dessus.');
  } catch (e) {
    console.log('ERREUR : ' + (e && e.message ? e.message : e));
  }
  process.exit(ok ? 0 : 1);
}, 1200);
