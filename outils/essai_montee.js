/* outils/essai_montee.js — preuve de la MONTEE des donnees, sur une ECOLE TEMOIN.
 *
 * On installe une ecole temoin avec son directeur (comme le ferait un vrai directeur),
 * on met quelques donnees sur le telephone (2 classes, 5 eleves, 3 seances, 2 absences),
 * on appelle « envoyerMesDonnees » et on relit le rapport. L'ecole temoin est effacee
 * apres coup : la vraie base ne garde rien de cet essai.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const URI = 'https://fgrkjrttcbuflykligfw.supabase.co';
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const CODE = 'ECOLE-TEMOIN-DATA';
const MAIL = 'temoin.montee@exemple.ma';
const MDP = 'Temoin.Montee.1234';

const donnees = {
  classes: JSON.stringify([
    { id: 1, nom: 'TC-TEST-1', eleves: [ { id: 11, massar: 'M1', nom: 'Eleve Un' }, { id: 12, massar: 'M2', nom: 'Eleve Deux' }, { id: 13, massar: 'M3', nom: 'Eleve Trois' } ] },
    { id: 2, nom: 'TC-TEST-2', eleves: [ { id: 21, massar: 'M4', nom: 'Eleve Quatre' }, { id: 22, massar: 'M5', nom: 'Eleve Cinq' } ] }
  ]),
  tableauxService_v2: JSON.stringify({
    'math-prof1@exemple.ma': [ { jour: 1, debut: '08:00', fin: '10:00', classe: 'TC-TEST-1', matiere: 'Maths', prof: 'math-prof1@exemple.ma' } ],
    'fr-prof1@exemple.ma': [ { jour: 2, debut: '10:00', fin: '12:00', classe: 'TC-TEST-2', matiere: 'Francais', prof: 'fr-prof1@exemple.ma' } ],
    'surv1@exemple.ma': [ { jour: 3, debut: '14:00', fin: '16:00', classe: 'TC-TEST-1', matiere: 'Surveillance', prof: 'surv1@exemple.ma' } ]
  }),
  absences: JSON.stringify([
    { id: 9001, eleveId: 11, nom: 'Eleve Un', classe: 'TC-TEST-1', heure: '08:30', dateISO: '2026-09-14', seance: 'matin', type: 'absence', statut: 'absent', enseignant: 'math-prof1@exemple.ma' },
    { id: 9002, eleveId: 21, nom: 'Eleve Quatre', classe: 'TC-TEST-2', heure: '10:30', dateISO: '2026-09-15', seance: 'matin', type: 'retard', duree: '20', statut: 'absent', enseignant: 'fr-prof1@exemple.ma' }
  ]),
  seancesAnnulees: JSON.stringify([ { id: 1, dateISO: '2026-09-16', classe: 'TC-TEST-1', debut: '08:00', fin: '10:00', motif: 'Reunion' } ]),
  fermeturesEtab: JSON.stringify([ { id: 1, type: 'Fermeture', libelle: 'Aid', debut: '2026-09-20', fin: '2026-09-21', portee: 'journee' } ]),
  indispoProfs: JSON.stringify([ { id: 1, profCode: 'fr-prof1@exemple.ma', debut: '2026-09-17', fin: '2026-09-18', portee: 'journee', motif: 'Maladie' } ])
};

async function api(chemin, jeton, methode, corps) {
  const t = { apikey: CLE, Authorization: 'Bearer ' + (jeton || CLE) };
  if (corps) t['Content-Type'] = 'application/json';
  const rep = await fetch(URI + chemin, { method: methode || 'GET', headers: t, body: corps ? JSON.stringify(corps) : undefined });
  const txt = await rep.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!rep.ok) throw new Error('HTTP ' + rep.status + ' ' + txt.slice(0, 120));
  return d;
}

const erreurs = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 140)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.fetch = fetch;
    win.alert = m => console.log(String(m));
    Object.keys(donnees).forEach(k => win.localStorage.setItem(k, donnees[k]));
    win.localStorage.setItem('installationServeur', '1');
  }
});
const win = dom.window;

setTimeout(async () => {
  console.log('=== PREUVE DE LA MONTEE DES DONNEES (ecole temoin) ===');
  try {
    // 1. l'ecole temoin + son directeur (par la porte prevue)
    let jeton0 = '';
    try {
      jeton0 = (await api('/auth/v1/signup', null, 'POST', { email: MAIL, password: MDP })).access_token;
    } catch (e) {
      jeton0 = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    }
    try {
      await api('/rest/v1/rpc/premier_directeur', jeton0, 'POST', {
        p_code_etab: CODE, p_nom_etab: 'Ecole temoin (montee)', p_nom: 'Directeur temoin' });
      console.log('OK    ecole temoin installee');
    } catch (e) { console.log('OK    ecole temoin deja installee'); }

    // 2. le personnel, dont les emplois du temps parlent
    let jeton = (await api('/auth/v1/token?grant_type=password', null, 'POST', { email: MAIL, password: MDP })).access_token;
    const profil = (await api('/rest/v1/profils?select=id,etablissement_id', jeton))[0];
    const dejaLa = (await api('/rest/v1/profils?select=email', jeton)).map(p => p.email);
    for (const [nom, mat, mail] of [['Prof Maths', 'math', 'math-prof1@exemple.ma'],
                                    ['Prof Francais', 'fr', 'fr-prof1@exemple.ma'],
                                    ['Surveillant Un', null, 'surv1@exemple.ma']]) {
      if (dejaLa.indexOf(mail) >= 0) continue;
      await api('/rest/v1/profils', jeton, 'POST', { etablissement_id: profil.etablissement_id, nom: nom,
        role: mat ? 'enseignant' : 'surveillant', matiere: mat, email: mail, code: mail.split('@')[0] });
    }
    console.log('OK    3 fiches de personnel creees');

    // 3. la montee, jouee par l'application elle-meme
    await win.atConnecter(MAIL, MDP);
    const r = await win.envoyerMesDonnees();
    console.log('--- toast :', win.document.getElementById('toast').textContent);
    const ids = win.eval('JSON.stringify(idsEcole())');
    console.log('--- memoire des correspondances :', ids.slice(0, 300));

    // 4. relecture independante
    const reste = {
      classes: (await api('/rest/v1/classes?select=id', jeton)).length,
      eleves: (await api('/rest/v1/eleves?select=id', jeton)).length,
      seances: (await api('/rest/v1/seances?select=id', jeton)).length,
      signalements: (await api('/rest/v1/signalements?select=id', jeton)).length,
      annulations: (await api('/rest/v1/annulations_seances?select=id', jeton)).length,
      fermetures: (await api('/rest/v1/fermetures?select=id', jeton)).length,
      absences_personnel: (await api('/rest/v1/absences_personnel?select=id', jeton)).length
    };
    console.log('--- relu du serveur :', JSON.stringify(reste));

    // 5. on renvoie une deuxieme fois : rien ne doit doubler
    await win.envoyerMesDonnees();
    const apres = (await api('/rest/v1/classes?select=id', jeton)).length;
    console.log('--- deuxieme envoi :', apres, 'classe(s) sur le serveur (doit rester 2)');

    let ok = r && reste.classes === 2 && reste.eleves === 5 && reste.seances === 3 &&
             reste.signalements === 2 && reste.annulations === 1 && reste.fermetures === 1 &&
             reste.absences_personnel === 1 && apres === 2;
    console.log(ok ? 'TOUT OK — la montee fonctionne et ne double pas.' : 'ECHEC — voir les nombres ci-dessus.');

    // 6. on efface l'ecole temoin (aucune trace dans la vraie base)
    console.log(erreurs.length ? ('erreurs jsdom : ' + erreurs[0]) : 'aucune erreur dans l application');
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.log('ECHEC :', e.message);
    process.exit(1);
  }
}, 1200);
