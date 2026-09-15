/* outils/essai_connexion.js — l'application branchee sur la VRAIE base de l'ecole.
 *
 * Pourquoi ici et pas dans tests/ : cet essai a besoin du reseau et de vrais
 * identifiants ; la chaine d'integration ne doit pas l'executer.
 *
 * Usage :  node outils/essai_connexion.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const mdp = JSON.parse(fs.readFileSync(path.join(process.env.HOME, 'abs2', 'comptes.json'), 'utf8'));
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 140)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) { win.fetch = fetch; }        // Node n'applique pas CORS : la base repond vraiment
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const pause = ms => new Promise(r => setTimeout(r, ms));
const pageActive = () => { const p = doc.querySelector('.page-container.active'); return p ? p.id : 'aucune'; };

setTimeout(async () => {
  console.log('ESSAI REEL — application <-> base de l\'ecole');
  console.log('='.repeat(64));

  // ---------- 1. l'etat d'un code, AVANT toute connexion ----------
  t('le code de Jerada est reconnu comme installe', (await win.atEtatCode('55300S07')) === 'installe');
  t('un code inconnu est annonce comme libre', (await win.atEtatCode('ECOLE-QUI-N-EXISTE-PAS')) === 'libre');
  t('un code vide est refuse proprement', (await win.atEtatCode('   ')) === 'code_vide');

  // ---------- 2. mauvais mot de passe ----------
  let message = '';
  try { await win.atConnecter('directeur@taalim.ma', 'mauvais-mot-de-passe'); } catch (e) { message = e.message; }
  t('mauvais mot de passe : refus avec message', /invalid|credential/i.test(message), message.slice(0, 40));

  // ---------- 3. qui suis-je (appels bruts) ----------
  await win.atConnecter('directeur@taalim.ma', mdp['directeur@taalim.ma']);
  const moi = await win.atQuiSuisJe();
  t('le directeur : sa fiche', moi.fiche && moi.fiche.role === 'directeur', moi.fiche ? moi.fiche.nom : 'aucune');
  t('le directeur : son ecole', moi.etablissement && moi.etablissement.code === '55300S07',
    moi.etablissement ? moi.etablissement.nom : 'aucune');
  let msg2 = '';
  try { await win.atRelierMaFiche(); } catch (e) { msg2 = e.message; }
  t('un compte deja relie ne peut pas se relier deux fois', /deja reli/i.test(msg2), msg2.slice(0, 45));
  win.atSeDeconnecter();
  t('apres deconnexion, plus de jeton', (await win.atJeton()) === null);

  // ---------- 4. MODE ECOLE : l'ecran, la connexion, la page du role ----------
  win.passerEnModeEcole();
  t('le mode ecole est actif', win.estModeEcole());
  t('les comptes du telephone sont masques', doc.getElementById('bloc-comptes-test').classList.contains('hidden'));

  win.basculerPanneauEcole();
  const panneau = doc.getElementById('panneau-ecole');
  t('le panneau « installer une nouvelle ecole » s ouvre', !panneau.classList.contains('hidden'));
  t('l academie est proposee', doc.getElementById('ecole-academie').options.length > 5,
    doc.getElementById('ecole-academie').options.length + ' choix');

  doc.getElementById('ecole-code').value = '55300S07';     // un code DEJA installe
  doc.getElementById('ecole-nom').value = 'Ecole en double';
  doc.getElementById('ecole-directeur').value = 'Doublon';
  doc.getElementById('ecole-email').value = 'doublon@exemple.ma';
  doc.getElementById('ecole-mdp').value = 'Doublon.1234';
  await win.installerEcoleDepuisFormulaire();
  await pause(200);
  t('refus clair sur un code deja installe', /deja installee/i.test(doc.getElementById('toast').textContent),
    doc.getElementById('toast').textContent);

  // connexion du directeur par l'ecran (la base verifie le compte)
  doc.getElementById('login-email').value = 'directeur@taalim.ma';
  doc.getElementById('login-password').value = mdp['directeur@taalim.ma'];
  const entre = await win.connexionParLaBase();
  t('le directeur entre dans son application', entre === true);
  t('on arrive sur la page du directeur', pageActive() === 'page-directeur', pageActive());
  t('l ecole est rangee dans les reglages', (win.eval('etablissement.code')) === '55300S07', win.eval('etablissement.code'));
  t('le temoin affiche « serveur »', win.eval('etatTravail()') === 'serveur', win.eval('etatTravail()'));
  t('le temoin est visible dans la barre de titre',
    doc.querySelector('.appbar .badge-etat').classList.contains('badge-serveur'),
    doc.querySelector('.appbar .badge-etat').textContent);
  t('le nom de l ecole est en arabe', String(win.eval('etablissement.nom')).indexOf('الفتح') >= 0, win.eval('etablissement.nom'));

  // ---------- 5. une ecole neuve commence VIDE ----------
  t('aucune donnee de demonstration n a ete fabriquee', win.localStorage.getItem('testHistoGenere_v6') === null,
    String(win.localStorage.getItem('testHistoGenere_v6')));
  t('aucun eleve, aucune absence', win.eval('classes.length') === 0 && win.eval('absences.length') === 0,
    win.eval('classes.length') + ' classe(s) / ' + win.eval('absences.length') + ' absence(s)');

  // ---------- 6. deconnexion puis connexion d'un professeur ----------
  win.deconnexion();
  t('retour a l ecran de connexion', pageActive() === 'page-login', pageActive());
  t('la session du serveur est fermee', (await win.atJeton()) === null);
  // ⚠ Un banc ne doit JAMAIS creer de compte pour une personne reelle : on fabrique une
  //   fiche TEMOIN (adresse en « temoin. ») et c'est ce professeur-la qui se connecte.
  await win.atConnecter('directeur@taalim.ma', mdp['directeur@taalim.ma']);
  const moiDir6 = await win.atQuiSuisJe();
  await fetch(win.eval('AT_BASE') + '/rest/v1/profils', {
    method: 'POST',
    headers: { apikey: 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b',
               Authorization: 'Bearer ' + (await win.atJeton()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ etablissement_id: moiDir6.fiche.etablissement_id, nom: 'Temoin Prof2',
                           role: 'enseignant', matiere: 'math', email: 'temoin.prof2@exemple.ma' })
  });
  win.atSeDeconnecter();
  doc.getElementById('login-email').value = 'temoin.prof2@exemple.ma';
  doc.getElementById('login-password').value = 'Temoin.Prof2.1234';
  await win.connexionParLaBase();
  t('le professeur entre dans son application', pageActive() === 'page-enseignant', pageActive());
  t('sa matiere est reconnue', win.eval('utilisateurConnecte.matiere') === 'math', win.eval('utilisateurConnecte.matiere'));

  // ---------- 7. une personne de la base se connecte depuis un telephone neuf ----------
  // (l'app n'est PAS encore en mode ecole : on efface tout ce qui vient d'etre fait)
  win.localStorage.removeItem('installationServeur');
  win.localStorage.removeItem('utilisateur');
  win.deconnexion();
  t('retour a un telephone neuf (mode ecole desactive)', win.eval('estModeEcole()') === false);
  doc.getElementById('login-email').value = 'directeur@taalim.ma';
  doc.getElementById('login-password').value = mdp['directeur@taalim.ma'];
  win.connexion();                              // passe par le telephone... puis par le serveur
  await pause(2500);
  t('l application s est reliee a l ecole toute seule', win.eval('estModeEcole()') === true);
  t('on arrive sur la page du directeur', pageActive() === 'page-directeur', pageActive());
  t('la session du directeur est ouverte', win.eval('utilisateurConnecte.role') === 'directeur',
    win.eval('utilisateurConnecte ? utilisateurConnecte.nom : "aucun"'));
  t('les comptes du telephone sont maintenant masques',
    doc.getElementById('bloc-comptes-test').classList.contains('hidden'));

  // ---------- 8. PREMIERE CONNEXION d'un professeur (sa fiche existe, son compte pas encore) ----------
  // Le directeur (deja connecte) cree la fiche d'un professeur.
  win.atSeDeconnecter();
  await win.atConnecter('directeur@taalim.ma', mdp['directeur@taalim.ma']);
  const moiDir = await win.atQuiSuisJe();
  const stFiche = await fetch(win.eval('AT_BASE') + '/rest/v1/profils', {
    method: 'POST',
    headers: { apikey: mdp ? 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b' : '',
               Authorization: 'Bearer ' + (await win.atJeton()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ etablissement_id: moiDir.fiche.etablissement_id, nom: 'Temoin App',
                           role: 'enseignant', matiere: 'math', email: 'temoin.app@exemple.ma' })
  });
  t('le directeur cree la fiche d un nouveau professeur', stFiche.status === 201, 'HTTP ' + stFiche.status);
  win.atSeDeconnecter();

  doc.getElementById('login-email').value = 'temoin.app@exemple.ma';
  doc.getElementById('login-password').value = 'Temoin.App.1234';
  const entreProf = await win.connexionParLaBase();
  t('le professeur se connecte POUR LA PREMIERE FOIS', entreProf === true);
  t('son compte est cree et relie a sa fiche', win.eval('utilisateurConnecte.role') === 'enseignant',
    win.eval('utilisateurConnecte ? utilisateurConnecte.nom : "aucun"'));
  t('il arrive sur sa page', pageActive() === 'page-enseignant', pageActive());

  // ---------- 9. LES IDENTIFIANTS (la liste vient de la base, les mots de passe de l'app) ----------
  win.atSeDeconnecter();
  await win.atConnecter('directeur@taalim.ma', mdp['directeur@taalim.ma']);
  const fiches = await win.atFichesPersonnel();
  t('la liste du personnel vient de la base (le directeur en est exclu)',
    fiches.length >= 14 && fiches.every(f => f.role !== 'directeur'), fiches.length + ' fiche(s)');
  t('elle contient les 11 professeurs et les 3 surveillants',
    fiches.filter(f => f.role === 'enseignant').length >= 11 &&
    fiches.filter(f => f.role === 'surveillant').length === 3,
    fiches.filter(f => f.role === 'enseignant').length + ' enseignants / ' +
    fiches.filter(f => f.role === 'surveillant').length + ' surveillants');

  // une fiche dont le compte EXISTE (le professeur temoin de l'etape 6) : l'application
  // ne peut pas relire son mot de passe -> elle l'ecrit honnetement.
  const ficheAvec = fiches.filter(f => f.email === 'temoin.prof2@exemple.ma')[0];
  t('un compte deja cree : l app dit « deja remis » (elle ne peut pas relire un mot de passe)',
    !!ficheAvec && win.motDePassePourFiche(ficheAvec) === 'deja remis',
    ficheAvec ? win.motDePassePourFiche(ficheAvec) : 'fiche temoin absente');

  // une fiche SANS compte : l'application fabrique le mot de passe (lettres + chiffres)
  const stF2 = await fetch(win.eval('AT_BASE') + '/rest/v1/profils', {
    method: 'POST',
    headers: { apikey: 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b',
               Authorization: 'Bearer ' + (await win.atJeton()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ etablissement_id: moiDir.fiche.etablissement_id, nom: 'Temoin Sans Compte',
                           role: 'enseignant', matiere: 'fr', email: 'temoin.sanscompte@exemple.ma' })
  });
  const fiches2 = await win.atFichesPersonnel();
  const ficheSans = fiches2.filter(f => f.email === 'temoin.sanscompte@exemple.ma')[0];
  const mdpNeuf = win.motDePassePourFiche(ficheSans);
  t('une fiche sans compte recoit un mot de passe NEUF', /^[A-Za-z0-9]{6,}$/.test(mdpNeuf) && /[0-9]/.test(mdpNeuf),
    mdpNeuf);
  t('ce mot de passe est retenu par l application (stable)',
    win.motDePassePourFiche(ficheSans) === mdpNeuf);

  // LA FEUILLE COMPLETE : chaque fiche sans compte recoit SON mot de passe (celui qui
  // sera imprime et remis a la personne). On verifie qu'ils sont tous valables et distincts.
  const toutes = await win.atFichesPersonnel();
  const sansCompte = toutes.filter(f => !f.auth_user_id);
  const mots = sansCompte.map(f => win.motDePassePourFiche(f));
  t('chaque fiche sans compte a son mot de passe', mots.length >= 11 && mots.every(m => /^[A-Za-z0-9]{6,}$/.test(m)),
    mots.length + ' mot(s) de passe');
  t('aucun mot de passe en double', new Set(mots).size === mots.length,
    new Set(mots).size + ' distinct(s)');
  t('aucun n est l ancien mot de passe du telephone', mots.every(m => m !== '12345'));

  // ---------- 10. CHANGER SON MOT DE PASSE : c'est le SERVEUR qui verifie l'ancien ----------
  // On le fait sur le professeur temoin (jamais sur une personne reelle).
  doc.getElementById('login-email').value = 'temoin.prof2@exemple.ma';
  doc.getElementById('login-password').value = 'Temoin.Prof2.1234';
  await win.connexionParLaBase();
  doc.getElementById('mdpdir-ancien').value = 'Temoin.Prof2.1234';
  doc.getElementById('mdpdir-nouveau').value = 'TemoinProf2Neuf1';
  doc.getElementById('mdpdir-confirmer').value = 'TemoinProf2Neuf1';
  await win.changerMotDePasseServeur('mdpdir');
  await pause(500);
  t('le changement est accepte (ancien verifie par le serveur)',
    doc.getElementById('mdpdir-success').classList.contains('hidden') === false,
    doc.getElementById('mdpdir-success').textContent);
  win.atSeDeconnecter();
  let nouveauOk = true;
  try { await win.atConnecter('temoin.prof2@exemple.ma', 'TemoinProf2Neuf1'); } catch (e) { nouveauOk = false; }
  t('le NOUVEAU mot de passe fonctionne vraiment', nouveauOk);
  win.atSeDeconnecter();
  // et un mauvais ancien mot de passe est refusé, avec le bon message
  doc.getElementById('mdpdir-ancien').value = 'faux';
  doc.getElementById('mdpdir-nouveau').value = 'AutreChose123';
  doc.getElementById('mdpdir-confirmer').value = 'AutreChose123';
  await win.changerMotDePasseServeur('mdpdir');
  await pause(500);
  t('un mauvais ancien mot de passe est refuse',
    doc.getElementById('mdpdir-error').textContent.indexOf('incorrect') >= 0,
    doc.getElementById('mdpdir-error').textContent);

  t('aucune erreur dans l application', erreurs.length === 0, erreurs.slice(0, 2).join(' ;; '));
  console.log('='.repeat(64));
  console.log(ok ? 'TOUT OK — l application parle a la vraie base.' : 'ECHECS PRESENTS');
  process.exit(ok ? 0 : 1);
}, 900);
