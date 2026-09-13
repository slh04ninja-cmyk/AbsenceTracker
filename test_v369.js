// Test jsdom : v3.69 — liste des séances annulées dès l'ouverture du Dashboard + modale de formulaire unique
// (5 saisies : établissement, fermeture, annulation, absence surveillant, absence enseignant)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const AUJ = '2026-09-12';
const classes = [{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }] }];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', '[]');
    // séance déjà annulée avant l'ouverture (test du bug d'affichage)
    win.localStorage.setItem('seancesAnnulees', JSON.stringify([
      { id: 1, dateISO: AUJ, classe: 'TCSF-1', debut: '08:00', fin: '10:00', motif: 'Examen', par: 'Directeur', le: AUJ + ' 08:00' }
    ]));
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
const s1 = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';})[0])"));
const connecter = (email, mdp) => { doc.getElementById('login-email').value = email; doc.getElementById('login-password').value = mdp; win.connexion(); };
const css = Array.from(doc.querySelectorAll('style')).map(x => x.textContent).join('\n');

setTimeout(() => {
  // ---------- 1. Bug corrigé : la liste s'affiche dès l'ouverture ----------
  connecter(db.email, db.password);
  t('directeur : liste des séances annulées remplie dès la connexion',
    doc.querySelectorAll('#annul-liste > div').length === 1, doc.querySelectorAll('#annul-liste > div').length);
  t('la carte affiche la séance avec sa date', txt('annul-liste').indexOf('12/09/2026') >= 0 && txt('annul-liste').indexOf('08:00–10:00') >= 0);
  win.deconnexion();
  connecter(s1.email, s1.password);
  t('surveillant : idem sur son Dashboard', doc.querySelectorAll('#annul-liste-surv > div').length === 1);
  win.deconnexion();
  connecter(db.email, db.password);
  function txt(id) { return doc.getElementById(id).textContent; }

  // ---------- 2. Modale unique : les 5 formulaires ----------
  const attendus = { etablissement: "Informations de l'établissement", fermeture: 'Ajouter une fermeture', annulation: 'Ajouter une annulation',
                     absenceSurv: 'Déclarer une absence', absenceEns: 'Déclarer une absence' };
  Object.keys(attendus).forEach(cle => {
    win.ouvrirFormulaire(cle);
    const visible = Array.from(doc.querySelectorAll('#form-corps > div')).filter(b => b.style.display !== 'none').map(b => b.id);
    t('formulaire ' + cle + ' : titre + un seul bloc visible',
      !doc.getElementById('modal-form').classList.contains('hidden') && doc.getElementById('form-titre').textContent === attendus[cle] &&
      visible.length === 1 && visible[0] === 'bloc-form-' + cle, doc.getElementById('form-titre').textContent + ' / ' + visible.join(','));
    win.fermerFormulaire();
  });
  t('modale refermée', doc.getElementById('modal-form').classList.contains('hidden'));
  t('2 boutons Fermer / Valider dans la modale',
    doc.querySelectorAll('#modal-form .btn-fermer').length === 1 && doc.querySelectorAll('#modal-form .btn-primary').length === 1);

  // ---------- 3. Chaque carte a son bouton + sa liste ----------
  const carteOk = (idBouton, idListe, cls) => {
    const btn = doc.querySelector('#' + idBouton + ' button');
    const liste = doc.getElementById(idListe);
    return !!btn && !!liste && liste.classList.contains(cls);
  };
  win.switchDirPage('dir-gestion');
  t('carte Fermeture : bouton + liste .js-fermetures', carteOk('fermeture-card', 'ferm-liste', 'js-fermetures'));
  t('carte Annulation : bouton + liste .js-annulations', carteOk('annulations-card', 'annulations-liste', 'js-annulations'));
  t('carte Établissement : bouton (plus de champs sur la carte)',
    !!doc.querySelector('#etab-card button') && doc.querySelector('#etab-card input') === null);
  win.switchProfil();
  t('RH surveillants : bouton + liste .js-absences-personnel', carteOk('surv-card', 'abs-surv-liste', 'js-absences-personnel'));
  t('RH enseignants : bouton + liste .js-absences-personnel', carteOk('ens-card', 'indispo-liste', 'js-absences-personnel'));

  // ---------- 4. Saisie par le popup : fermeture ----------
  win.switchDirPage('dir-gestion');
  win.ouvrirFormulaire('fermeture');
  doc.getElementById('ferm-type').value = 'Vacances';
  doc.getElementById('ferm-libelle').value = 'Aïd Al Adha';
  doc.getElementById('ferm-debut').value = '2026-10-05';
  doc.getElementById('ferm-fin').value = '2026-10-09';
  win.validerFormulaire();
  t('fermeture validée depuis le popup (persistée + modale fermée)',
    JSON.parse(win.localStorage.getItem('fermeturesEtab')).length === 1 && doc.getElementById('modal-form').classList.contains('hidden'));
  t('liste des fermetures mise à jour', doc.querySelectorAll('#ferm-liste > div').length === 1);
  // erreur : rien n'est enregistré -> la modale reste ouverte
  win.ouvrirFormulaire('fermeture');
  doc.getElementById('ferm-debut').value = '';
  win.validerFormulaire();
  t('saisie incomplète : modale laissée ouverte', !doc.getElementById('modal-form').classList.contains('hidden'), txt('toast'));
  win.fermerFormulaire();

  // ---------- 5. Saisie par le popup : annulation ----------
  win.ouvrirFormulaire('annulation');
  t('popup annulation : date préremplie + classes listées',
    // on compare à la date calculée par l'application ELLE-MÊME, au moment de la
    // vérification : sinon un passage à minuit fait échouer le test sans raison
    doc.getElementById('annul-date').value === win.jourCourant() && doc.getElementById('annul-classe').options.length >= 1,
    doc.getElementById('annul-date').value + ' / ' + doc.getElementById('annul-classe').options.length);
  doc.getElementById('annul-date').value = '2026-09-14';      // lundi (le samedi est refusé)
  win.majCreneauxAnnulation();
  doc.getElementById('annul-classe').value = 'TCSF-1';
  win.majCreneauxAnnulation();
  const opt = doc.getElementById('annul-creneau').options;
  doc.getElementById('annul-creneau').value = opt[opt.length - 1].value;
  doc.getElementById('annul-motif').value = 'Réunion';
  win.validerFormulaire();
  t('annulation enregistrée depuis le popup',
    JSON.parse(win.localStorage.getItem('seancesAnnulees')).length === 2 && doc.getElementById('modal-form').classList.contains('hidden'));
  t('liste "Annulations enregistrées" mise à jour (Gestion)', doc.querySelectorAll('#annulations-liste > div').length === 2,
    doc.querySelectorAll('#annulations-liste > div').length);
  t('et sur le Dashboard', doc.querySelectorAll('#annul-liste > div').length === 2);

  // ---------- 6. Saisie par le popup : absence d'un surveillant ----------
  win.switchProfil();
  win.basculerSegments('seg-surveillants', 'seg-surv-absence');
  win.ouvrirFormulaire('absenceSurv');
  t('popup absence surveillant : comptes listés', doc.getElementById('abs-surv-compte').options.length === 2,
    doc.getElementById('abs-surv-compte').options.length);
  doc.getElementById('abs-surv-compte').value = 's1@taalim.ma';
  doc.getElementById('abs-surv-debut').value = '2026-09-15';
  doc.getElementById('abs-surv-fin').value = '2026-09-16';
  doc.getElementById('abs-surv-motif').value = 'Maladie';
  win.validerFormulaire();
  t('absence du surveillant enregistrée', JSON.parse(win.localStorage.getItem('indispoProfs')).length === 1 &&
    doc.getElementById('modal-form').classList.contains('hidden'));
  t('liste des absences du surveillant mise à jour', doc.querySelectorAll('#abs-surv-liste > div').length === 1);

  // ---------- 7. Listes : défilement (4 cartes / 6 cartes) ----------
  t('toutes les listes de cartes : 4 cartes avant défilement (absences du personnel comprises)',
    css.indexOf('.js-seances-annulees, .js-absences-personnel, .js-fermetures, .js-annulations, .js-personnel {') > 0 &&
    css.indexOf('max-height: 190px; overflow-y: auto') > 0 &&
    css.indexOf('286px') < 0);

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
