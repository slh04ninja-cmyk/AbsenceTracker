/* outils/essai_lecture.js — preuve de l'ETAPE 2 : l'application LIT depuis la base.
 * 1) on envoie les vraies donnees (ecole temoin) ; 2) on VIDE la memoire du telephone
 * (comme un telephone neuf) ; 3) on recharge : tout doit revenir DE LA BASE.
 * L'ecole temoin est effacee apres l'essai.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-LIRE';
const MAIL = 'temoin.lire@exemple.ma';
const MDP = 'Temoin.Lire.1234';
const SAUVE = '/storage/emulated/0/Download/sauvegarde-absencetrack-2026-09-15.json';

const contenu = JSON.parse(fs.readFileSync(SAUVE, 'utf8')).contenu;
const J = k => (typeof contenu[k] === 'string' ? JSON.parse(contenu[k]) : contenu[k]);
const classes = J('classes') || [];
const tableaux = J('tableauxService_v2') || {};
const absences = J('absences') || [];
const nomsProfs = J('nomsProfs') || {};
const attEleves = classes.reduce((n, c) => n + (c.eleves || []).length, 0);
const attSeances = Object.keys(tableaux).reduce((n, k) => n + tableaux[k].length, 0);

const fiches = [];
Object.keys(tableaux).forEach(mail => {
  const code = String(mail).split('@')[0];
  fiches.push({ code: code, email: code + '@exemple.ma', nom: nomsProfs[code] || code, role: 'enseignant', matiere: code.split('-')[0] });
});
const nomsAbs = [];
absences.forEach(a => { if (a.enseignant && nomsAbs.indexOf(a.enseignant) < 0) nomsAbs.push(a.enseignant); });
nomsAbs.forEach(n => fiches.push({ code: 'abs' + nomsAbs.indexOf(n), email: 'abs' + nomsAbs.indexOf(n) + '@exemple.ma', nom: n, role: 'enseignant' }));
fiches.push({ code: 'surv1', email: 'surv1@exemple.ma', nom: 'Surveillant 1', role: 'surveillant' });

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
    win.alert = m => console.log('RAPPORT:\n' + String(m));
    Object.keys(contenu).filter(k => k !== 'utilisateur' && k !== 'etablissement')
      .forEach(k => win.localStorage.setItem(k, typeof contenu[k] === 'string' ? contenu[k] : JSON.stringify(contenu[k])));
    win.localStorage.setItem('etiquetteEcole', '');
    win.localStorage.setItem('indispoProfs', JSON.stringify([
      { id: 1, profCode: 'math-prof1@taalim.ma', debut: '2026-09-14', fin: '2026-09-15', portee: 'journee', motif: 'Maladie' },
      { id: 2, profCode: 'surv1@exemple.ma', debut: '2026-09-16', fin: '2026-09-16', portee: 'journee', motif: 'Maladie' }
    ]));
    win.localStorage.setItem('seancesAnnulees', JSON.stringify([
      { id: 1, dateISO: '2026-09-17', classe: 'TCSF-1', debut: '08:00', fin: '10:00', motif: 'Reunion' }
    ]));
    win.localStorage.setItem('installationServeur', '1');
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== ETAPE 2 : LIRE DEPUIS LA BASE (ecole temoin) ===');
  try {
    let jeton0;
    try { jeton0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    catch (e) { jeton0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    try { await api('/rest/v1/rpc/premier_directeur', jeton0, 'POST', { p_code_etab: CODE, p_nom_etab: 'Ecole temoin (lecture)', p_nom: 'Directeur temoin' }); } catch (e) {}
    const jeton = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    const profil = (await api('/rest/v1/profils?select=id,etablissement_id', jeton))[0];
    const dejaLa = (await api('/rest/v1/profils?select=email', jeton)).map(p => p.email);
    for (const f of fiches) {
      if (dejaLa.indexOf(f.email) >= 0) continue;
      const ligne = { etablissement_id: profil.etablissement_id, nom: f.nom, role: f.role, email: f.email, code: f.code };
      if (f.role === 'enseignant' && f.matiere) ligne.matiere = f.matiere;
      await api('/rest/v1/profils', jeton, 'POST', ligne);
    }

    win.document.getElementById('login-email').value = MAIL;
    win.document.getElementById('login-password').value = MDP;
    await win.eval('connexionParLaBase(true)');
    win.localStorage.setItem('etiquetteEcole', String(profil.etablissement_id));
    win.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');

    // 1. on met les donnees du telephone dans la base
    const r = await win.envoyerMesDonnees();
    console.log('--- envoi : ' + (r ? 'OK' : 'ECHEC') + ' | serveur = ' + JSON.stringify(r && r.sur));

    // 2. on VIDE la memoire du telephone (comme un telephone neuf, sans aucune donnee)
    win.eval('classes = []; absences = []; tableauxService = {}; seancesAnnulees = []; indispoProfs = []; fermeturesEtab = [];' +
             '["classes","absences","tableauxService_v2","seancesAnnulees","indispoProfs","fermeturesEtab"].forEach(function(k){Depot.effacer(k);});');
    console.log('--- telephone vide : classes = ' + win.eval('classes.length') + ', absences = ' + win.eval('absences.length'));

    // 3. on RECHARGE : tout doit venir de la base
    await win.eval('chargerDonneesDuServeur(true)');
    t('classes relues de la base', win.eval('classes.length') === classes.length, win.eval('classes.length') + '/' + classes.length);
    t('eleves relus de la base', win.eval('classes.reduce(function(n,c){return n+(c.eleves||[]).length;},0)') === attEleves,
      win.eval('classes.reduce(function(n,c){return n+(c.eleves||[]).length;},0)') + '/' + attEleves);
    t('emplois du temps relus de la base',
      win.eval('Object.keys(tableauxService).reduce(function(n,k){return n+(tableauxService[k]||[]).length;},0)') === attSeances,
      win.eval('Object.keys(tableauxService).reduce(function(n,k){return n+(tableauxService[k]||[]).length;},0)') + '/' + attSeances);
    t('absences / retards relus de la base', win.eval('absences.length') === absences.length, win.eval('absences.length') + '/' + absences.length);
    t('seances annulees relues de la base', win.eval('seancesAnnulees.length') === 1, win.eval('seancesAnnulees.length'));
    t('absences du personnel relues de la base', win.eval('indispoProfs.length') >= 2, win.eval('indispoProfs.length'));
    t('une absence porte bien sa classe et son eleve',
      win.eval('!!(absences[0] && absences[0].classe && absences[0].eleveId)'),
      win.eval('JSON.stringify(absences[0] && {c: absences[0].classe, e: absences[0].eleveId, m: absences[0].seance, s: absences[0].statut})'));
    t('aucune erreur JS', erreurs.length === 0, JSON.stringify(erreurs.slice(0, 2)));
    console.log(ok ? 'TOUT OK — l application lit tout depuis la base.' : 'ECHEC — voir ci-dessus.');
  } catch (e) {
    console.log('ERREUR : ' + (e && e.message ? e.message : e));
  }
  process.exit(ok ? 0 : 1);
}, 1300);
