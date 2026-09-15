// Test jsdom : v3.94 — lisibilite des cartes de liste en mode CLAIR et SOMBRE,
// et confirmation obligatoire avant de retablir une seance annulee.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const FIXE = new Date('2026-09-12T10:00:00').getTime();   // samedi 12/09/2026
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push(String(e.message || e).slice(0, 120)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    const V = win.Date;
    win.Date = class extends V { constructor(...a) { super(...(a.length ? a : [FIXE])); } static now() { return FIXE; } };
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

// ---------- lisibilite : contraste texte / fond (formule WCAG, 4.5 = minimum) ----------
const nombre = s => (String(s).match(/[\d.]+/g) || []).map(Number);
// une couleur peut etre ecrite var(--primary) : on la remplace par sa valeur reelle
const resoudreVar = s => String(s).replace(/var\((--[-\w]+)\)/g, function (m, v) {
  const val = (win.getComputedStyle(doc.documentElement).getPropertyValue(v) || '').trim();
  return val || m;
});
const couche = s => { const n = nombre(resoudreVar(s)); return { r: n[0] || 0, g: n[1] || 0, b: n[2] || 0, a: n[3] === undefined ? 1 : n[3] }; };
const melange = (dessus, dessous) => [0, 1, 2].map(i => [dessus.r, dessus.g, dessus.b][i] * dessus.a + dessous[i] * (1 - dessus.a));
const lum = c => c.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
  .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contraste = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
// fond reellement derriere un element : on empile tous ses fonds jusqu'a la page
function fondEffectif(el) {
  const couches = [];
  let p = el;
  while (p && p.nodeType === 1) {
    const s = win.getComputedStyle(p).backgroundColor;
    if (s && s !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(s)) couches.push(couche(s));
    p = p.parentElement;
  }
  let fond = [255, 255, 255];
  for (let i = couches.length - 1; i >= 0; i--) fond = melange(couches[i], fond);
  return fond;
}
function contrasteDe(el) {
  const tex = couche(win.getComputedStyle(el).color);
  return contraste(melange(tex, fondEffectif(el)), fondEffectif(el));
}
const creerAnnulation = (date, classe) => {
  win.switchDirPage('dir-gestion');
  win.basculerSegments('seg-fermeture', 'seg-ferm-seance');
  win.preparerFormulaireAnnulation();
  doc.getElementById('annul-date').value = date;
  doc.getElementById('annul-classe').value = classe;
  win.majCreneauxAnnulation();
  doc.getElementById('annul-creneau').value = doc.getElementById('annul-creneau').options[0].value;
  doc.getElementById('annul-motif').value = 'Reunion';
  win.confirmerAnnulationSeance();
};
const nbAnnulations = () => JSON.parse(win.localStorage.getItem('seancesAnnulees') || '[]').length;
const modaleOuverte = () => !doc.getElementById('modal-confirmation').classList.contains('hidden');
const MINIMUM = 4.5;

setTimeout(() => {
  const dir = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = dir.email;
  doc.getElementById('login-password').value = dir.password;
  win.connexion();
  t('connexion directeur', win.eval('utilisateurConnecte.role') === 'directeur', win.eval('utilisateurConnecte.role'));

  // une fermeture (corbeille rouge), une annulation (bouton « Rétablir »), la liste RH (« Modifier »)
  doc.getElementById('ferm-debut').value = '2026-09-20';
  win.enregistrerFermeture();
  creerAnnulation('2026-09-15', 'TCSF-1');
  win.switchProfil(); win.afficherListeProfs();
  win.switchDirPage('dir-gestion'); win.basculerSegments('seg-fermeture', 'seg-ferm-seance');
  win.afficherAnnulationsEnregistrees();
  win.afficherFermetures();

  const bouton = sel => doc.querySelector(sel);
  const complet = sel => { const b = bouton(sel) || doc.createElement('span'); const s = doc.createElement('span'); s.className = 'carte-ligne-titre'; s.textContent = 'x'; return b; };
  const vides = [];
  const modif = doc.querySelector('#dir-profs-list .btn-inline');
  const retab = doc.querySelector('#annulations-liste .btn-inline');
  const corbeille = doc.querySelector('#ferm-liste .btn-inline');
  t('la liste RH expose « Modifier »', !!modif && modif.textContent.indexOf('Modifier') >= 0, modif ? modif.textContent : 'aucun');
  t('la liste des annulations expose « Rétablir »', !!retab && retab.textContent.indexOf('Rétablir') >= 0, retab ? retab.textContent : 'aucun');
  t('la liste des fermetures expose la corbeille', !!corbeille && corbeille.querySelector('.fa-trash') !== null);

  // ---------- 1. MODE CLAIR : les 3 boutons sont lisibles ----------
  const clair = { modif: contrasteDe(modif), retab: contrasteDe(retab), corbeille: contrasteDe(corbeille) };
  t('clair : « Modifier » lisible', clair.modif >= MINIMUM, clair.modif.toFixed(2));
  t('clair : « Rétablir » lisible', clair.retab >= MINIMUM, clair.retab.toFixed(2));
  t('clair : corbeille lisible', clair.corbeille >= MINIMUM, clair.corbeille.toFixed(2));
  const teinteClaire = { modif: resoudreVar(win.getComputedStyle(modif).color), retab: resoudreVar(win.getComputedStyle(retab).color) };

  // ---------- 2. MODE SOMBRE : les memes boutons restent lisibles ----------
  win.basculerTheme();
  t('le mode sombre est actif', doc.body.classList.contains('theme-sombre'));
  const modifS = doc.querySelector('#dir-profs-list .btn-inline');
  const retabS = doc.querySelector('#annulations-liste .btn-inline');
  const corbS = doc.querySelector('#ferm-liste .btn-inline');
  const sombre = { modif: contrasteDe(modifS), retab: contrasteDe(retabS), corbeille: contrasteDe(corbS) };
  t('sombre : « Modifier » lisible (defaut signale)', sombre.modif >= MINIMUM, sombre.modif.toFixed(2));
  t('sombre : « Rétablir » lisible (defaut signale)', sombre.retab >= MINIMUM, sombre.retab.toFixed(2));
  t('sombre : corbeille lisible', sombre.corbeille >= MINIMUM, sombre.corbeille.toFixed(2));
  const teinteSombre = { modif: resoudreVar(win.getComputedStyle(modifS).color), retab: resoudreVar(win.getComputedStyle(retabS).color) };
  t('la teinte des boutons suit bien le theme',
    teinteClaire.modif !== teinteSombre.modif && teinteClaire.retab !== teinteSombre.retab,
    'clair ' + teinteClaire.retab + ' / sombre ' + teinteSombre.retab);

  // ---------- 3. Plus de pastille « Absence prof » (retiree : invisible en clair) ----------
  win.switchProfil();
  win.basculerSegments('seg-enseignants', 'seg-ens-absence');
  doc.getElementById('indispo-prof').value = 'fr-prof1';
  doc.getElementById('indispo-debut').value = '2026-09-15';
  doc.getElementById('indispo-fin').value = '2026-09-18';
  doc.getElementById('indispo-portee').value = 'journee';
  doc.getElementById('indispo-motif').value = 'Maladie';
  win.enregistrerIndispo();
  win.switchDirPage('directeur');
  t('plus aucune pastille « Absence prof » en sombre',
    Array.from(doc.querySelectorAll('#annul-liste .tag-avenir')).every(x => x.textContent !== 'Absence prof'));
  t('la séance reste reconnaissable (sous-titre « Absence de »)',
    doc.getElementById('annul-liste').textContent.indexOf('Absence de ') >= 0);
  win.basculerTheme();   // retour au clair
  t('plus aucune pastille « Absence prof » en clair',
    Array.from(doc.querySelectorAll('#annul-liste .tag-avenir')).every(x => x.textContent !== 'Absence prof'));
  const pastilleClaire = doc.querySelector('#annul-liste .tag-avenir');   // « À venir », elle reste
  if (pastilleClaire) t('clair : la pastille « À venir » reste lisible', contrasteDe(pastilleClaire) >= MINIMUM, contrasteDe(pastilleClaire).toFixed(2));

  // ---------- 4. « Rétablir » : confirmation obligatoire ----------
  const avant = nbAnnulations();
  t('annulation enregistree', avant === 1, avant);
  const boutonDash = doc.querySelector('#annul-liste .btn-inline');
  t('le Dashboard du directeur propose « Rétablir »', !!boutonDash && boutonDash.textContent.indexOf('Rétablir') >= 0);
  boutonDash.onclick();
  t('Dashboard directeur : confirmation demandee', modaleOuverte() && doc.getElementById('message-confirmation').textContent.indexOf('Rétablir la séance') === 0,
    doc.getElementById('message-confirmation').textContent);
  t('rien n est modifie avant validation', nbAnnulations() === avant);
  win.validerConfirmation();
  t('apres validation la seance est retablie', nbAnnulations() === avant - 1, nbAnnulations());

  // Gestion (Annulation de seances)
  creerAnnulation('2026-09-16', 'TCSF-2');
  win.switchDirPage('dir-gestion'); win.basculerSegments('seg-fermeture', 'seg-ferm-seance');
  win.afficherAnnulationsEnregistrees(); win.afficherSeancesAnnulees();
  const bGestion = doc.querySelector('#annulations-liste .btn-inline');
  const avantG = nbAnnulations();
  bGestion.onclick();
  t('Gestion : confirmation demandee', modaleOuverte() && nbAnnulations() === avantG, doc.getElementById('message-confirmation').textContent);
  win.annulerConfirmation();
  t('confirmation refusee : annulation conservee', nbAnnulations() === avantG);

  // Dashboard du surveillant
  const surv = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';})[0])"));
  if (typeof win.deconnexion === 'function') win.deconnexion();
  if (doc.getElementById('login-email')) { doc.getElementById('login-email').value = surv.email; doc.getElementById('login-password').value = surv.password; win.connexion(); }
  t('connexion surveillant', win.eval('utilisateurConnecte.role') === 'surveillant', win.eval('utilisateurConnecte.role'));
  win.afficherSeancesAnnulees();
  const bSurv = doc.querySelector('#annul-liste-surv .btn-inline');
  t('le Dashboard du surveillant propose « Rétablir »', !!bSurv && bSurv.textContent.indexOf('Rétablir') >= 0);
  const avantS = nbAnnulations();
  bSurv.onclick();
  t('Dashboard surveillant : confirmation demandee', modaleOuverte() && nbAnnulations() === avantS,
    doc.getElementById('message-confirmation').textContent);
  win.validerConfirmation();
  t('apres validation la seance est retablie (surveillant)', nbAnnulations() === avantS - 1, nbAnnulations());

  t('aucune erreur pendant le test', erreurs.length === 0, erreurs.slice(0, 2).join(' ;; '));
  console.log(ok ? 'TOUT OK' : 'ECHECS PRESENTS');
  process.exit(ok ? 0 : 1);
}, 900);
