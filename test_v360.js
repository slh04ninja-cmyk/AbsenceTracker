// Test jsdom : v3.60 — fermetures de l'établissement, indisponibilités des profs,
// dates encadrées, libellé avec la date, « À venir », prochain cours annulé
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const FIXE = new Date('2026-09-11T10:00:00').getTime();   // vendredi 11/09/2026 10:00
const AUJ = '2026-09-11';
const classes = [
  { id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] },
  { id: 2, nom: 'TCSF-2', eleves: [{ id: 3, nom: 'Alami', prenom: 'Youssef' }, { id: 4, nom: 'Tazi', prenom: 'Salma' }] },
  { id: 3, nom: 'TCSF-3', eleves: [{ id: 5, nom: 'Naciri', prenom: 'Omar' }, { id: 6, nom: 'Fikri', prenom: 'Aya' }] }
];
const absences = [
  // eleve 3 (TCSF-2) : retard de l'apres-midi du vendredi 11/09 -> dans la fermeture "Reunion"
  { id: 1, eleveId: 3, nom: 'Alami Youssef', classe: 'TCSF-2', dateISO: AUJ, date: '11/09/2026',
    seance: 'apres-midi', heure: '16:10', type: 'retard', duree: '15 min', statut: 'absent',
    enseignant: 'أيوب الكمرة', profCode: 'math-prof1', matiere: 'Maths', test: true },
  // eleve 1 (TCSF-1) : absence du matin, hors fermeture
  { id: 2, eleveId: 1, nom: 'El Amrani Ahmed', classe: 'TCSF-1', dateISO: AUJ, date: '11/09/2026',
    seance: 'matin', heure: '08:30', type: 'absence', statut: 'absent',
    enseignant: 'سامية الحاضي', profCode: 'fr-prof1', matiere: 'Français', test: true }
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    const V = win.Date;
    win.Date = class extends V { constructor(...a) { super(...(a.length ? a : [FIXE])); } static now() { return FIXE; } };
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', JSON.stringify(absences));
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const compteMail = m => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='" + m + "';})[0])"));
const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };
const raison = (d, cl, h) => JSON.parse(win.eval("JSON.stringify(raisonAnnulation('" + d + "','" + cl + "','" + h + "'))"));
const txt = id => doc.getElementById(id).textContent;
const nbAnnul = () => JSON.parse(win.localStorage.getItem('seancesAnnulees') || '[]').length;

setTimeout(() => {
  connecter(compteMail('d@taalim.ma'));
  win.switchDirPage('dir-gestion');

  // ══════════ 1. Fermeture de l'établissement (vacances) ══════════
  t('carte fermeture présente', !!doc.getElementById('ferm-liste') && !!doc.getElementById('ferm-type'));
  doc.getElementById('ferm-type').value = 'Vacances';
  doc.getElementById('ferm-libelle').value = 'Aïd Al Adha';
  doc.getElementById('ferm-debut').value = '2026-10-05';
  doc.getElementById('ferm-fin').value = '2026-10-09';
  doc.getElementById('ferm-portee').value = 'journee';
  win.enregistrerFermeture();
  const ferm = JSON.parse(win.localStorage.getItem('fermeturesEtab'));
  t('fermeture persistée (type, libellé, période, portée)',
    ferm.length === 1 && ferm[0].libelle === 'Aïd Al Adha' && ferm[0].debut === '2026-10-05' && ferm[0].fin === '2026-10-09' &&
    ferm[0].portee === 'journee' && ferm[0].par === 'Directeur', JSON.stringify(ferm[0]));
  t('liste des fermetures affichée', txt('ferm-liste').indexOf('Aïd Al Adha') >= 0 && txt('ferm-liste').indexOf('05/10/2026') >= 0,
    txt('ferm-liste').slice(0, 60));
  const r1 = raison('2026-10-07', 'TCSF-1', '08:00');
  t('pendant les vacances : séance annulée (source fermeture)', r1 && r1.source === 'fermeture' && r1.motif === 'Aïd Al Adha', JSON.stringify(r1));
  t('hors période : la séance a lieu', raison('2026-10-12', 'TCSF-1', '08:00') === null);

  // portée matin / après-midi
  doc.getElementById('ferm-type').value = 'Réunion';
  doc.getElementById('ferm-libelle').value = 'Conseil de classe';
  doc.getElementById('ferm-debut').value = '2026-11-02';
  doc.getElementById('ferm-fin').value = '2026-11-02';
  doc.getElementById('ferm-portee').value = 'matin';
  win.enregistrerFermeture();
  t('portée matin : 09:00 annulé', (raison('2026-11-02', 'TCSF-1', '09:00') || {}).source === 'fermeture');
  t('portée matin : 15:00 non annulé', raison('2026-11-02', 'TCSF-1', '15:00') === null);

  // garde-fous
  doc.getElementById('ferm-debut').value = '2025-01-05';
  doc.getElementById('ferm-fin').value = '2025-01-06';
  const avant = JSON.parse(win.localStorage.getItem('fermeturesEtab')).length;
  win.enregistrerFermeture();
  t('fermeture hors année scolaire refusée', JSON.parse(win.localStorage.getItem('fermeturesEtab')).length === avant,
    txt('toast'));
  doc.getElementById('ferm-debut').value = '2026-12-10';
  doc.getElementById('ferm-fin').value = '2026-12-01';
  win.enregistrerFermeture();
  t('fin avant début refusée', JSON.parse(win.localStorage.getItem('fermeturesEtab')).length === avant, txt('toast'));

  // ══════════ 2. Indisponibilité d'un enseignant (rubrique RH de la page Profil) ══════════
  win.switchProfil();   // v3.61 : la carte RH a demenage de Gestion vers Profil/RH
  t('rubrique RH visible pour le directeur', doc.getElementById('profil-rh').style.display === 'block',
    doc.getElementById('profil-rh').style.display);
  t('liste des enseignants dans la carte', doc.getElementById('indispo-prof').options.length === 11,
    doc.getElementById('indispo-prof').options.length);
  doc.getElementById('indispo-prof').value = 'fr-prof1';
  doc.getElementById('indispo-debut').value = '2026-09-15';
  doc.getElementById('indispo-fin').value = '2026-09-18';
  doc.getElementById('indispo-portee').value = 'journee';
  doc.getElementById('indispo-motif').value = 'Maladie';
  win.enregistrerIndispo();
  const ind = JSON.parse(win.localStorage.getItem('indispoProfs'));
  t('indisponibilité persistée (prof + période + motif)',
    ind.length === 1 && ind[0].profCode === 'fr-prof1' && ind[0].debut === '2026-09-15' && ind[0].fin === '2026-09-18' &&
    ind[0].motif === 'Maladie', JSON.stringify(ind[0]));
  // v3.63 : la liste vit dans la carte RH "Annuler des séances" (plus de carte Indisponibilité separee)
  win.afficherSeancesAnnulees();
  // v3.66 : la carte du Dashboard n'affiche QUE les séances annulées (pas les absences des profs)
  // v3.68 : l'absence du prof genere ses propres séances annulées (2e source)
  t('les séances de l absence du prof apparaissent (2e source)',
    txt('annul-liste').indexOf('Absence prof') >= 0 && txt('annul-liste').indexOf('Absence de سامية الحاضي') >= 0 &&
    txt('annul-liste').indexOf('Maladie') >= 0, txt('annul-liste').slice(0, 90));
  t('l absence du prof est bien dans la liste déroulante RH',
    txt('indispo-liste').indexOf('Maladie') >= 0 && txt('indispo-liste').indexOf('سامية الحاضي') >= 0,
    txt('indispo-liste').slice(0, 70));
  const r2 = raison('2026-09-15', 'TCSF-1', '10:30');   // mardi 10:00-12:00 = Français / fr-prof1
  t('séance du prof indisponible annulée', r2 && r2.source === 'indispo' && r2.motif === 'Maladie', JSON.stringify(r2));
  t('autre matière à la même heure : non annulée', raison('2026-09-15', 'TCSF-1', '08:30') === null);
  // multi-jours : le vendredi 18/09 (dernier jour de la période) TCSF-1 a Français (08:00-10:00) -> annulé
  const r3 = raison('2026-09-18', 'TCSF-1', '08:30');
  t('dernier jour de la période : séance du prof annulée', r3 && r3.source === 'indispo', JSON.stringify(r3));
  t('hors période (lundi 21/09) : non annulée', raison('2026-09-21', 'TCSF-1', '08:30') === null);

  // ══════════ 3. Annulation d'une séance : les 2 modes + dates encadrées ══════════
  // v3.65 : l'annulation d'une séance est dans la carte Fermeture de l'établissement (page Gestion)
  // v3.69 : les 2 cartes Gestion (Fermeture / Annulation) ouvrent une seule modale de formulaire
  win.switchDirPage('dir-gestion');
  t('carte Fermeture avec bouton d ajout', !!doc.querySelector('#fermeture-card button') && !!doc.getElementById('ferm-liste'));
  t('carte Annulation de séances avec bouton + liste',
    !!doc.querySelector('#annulations-liste') && !!doc.querySelector('#annulations-card button'));
  win.ouvrirFormulaire('annulation');
  t('popup Annulation : titre + champs presents',
    !doc.getElementById('modal-form').classList.contains('hidden') && doc.getElementById('form-titre').textContent === 'Ajouter une annulation' &&
    !!doc.getElementById('annul-date') && !!doc.getElementById('annul-classe') && !!doc.getElementById('annul-creneau') && !!doc.getElementById('annul-motif'),
    doc.getElementById('form-titre').textContent);
  t('plus de modale d annulation historique', doc.getElementById('modal-annulation') === null);
  t('dates bornées par l année scolaire', doc.getElementById('annul-date').min === '2026-09-01' && doc.getElementById('annul-date').max === '2027-05-15',
    doc.getElementById('annul-date').min + ' → ' + doc.getElementById('annul-date').max);
  // week-end refusé
  doc.getElementById('annul-date').value = '2026-09-12';   // samedi
  doc.getElementById('annul-classe').value = 'TCSF-1';
  win.majCreneauxAnnulation();
  const nbAvant = nbAnnul();
  win.confirmerAnnulationSeance();
  t('annulation le samedi refusée', nbAnnul() === nbAvant, txt('toast'));
  // hors année refusée
  doc.getElementById('annul-date').value = '2027-06-01';
  win.confirmerAnnulationSeance();
  t('annulation hors année refusée', nbAnnul() === nbAvant, txt('toast'));
  // annulation future acceptée (lundi 14/09) -> pastille "À venir"
  doc.getElementById('annul-date').value = '2026-09-14';
  win.majCreneauxAnnulation();
  doc.getElementById('annul-creneau').value = '08:00|10:00';
  win.confirmerAnnulationSeance();
  t('annulation future acceptée', nbAnnul() === 1, nbAnnul());
  win.afficherSeancesAnnulees();
  t('titre de la carte = Séances annulées',
    doc.querySelector('#seances-annulees-card h3').textContent.indexOf('Séances annulées') >= 0);
  t('pastille « À venir » sur une annulation future', txt('annul-liste').indexOf('À venir') >= 0, txt('annul-liste').slice(0, 70));
  // séance passée : pas de pastille "À venir", et la date figure sur la carte
  win.eval("seancesAnnulees = [{ id: 'p1', dateISO: '2026-09-10', classe: 'TCSF-1', debut: '08:00', fin: '10:00', motif: 'Examen', par: 'Directeur', le: '2026-09-10 08:00' }]; sauvegarderSeancesAnnulees(); afficherSeancesAnnulees()");
  const lignePassee = Array.from(doc.querySelectorAll('#annul-liste > div')).map(x => x.textContent).find(x => x.indexOf('10/09/2026') >= 0) || '';
  t('séance passée : date affichée et pas de pastille "À venir" sur sa ligne',
    lignePassee.indexOf('10/09/2026') >= 0 && lignePassee.indexOf('À venir') < 0, lignePassee);

  // ══════════ 4. Fermeture du jour : règles listées + stats + prochain cours ══════════
  doc.getElementById('ferm-type').value = 'Réunion';
  doc.getElementById('ferm-libelle').value = 'Conseil pédagogique';
  doc.getElementById('ferm-debut').value = AUJ;
  doc.getElementById('ferm-fin').value = AUJ;
  doc.getElementById('ferm-portee').value = 'apres-midi';
  win.enregistrerFermeture();
  t('fermeture du jour en après-midi enregistrée',
    JSON.parse(win.localStorage.getItem('fermeturesEtab')).some(f => f.debut === AUJ && f.portee === 'apres-midi'));
  win.eval("seancesAnnulees = []; sauvegarderSeancesAnnulees()");
  win.afficherSeancesAnnulees();
  t('une fermeture ne figure pas dans la liste des séances annulées',
    txt('annul-liste').indexOf('Conseil pédagogique') < 0 && txt('annul-liste').indexOf('Fermeture') < 0,
    txt('annul-liste').slice(0, 80));
  const filtres = JSON.parse(win.eval("JSON.stringify(statsDirFiltre().map(function(a){return a.id;}))"));
  t('absence de l après-midi exclue des stats', filtres.indexOf(1) < 0, filtres.join(','));
  t('absence du matin conservée', filtres.indexOf(2) >= 0, filtres.join(','));
  // la réunion n'a plus cours : suppression (nettoyage) puis test du prochain cours
  win.eval("fermeturesEtab = fermeturesEtab.filter(function(f){return f.debut !== '" + AUJ + "';}); sauvegarderFermetures()");

  // prochain cours annulé côté enseignant
  win.eval("fermeturesEtab.push({ id: 'f1', type: 'Réunion', libelle: 'Conseil pédagogique', debut: '" + AUJ + "', fin: '" + AUJ + "', portee: 'apres-midi', par: 'Directeur', le: '" + AUJ + " 09:00' }); sauvegarderFermetures()");
  connecter(compteMail('math-prof1@taalim.ma'));
  win.appliquerTableauService();
  t('prochain cours annulé affiché au professeur',
    txt('ens-repos-prochain').indexOf('Prochain cours annulé') >= 0 && txt('ens-repos-prochain').indexOf('15:00') >= 0 &&
    txt('ens-repos-prochain').indexOf('Conseil pédagogique') >= 0, txt('ens-repos-prochain'));
  t('pas de séance en cours : bloc « Séance annulée » masqué', doc.getElementById('ens-annulee').classList.contains('hidden'));

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
