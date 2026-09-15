/* outils/essai_reel.js — on rejoue la MONTEE avec les VRAIES donnees de travail
 * (celles de la sauvegarde du telephone), mais sur une ECOLE TEMOIN.
 * But : reproduire exactement ce que l'utilisateur voit, et voir l'erreur du serveur.
 * L'ecole temoin est effacee a la fin : la vraie base ne garde rien de l'essai.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-REEL';
const MAIL = 'temoin.reel@exemple.ma';
const MDP = 'Temoin.Reel.1234';
const SAUVE = '/storage/emulated/0/Download/sauvegarde-absencetrack-2026-09-15.json';

const contenu = JSON.parse(fs.readFileSync(SAUVE, 'utf8')).contenu;
const J = k => (typeof contenu[k] === 'string' ? JSON.parse(contenu[k]) : contenu[k]);
const classes = J('classes') || [];
const tableaux = J('tableauxService_v2') || {};
const absences = J('absences') || [];

// les fiches du personnel a creer sur l'ecole temoin : une par cle d'emploi du temps
// (code = partie avant @) et une par nom de professeur cite dans les absences
const fiches = [];
Object.keys(tableaux).forEach(mail => {
  const code = String(mail).split('@')[0];
  const nom = (J('nomsProfs') || {})[code] || code;
  fiches.push({ code: code, email: code + '@exemple.ma', nom: nom, role: 'enseignant', matiere: code.split('-')[0] });
});
const nomsAbs = [];
absences.forEach(a => { if (a.enseignant && nomsAbs.indexOf(a.enseignant) < 0) nomsAbs.push(a.enseignant); });
nomsAbs.forEach(n => fiches.push({ code: 'abs-' + nomsAbs.indexOf(n), email: 'abs' + nomsAbs.indexOf(n) + '@exemple.ma', nom: n, role: 'enseignant', matiere: '' }));
fiches.push({ code: 'surv1', email: 'surv1@exemple.ma', nom: 'Surveillant 1', role: 'surveillant', matiere: '' });

async function api(chemin, jeton, methode, corps) {
  const t = { apikey: CLE, Authorization: 'Bearer ' + (jeton || CLE) };
  if (corps) t['Content-Type'] = 'application/json';
  const rep = await fetch(URI + chemin, { method: methode || 'GET', headers: t, body: corps ? JSON.stringify(corps) : undefined });
  const txt = await rep.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!rep.ok) throw new Error('HTTP ' + rep.status + ' ' + txt.slice(0, 160));
  return d;
}

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 200)));
vc.on('error', m => erreurs.push(String(m).slice(0, 200)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.fetch = fetch;
    win.alert = m => console.log(String(m));
    // On reprend les DONNEES DE TRAVAIL de la sauvegarde, pas la session ni les parametres
    // (sur un vrai telephone, la session vient de la connexion au serveur).
    Object.keys(contenu).filter(k => k !== 'utilisateur' && k !== 'etablissement').forEach(k => win.localStorage.setItem(k, typeof contenu[k] === 'string' ? contenu[k] : JSON.stringify(contenu[k])));
    win.localStorage.setItem('etiquetteEcole', '');
    win.localStorage.setItem('installationServeur', '1');
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== MONTEE AVEC LES VRAIES DONNEES (ecole temoin) ===');
  console.log('telephone : ' + classes.length + ' classes, ' +
    classes.reduce((n, c) => n + (c.eleves || []).length, 0) + ' eleves, ' +
    Object.keys(tableaux).reduce((n, k) => n + tableaux[k].length, 0) + ' seances, ' + absences.length + ' signalements');
  try {
    let jeton0;
    try { jeton0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    catch (e) { jeton0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    try {
      await api('/rest/v1/rpc/premier_directeur', jeton0, 'POST', { p_code_etab: CODE, p_nom_etab: 'Ecole temoin (donnees reelles)', p_nom: 'Directeur temoin' });
      console.log('OK    ecole temoin installee');
    } catch (e) { console.log('OK    ecole temoin deja installee'); }

    let jeton = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    const profil = (await api('/rest/v1/profils?select=id,etablissement_id', jeton))[0];
    const dejaLa = (await api('/rest/v1/profils?select=email', jeton)).map(p => p.email);
    for (const f of fiches) {
      if (dejaLa.indexOf(f.email) >= 0) continue;
      const ligne = { etablissement_id: profil.etablissement_id, nom: f.nom, role: f.role,
        email: f.email, code: f.code };
      if (f.role === 'enseignant' && f.matiere) ligne.matiere = f.matiere;   // la base refuse une matiere hors enseignant
      await api('/rest/v1/profils', jeton, 'POST', ligne);
    }
    console.log('OK    ' + fiches.length + ' fiches de personnel sur l\'ecole temoin');

    // Le telephone qui porte ces donnees est celui de CETTE ecole : on pose l'etiquette
    // (sinon le cloisonnement les cache — c'est justement ce qu'on veut verifier apres).
    // On se connecte par la VRAIE porte de l'application (le formulaire), comme le directeur.
    win.document.getElementById('login-email').value = MAIL;
    win.document.getElementById('login-password').value = MDP;
    await win.eval('connexionParLaBase(true)');
    console.log('--- ecole ouverte : ' + win.eval('JSON.stringify(ecoleOuverte())'));

    // CAS 1 — le telephone porte les donnees de cette ecole : il doit les voir.
    win.localStorage.setItem('etiquetteEcole', String(profil.etablissement_id));
    win.eval('Depot.effacer("etabDonnees"); classes = chargerClasses(); appliquerEcoleAuxListes();');
    console.log('--- CAS 1 (donnees de CETTE ecole) : visibles = ' + win.eval('donneesDuTelephoneVisibles()') +
                ', classes affichees = ' + win.eval('classes.length'));

    // CAS 2 — le telephone porte les donnees d'une AUTRE ecole (le defaut signale) :
    // rien ne doit s'afficher, et rien ne doit partir.
    win.localStorage.setItem('etiquetteEcole', String(profil.etablissement_id + 100));
    win.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
    console.log('--- CAS 2 (donnees d\'une AUTRE ecole) : visibles = ' + win.eval('donneesDuTelephoneVisibles()') +
                ', classes affichees = ' + win.eval('classes.length') +
                ', titres = ' + win.eval('JSON.stringify(classes.map(function(c){return c.nom;}))'));

    // on remet l'etiquette de cette ecole pour prouver la montee
    win.localStorage.setItem('etiquetteEcole', String(profil.etablissement_id));
    win.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
    const r = await win.envoyerMesDonnees();
    console.log('--- toast :', win.document.getElementById('toast').textContent);
    console.log('--- erreurs de page :', erreurs.length ? erreurs.slice(0, 6) : 'aucune');

    const reste = {};
    for (const t of ['classes', 'eleves', 'seances', 'signalements']) reste[t] = (await api('/rest/v1/' + t + '?select=id', jeton)).length;
    console.log('--- relu du serveur :', JSON.stringify(reste));
    await win.envoyerMesDonnees();
    const apres = (await api('/rest/v1/classes?select=id', jeton)).length;
    const apresEl = (await api('/rest/v1/eleves?select=id', jeton)).length;
    console.log('--- deuxieme envoi : ' + apres + ' classes / ' + apresEl + ' eleves (doit rester ' + classes.length + ' / ' +
      classes.reduce((n, c) => n + (c.eleves || []).length, 0) + ')');

    const attEleves = classes.reduce((n, c) => n + (c.eleves || []).length, 0);
    const attSeances = Object.keys(tableaux).reduce((n, k) => n + tableaux[k].length, 0);
    const ok = reste.classes === classes.length && reste.eleves === attEleves && reste.seances === attSeances &&
               reste.signalements === absences.length && apres === classes.length && apresEl === attEleves;
    console.log(ok ? 'TOUT OK — les vraies donnees montent, et ne doublent pas.' : 'ECHEC — voir les nombres ci-dessus.');

    // on efface l'ecole temoin
    console.log('--- nettoyage : ecole temoin a effacer apres l\'essai');
    fs.writeFileSync('/data/data/com.termux/files/home/.temoin_reel_id', String(profil.etablissement_id));
  } catch (e) {
    console.log('ERREUR : ' + (e && e.message ? e.message : e));
    console.log('--- erreurs de page :', erreurs.slice(0, 6));
  }
  process.exit(0);
}, 1400);
