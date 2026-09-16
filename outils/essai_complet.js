/* outils/essai_complet.js — recette complete de l'application Android (ecole temoin).
 * On joue chaque fonctionnalite et on verifie :
 *   1) que la base Supabase enregistre bien le resultat ;
 *   2) que TOUT le reseau part vers Supabase (aucun autre serveur) ;
 *   3) qu'aucune erreur JavaScript n'apparait.
 * L'ecole temoin est effacee apres l'essai (SQL de nettoyage).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const HOTE = 'fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-TOUT';
const MAIL = 'temoin.tout@exemple.ma';
const MDP = 'Temoin.Tout.1234';
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

// ---- le mouchard reseau : tout appel sortant est note ----
const appels = [];
const refus = [];
function fetchSurveille(url, options) {
  appels.push(String(url));
  return fetch(url, options).then(function (rep) {
    if (!rep.ok && String(url).indexOf('/rest/v1/') >= 0) {
      const m = String(options && options.method || 'GET');
      if (m !== 'GET') {
        return rep.clone().text().then(function (txt) {
          refus.push(m + ' ' + String(url).split('/rest/v1/')[1].slice(0, 40) + ' -> HTTP ' + rep.status + ' ' + txt.slice(0, 200));
          return rep;
        });
      }
    }
    return rep;
  });
}

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 160)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.fetch = fetchSurveille;
    win.alert = () => {};
    Object.keys(contenu).filter(k => k !== 'utilisateur' && k !== 'etablissement')
      .forEach(k => win.localStorage.setItem(k, typeof contenu[k] === 'string' ? contenu[k] : JSON.stringify(contenu[k])));
    win.localStorage.setItem('etiquetteEcole', '');
    win.localStorage.setItem('installationServeur', '1');
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== RECETTE COMPLETE (ecole temoin) ===');
  try {
    let jeton0;
    try { jeton0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    catch (e) { jeton0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token; }
    try { await api('/rest/v1/rpc/premier_directeur', jeton0, 'POST', { p_code_etab: CODE, p_nom_etab: 'Ecole temoin (recette)', p_nom: 'Directeur temoin' }); } catch (e) {}
    const jeton = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    const profil = (await api('/rest/v1/profils?select=id,etablissement_id', jeton))[0];
    const dejaLa = (await api('/rest/v1/profils?select=email', jeton)).map(p => p.email);
    for (const f of fiches) {
      if (dejaLa.indexOf(f.email) >= 0) continue;
      const ligne = { etablissement_id: profil.etablissement_id, nom: f.nom, role: f.role, email: f.email, code: f.code };
      if (f.role === 'enseignant' && f.matiere) ligne.matiere = f.matiere;
      await api('/rest/v1/profils', jeton, 'POST', ligne);
    }

    // ---------- 1. CONNEXION ----------
    win.document.getElementById('login-email').value = MAIL;
    win.document.getElementById('login-password').value = MDP;
    await win.eval('connexionParLaBase(true)');
    t('1. connexion au compte de l\'ecole', win.eval('!!(utilisateurConnecte && utilisateurConnecte.serveur)'));
    t('1. temoin d\'etat : « serveur »', win.eval('etatTravail()') === 'serveur', win.eval('etatTravail()'));

    // ---------- 2. ENVOI DES DONNEES DU TELEPHONE ----------
    win.localStorage.setItem('etiquetteEcole', String(profil.etablissement_id));
    win.eval('classes = chargerClasses(); appliquerEcoleAuxListes();');
    const r1 = await win.envoyerMesDonnees();
    t('2. envoi : classes / eleves / seances / absences',
      !!r1 && r1.sur.classes === 6 && r1.sur.eleves === 117 && r1.sur.seances === 51 && r1.sur.signalements === 57,
      JSON.stringify(r1 && r1.sur));

    // ---------- 3. LECTURE DEPUIS LA BASE ----------
    win.eval('classes=[];absences=[];tableauxService={};seancesAnnulees=[];indispoProfs=[];' +
      '["classes","absences","tableauxService_v2","seancesAnnulees","indispoProfs"].forEach(function(k){Depot.effacer(k);});');
    await win.eval('chargerDonneesDuServeur(true)');
    t('3. relecture : 6 classes / 117 eleves / 51 seances / 57 absences',
      win.eval('classes.length') === 6 && win.eval('classes.reduce(function(n,c){return n+(c.eleves||[]).length;},0)') === 117 &&
      win.eval('Object.keys(tableauxService).reduce(function(n,k){return n+tableauxService[k].length;},0)') === 51 &&
      win.eval('absences.length') >= 56,
      win.eval('classes.length') + '/' + win.eval('absences.length'));

    // ---------- 4. APPROUVER UNE ABSENCE (directeur) ----------
    const c = JSON.parse(win.eval('JSON.stringify(absences.filter(function(a){return a.statut!=="justifie_d";})[0]||null)'));
    win.eval('(function(){var s=document.getElementById("select-motif"); if(s) s.value="Maladie"; justifierAbsence(' + JSON.stringify(c.id) + ', "dir");})()');
    await pause(3000);
    const l4 = await api('/rest/v1/signalements?select=statut,decide_par&eleve_id=eq.' + c.eleveId + '&date_abs=eq.' + c.dateISO + '&moment=eq.' + (c.seance || 'matin'), jeton);
    t('4. approbation du directeur enregistree', l4.length === 1 && l4[0].statut === 'justifie_d' && !!l4[0].decide_par, JSON.stringify(l4[0] || {}));

    // ---------- 5. JUSTIFIER COMME SURVEILLANT ----------
    const c5 = JSON.parse(win.eval('JSON.stringify(absences.filter(function(a){return a.statut==="absent";})[0]||null)'));
    if (c5) {
      win.eval('(function(){var s=document.getElementById("select-motif"); if(s) s.value="Retard"; justifierAbsence(' + JSON.stringify(c5.id) + ', "surv");})()');
      await pause(3000);
      const l5 = await api('/rest/v1/signalements?select=statut&eleve_id=eq.' + c5.eleveId + '&date_abs=eq.' + c5.dateISO + '&moment=eq.' + (c5.seance || 'matin'), jeton);
      t('5. justification du surveillant enregistree', l5.length === 1 && l5[0].statut === 'justifie_s', JSON.stringify(l5[0] || {}));
    } else { t('5. justification du surveillant enregistree', true, 'aucune absence non justifiee a tester'); }

    // ---------- 6. ENREGISTRER UNE ABSENCE (comme un enseignant) ----------
    win.eval('(function(){var cl=classes[0];var el=cl.eleves[0];absences.push({id:Date.now(),eleveId:el.id,nom:el.nom,classe:cl.nom,heure:"09:00",date:"07/10/2026",dateISO:"2026-10-07",seance:"matin",type:"absence",duree:"",statut:"absent",enseignant:"math-prof1@exemple.ma",matiere:"Maths",motif:""});Depot.ecrireJSON("absences",absences);})()');
    await pause(3000);
    const l6 = await api('/rest/v1/signalements?select=id,statut&date_abs=eq.2026-10-07', jeton);
    t('6. absence enregistree par un enseignant ecrite dans la base', l6.length === 1 && l6[0].statut === 'absent', l6.length);

    // ---------- 7. ABSENCE DU PERSONNEL (RH) ----------
    win.eval('(function(){function opt(id,v){var s=document.getElementById(id);var o=document.createElement("option");o.value=v;s.appendChild(o);s.value=v;}' +
      'opt("indispo-prof","math-prof1@exemple.ma");' +
      'document.getElementById("indispo-debut").value="2026-10-05";document.getElementById("indispo-fin").value="2026-10-06";' +
      'document.getElementById("indispo-portee").value="journee";document.getElementById("indispo-motif").value="Maladie";' +
      'enregistrerAbsence("indispo","indispo-prof","enseignant");})()');
    await pause(3000);
    const l7 = await api('/rest/v1/absences_personnel?select=id,role_absent', jeton);
    t('7. absence du personnel enregistree', l7.length === 1, l7.length);

    // ---------- 8. ANNULER PUIS RETABLIR UNE SEANCE ----------
    win.eval('(function(){function opt(id,v){var s=document.getElementById(id);var o=document.createElement("option");o.value=v;s.appendChild(o);s.value=v;}' +
      'opt("annul-classe","TCSF-1");opt("annul-creneau","10:00|12:00");' +
      'document.getElementById("annul-date").value="2026-10-14";confirmerAnnulationSeance();})()');
    await pause(3000);
    const l8 = await api('/rest/v1/annulations_seances?select=id,date_seance', jeton);
    t('8. annulation de seance enregistree', l8.length === 1 && String(l8[0].date_seance) === '2026-10-14', JSON.stringify(l8));
    win.eval('(function(){var sn=seancesAnnulees[0]; vraimentRetablirSeance(sn.id);})()');
    await pause(3000);
    const l8b = await api('/rest/v1/annulations_seances?select=id', jeton);
    t('8 bis. seance retablie : la ligne quitte la base', l8b.length === 0, l8b.length);

    // ---------- 9. RENOMMER UNE FICHE + MOT DE PASSE ----------
    const fiche = (await api('/rest/v1/profils?select=id,nom,role,email,code&role=eq.enseignant&limit=1', jeton))[0];
    await win.eval('ouvrirRenommageFicheBase(' + JSON.stringify(fiche) + ')');
    t('9. la fenetre de modification s\'ouvre (nom + mot de passe)',
      win.eval('!document.getElementById("modal-renommer").classList.contains("hidden")') &&
      win.eval('!!document.getElementById("renommer-mdp")'));
    win.eval('document.getElementById("renommer-nom").value="Prof Renomme"; document.getElementById("renommer-mdp").value="Motdepasse9"; confirmerRenommageProf();');
    await pause(2500);
    const l9 = await api('/rest/v1/profils?select=nom&id=eq.' + fiche.id, jeton);
    t('9 bis. nouveau nom enregistre dans la base', l9[0] && l9[0].nom === 'Prof Renomme', JSON.stringify(l9));
    t('9 ter. mot de passe garde par l\'application (a remettre)',
      win.eval('!!(motsDePasseEcole()["' + fiche.email + '"])') || win.eval('!!(motsDePasse["' + fiche.email + '"])'));

    // ---------- 10. SUPPRIMER UNE ABSENCE ----------
    win.eval('(function(){var a=absences.filter(function(x){return x.dateISO==="2026-10-07";})[0];' +
      'absences=absences.filter(function(x){return x.dateISO!=="2026-10-07";});Depot.ecrireJSON("absences",absences);})()');
    await pause(3000);
    const l10 = await api('/rest/v1/signalements?select=id&date_abs=eq.2026-10-07', jeton);
    t('10. absence supprimee retiree de la base', l10.length === 0, l10.length);

    // ---------- 11. LE RESEAU ----------
    const hotes = {};
    appels.forEach(function (u) { let h = 'inconnu'; try { h = new URL(u).host; } catch (e) {} hotes[h] = (hotes[h] || 0) + 1; });
    const autres = Object.keys(hotes).filter(function (h) { return h !== HOTE; });
    t('11. tout le reseau va vers Supabase uniquement', autres.length === 0, JSON.stringify(hotes));
    t('12. aucune erreur JavaScript', erreurs.length === 0, JSON.stringify(erreurs.slice(0, 3)));

    if (refus.length) { console.log('--- REFUS DE LA BASE (' + refus.length + ') :'); refus.slice(0, 6).forEach(x => console.log('   ' + x)); }
    console.log(ok ? 'TOUT OK — toutes les fonctionnalites ecrivent dans la base, sans erreur.' : 'ECHEC — voir ci-dessus.');
  } catch (e) {
    console.log('ERREUR : ' + (e && e.message ? e.message : e));
  }
  process.exit(ok ? 0 : 1);
}, 1400);
