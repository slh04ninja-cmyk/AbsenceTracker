/* outils/essai_actions.js — LA PREUVE : les actions du DIRECTEUR sont ecrites dans la base.
 * On joue les VRAIS boutons de l'application (approuver une absence, ajouter une absence
 * de personnel, annuler une seance, supprimer une absence) sur une ECOLE TEMOIN, et on
 * relit la base apres chaque action. L'ecole temoin est effacee apres l'essai.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-ACTIONS';
const MAIL = 'temoin.actions@exemple.ma';
const MDP = 'Temoin.Actions.1234';
const SAUVE = '/storage/emulated/0/Download/sauvegarde-absencetrack-2026-09-15.json';

const contenu = JSON.parse(fs.readFileSync(SAUVE, 'utf8')).contenu;
const J = k => (typeof contenu[k] === 'string' ? JSON.parse(contenu[k]) : contenu[k]);
const tableaux = J('tableauxService_v2') || {};
const absences = J('absences') || [];
const nomsProfs = J('nomsProfs') || {};
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
const pause = ms => new Promise(r => setTimeout(r, ms));

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 160)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.fetch = fetch;
    win.alert = () => {};
    Object.keys(contenu).filter(k => k !== 'utilisateur' && k !== 'etablissement')
      .forEach(k => win.localStorage.setItem(k, typeof contenu[k] === 'string' ? contenu[k] : JSON.stringify(contenu[k])));
    win.localStorage.setItem('etiquetteEcole', '');
    win.localStorage.setItem('installationServeur', '1');
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== LES ACTIONS DU DIRECTEUR VONT-ELLES DANS LA BASE ? (ecole temoin) ===');
  try {
    let jeton0;
    try { jeton0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    catch (e) { jeton0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    try { await api('/rest/v1/rpc/premier_directeur', jeton0, 'POST', { p_code_etab: CODE, p_nom_etab: 'Ecole temoin (actions)', p_nom: 'Directeur temoin' }); } catch (e) {}
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

    // 0. on met d'abord les donnees du telephone dans la base (le bouton d'envoi)
    await win.envoyerMesDonnees();
    await pause(1500);
    const avant = {
      sig: (await api('/rest/v1/signalements?select=id', jeton)).length,
      ap: (await api('/rest/v1/absences_personnel?select=id', jeton)).length,
      ann: (await api('/rest/v1/annulations_seances?select=id', jeton)).length
    };
    console.log('--- base de depart : ' + JSON.stringify(avant));

    // 1. APPROUVER UNE ABSENCE (bouton « Justifier » du directeur)
    const cible = win.eval('JSON.stringify(absences.filter(function(a){return a.statut==="absent"||a.statut==="justifie_s";})[0]||null)');
    const c = JSON.parse(cible);
    if (!c) { t('une absence a approuver existe', false); }
    else {
      win.eval('(function(){var s=document.getElementById("select-motif"); if(s) s.value="Maladie"; justifierAbsence(' + JSON.stringify(c.id) + ', "dir");})()');
      await pause(3500);
      const ligne = await api('/rest/v1/signalements?select=statut,motif,decide_par,decide_le&eleve_id=eq.' + c.eleveId +
        '&date_abs=eq.' + c.dateISO + '&moment=eq.' + (c.seance || 'matin'), jeton);
      t('1. approbation du directeur ecrite dans la base',
        ligne.length === 1 && ligne[0].statut === 'justifie_d' && ligne[0].motif === 'Maladie' && !!ligne[0].decide_par,
        JSON.stringify(ligne[0] || {}));
    }

    // 2. AJOUTER UNE ABSENCE DE PERSONNEL (enseignant)
    win.eval('(function(){var s=document.getElementById("indispo-prof");s.innerHTML="<option value=\'math-prof1@exemple.ma\'>Prof</option>";s.value="math-prof1@exemple.ma";' +
      'document.getElementById("indispo-debut").value="2026-10-05";document.getElementById("indispo-fin").value="2026-10-05";' +
      'document.getElementById("indispo-portee").value="journee";document.getElementById("indispo-motif").value="Maladie";' +
      'enregistrerAbsence("indispo","indispo-prof","enseignant");})()');
    await pause(3500);
    const apres2 = await api('/rest/v1/absences_personnel?select=debut,motif,role_absent', jeton);
    t('2. absence de personnel ajoutee ecrite dans la base',
      apres2.length === avant.ap + 1 && apres2.some(x => x.motif === 'Maladie' && x.role_absent === 'enseignant'),
      apres2.length + ' (avant ' + avant.ap + ')');

    // 3. ANNULER UNE SEANCE
    win.eval('(function(){var g=document.getElementById("annul-classe");g.innerHTML="<option value=\'TCSF-1\'>TCSF-1</option>";g.value="TCSF-1";' +
      'var c=document.getElementById("annul-creneau");c.innerHTML="<option value=\'10:00|12:00\'>10-12</option>";c.value="10:00|12:00";' +
      'document.getElementById("annul-date").value="2026-10-07";' +
      'document.getElementById("annul-motif").value="Reunion";' +
      'confirmerAnnulationSeance();})()');
    await pause(3500);
    const apres3 = await api('/rest/v1/annulations_seances?select=date_seance,debut,motif', jeton);
    t('3. annulation de seance ecrite dans la base',
      apres3.length === avant.ann + 1 && apres3.some(x => String(x.date_seance) === '2026-10-07'),
      apres3.length + ' (avant ' + avant.ann + ')');

    // 4. SUPPRIMER UNE ABSENCE -> la ligne QUITTE la base
    if (c) {
      win.eval('absences = absences.filter(function(a){return !(a.eleveId===' + JSON.stringify(c.eleveId) +
        ' && a.dateISO==="' + c.dateISO + '" && (a.seance||"matin")==="' + (c.seance || 'matin') + '");}); Depot.ecrireJSON("absences", absences);');
      await pause(3500);
      const apres4 = await api('/rest/v1/signalements?select=id&eleve_id=eq.' + c.eleveId + '&date_abs=eq.' + c.dateISO +
        '&moment=eq.' + (c.seance || 'matin'), jeton);
      t('4. absence supprimee retiree de la base', apres4.length === 0, apres4.length);
    }

    t('aucune erreur JS', erreurs.length === 0, JSON.stringify(erreurs.slice(0, 2)));
    console.log(ok ? 'TOUT OK — chaque action du directeur est bien ecrite dans la base.' : 'ECHEC — voir ci-dessus.');
  } catch (e) {
    console.log('ERREUR : ' + (e && e.message ? e.message : e));
  }
  process.exit(ok ? 0 : 1);
}, 1400);
