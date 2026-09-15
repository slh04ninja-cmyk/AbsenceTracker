// test_v383.js — notifications : elles descendent du haut, la couleur dit la NATURE
//  - 6 tons : succès (vert), modification (bleu), suppression (rouge), avertissement
//    (orange), information (ardoise), erreur (rouge profond), chacun avec son icône
//  - mouvement demandé par l'utilisateur : translate(-50%, -160%) -> translate(-50%, 0),
//    0.55s cubic-bezier(.18,1.25,.4,1) + opacité, classe .show retirée après ~2.2 s
//  - ancrée SOUS la barre de titre (top = appbar + 10px), plus en bas
//  - deux notifications coup sur coup : la 2e n'est plus coupée par la minuterie de la 1re
//  - les actions réelles de l'app envoient le bon ton
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [{ id: 1, nom: 'TCSF-1', eleves: [
  { id: 1, massar: 'M001', nom: 'El Amrani', prenom: 'Ahmed' },
  { id: 2, massar: 'M002', nom: 'Berrada', prenom: 'Imane' }
]}];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', '[]');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const toast = () => doc.getElementById('toast');
const tonDe = () => Array.from(toast().classList).filter(c => c.indexOf('ton-') === 0)[0];
const icone = () => { const i = toast().querySelector('i'); return i ? i.className.replace('fas ', '') : ''; };

setTimeout(async () => {
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();

  // ---------- 0. etat de repos : au-dessus de l ecran, invisible ----------
  const repos = win.getComputedStyle(toast());
  t('au repos : elle est au-dessus de l ecran (-160%)', repos.transform.indexOf('-160%') >= 0, repos.transform);
  t('au repos : invisible (opacite 0)', repos.opacity === '0', repos.opacity);

  // ---------- 1. chaque nature d'action a son ton et son icone ----------
  [['success', 'ton-succes', 'fa-check-circle'],
   ['modif', 'ton-modif', 'fa-edit'],
   ['suppression', 'ton-suppr', 'fa-trash'],
   ['warning', 'ton-avert', 'fa-exclamation-triangle'],
   ['info', 'ton-info', 'fa-info-circle'],
   ['error', 'ton-erreur', 'fa-times-circle']].forEach(([type, ton, ic]) => {
    win.afficherToast('Message ' + type, type);
    t('nature « ' + type + ' » : ton ' + ton, tonDe() === ton, tonDe());
    t('nature « ' + type + ' » : icone ' + ic, icone() === ic, icone());
    t('nature « ' + type + ' » : texte intact', toast().textContent === 'Message ' + type, toast().textContent);
  });
  win.afficherToast('Type inconnu', 'nimportequoi');
  t('type inconnu : ton information par defaut', tonDe() === 'ton-info', tonDe());

  // ---------- 2. position : ancree sous la barre de titre ----------
  const cs = win.getComputedStyle(toast());
  t('la notification est fixe (position: fixed)', cs.position === 'fixed', cs.position);
  t('elle part du HAUT (top = barre de titre + 10px)', cs.top.indexOf('appbar-h') > 0, cs.top);
  t('« bottom » n est plus utilise', !cs.bottom || cs.bottom === 'auto', cs.bottom);
  t('elle passe au-dessus des cartes (z-index)', cs.zIndex === '1200', cs.zIndex);
  t('elle n intercepte pas les clics', cs.pointerEvents === 'none', cs.pointerEvents);
  t('courbe de mouvement demandee (0.55s + rebond)',
    cs.transition.indexOf('0.55s') >= 0 && cs.transition.indexOf('cubic-bezier(0.18, 1.25, 0.4, 1)') >= 0,
    cs.transition);

  // ---------- 3. entree / disparition ----------
  // duree d'affichage : on intercepte la minuterie pour la mesurer exactement
  const delais = [];
  const vraiSetTimeout = win.setTimeout;
  win.setTimeout = function (fn, ms) { delais.push(ms); return vraiSetTimeout(fn, ms); };
  win.afficherToast('Bonjour', 'success');
  win.setTimeout = vraiSetTimeout;
  t('la notification reste 3,2 s (1 s de plus qu avant)', delais.indexOf(3200) >= 0, delais.join(', ') + ' ms');
  t('a l affichage : classe « show »', toast().classList.contains('show'));
  t('a l affichage : plus de « hidden »', !toast().classList.contains('hidden'));
  t('a l affichage : la classe d entree gagne (translate 0)',
    win.getComputedStyle(toast()).transform.indexOf('-160%') < 0, win.getComputedStyle(toast()).transform);
  await attendre(3300);
  t('apres ~3.2 s : la classe « show » est retiree (elle remonte)',
    !toast().classList.contains('show'), toast().className);
  t('elle est revenue au-dessus de l ecran',
    win.getComputedStyle(toast()).transform.indexOf('-160%') >= 0, win.getComputedStyle(toast()).transform);
  await attendre(700);
  t('apres l animation : « hidden »', toast().classList.contains('hidden'), toast().className);
  t('le contenu reste lisible dans le DOM', toast().textContent === 'Bonjour', toast().textContent);

  // ---------- 4. deux notifications coup sur coup ----------
  win.afficherToast('Premier', 'success');
  await attendre(200);
  win.afficherToast('Second', 'error');
  await attendre(400);
  t('la 2e notification reste visible (minuterie de la 1re annulee)',
    toast().classList.contains('show') && !toast().classList.contains('hidden'), toast().className);
  t('la 2e notification a remplace le texte', toast().textContent === 'Second', toast().textContent);
  t('la 2e notification a le ton de la 2e action', tonDe() === 'ton-erreur', tonDe());

  // ---------- 5. les vraies actions envoient le bon ton ----------
  const clId = JSON.parse(win.eval("classes[0].id"));
  win.supprimerEleve(clId, 2);
  t('supprimer un eleve -> ton suppression (rouge)', tonDe() === 'ton-suppr', tonDe());
  t('message « Eleve supprimé »', toast().textContent === 'Eleve supprimé', toast().textContent);

  win.marquerEleveSorti(clId, 1, true);
  t('marquer un eleve sorti -> ton modification (bleu)', tonDe() === 'ton-modif', tonDe());
  win.marquerEleveSorti(clId, 1, false);
  t('retablir un eleve -> ton modification (bleu)', tonDe() === 'ton-modif', tonDe());

  win.ouvrirFicheEleveParNom('Personne Inconnue', 'TCSF-1');
  t('eleve introuvable -> ton erreur (rouge profond)', tonDe() === 'ton-erreur', tonDe());
  t('message « Élève introuvable »', toast().textContent === 'Élève introuvable', toast().textContent);
  win.ouvrirFicheEleveParNom('El Amrani Ahmed', 'CLASSE INEXISTANTE');
  t('classe inconnue -> ton erreur aussi', tonDe() === 'ton-erreur', tonDe());

  // import MASSAR : creation -> vert
  win.XLSX = { read: function () { return { SheetNames: ['f'], Sheets: { f: {} } }; } };
  win.analyserFeuilleMASSAR = function () {
    return { nom: 'TCSF-1', eleves: [{ id: 900, massar: 'M001', nom: 'El Amrani', prenom: 'Ahmed' },
                                    { id: 901, massar: 'M009', nom: 'Nouveau', prenom: 'Eleve' }] };
  };
  win.importerMassar({ files: [new win.File([new Uint8Array([1])], 'massar.xlsx')], value: '' });
  await attendre(200);
  win.confirmerImport();
  t('import qui ajoute un eleve -> ton succes (vert)', tonDe() === 'ton-succes', tonDe() + ' / ' + toast().textContent);

  // import MASSAR : rien de nouveau -> information (ardoise)
  win.analyserFeuilleMASSAR = function () {
    return { nom: 'TCSF-1', eleves: [{ id: 902, massar: 'M001', nom: 'El Amrani', prenom: 'Ahmed' },
                                    { id: 903, massar: 'M009', nom: 'Nouveau', prenom: 'Eleve' }] };
  };
  win.importerMassar({ files: [new win.File([new Uint8Array([2])], 'massar2.xlsx')], value: '' });
  await attendre(200);
  win.confirmerImport();
  t('reimport sans changement -> ton information (ardoise)', tonDe() === 'ton-info', tonDe() + ' / ' + toast().textContent);

  win.verifierDoublonsEleves();
  t('aucun doublon trouve -> ton information', tonDe() === 'ton-info', tonDe());

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 900);
