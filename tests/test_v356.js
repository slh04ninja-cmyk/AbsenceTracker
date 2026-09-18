// Test jsdom : v3.56 — établissement/année scolaire/semestres, annulation de séance, renommage des profs
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const FIXE = new Date('2026-09-11T16:30:00').getTime();   // vendredi 11/09/2026 16:30
const AUJ = '2026-09-11';
const classes = [
  { id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] },
  { id: 2, nom: 'TCSF-2', eleves: [{ id: 3, nom: 'Alami', prenom: 'Youssef' }, { id: 4, nom: 'Tazi', prenom: 'Salma' }] },
  { id: 3, nom: 'TCSF-3', eleves: [{ id: 5, nom: 'Naciri', prenom: 'Omar' }, { id: 6, nom: 'Fikri', prenom: 'Aya' }] }
];
const absences = [
  { id: 1, eleveId: 1, nom: 'El Amrani Ahmed', classe: 'TCSF-1', dateISO: AUJ, date: '11/09/2026',
    seance: 'matin', heure: '08:30', type: 'absence', statut: 'absent', enseignant: 'سامية الحاضي',
    profCode: 'fr-prof1', matiere: 'Français', test: true },
  { id: 2, eleveId: 3, nom: 'Alami Youssef', classe: 'TCSF-2', dateISO: AUJ, date: '11/09/2026',
    seance: 'apres-midi', heure: '16:10', type: 'retard', duree: '15 min', statut: 'absent', enseignant: 'أيوب الكمرة',
    profCode: 'math-prof1', matiere: 'Maths', test: true }
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    const V = win.Date;
    win.Date = class extends V { constructor(...a) { super(...(a.length ? a : [FIXE])); } static now() { return FIXE; } };
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', JSON.stringify(absences));
    // utilisateur existant : ancien format de libelles S1 / S2 -> doivent etre normalises en 1 / 2
    win.localStorage.setItem('anneeScolaire', JSON.stringify({ libelle: '2026-2027', semestres: [
      { nom: 'S1', debut: '2026-09-01', fin: '2027-01-15' },
      { nom: 'S2', debut: '2027-02-01', fin: '2027-05-15' }
    ] }));
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const compte = role => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='" + role + "';})[0])"));
const compteMail = m => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='" + m + "';})[0])"));
const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };
const txt = id => doc.getElementById(id).textContent;

setTimeout(() => {
  // ══════════ 1. Établissement & année scolaire ══════════
  t('année par défaut 2026-2027', win.eval('anneeScolaire.libelle') === '2026-2027', win.eval('anneeScolaire.libelle'));
  t('S1 = 01/09/2026 → 15/01/2027',
    win.eval("anneeScolaire.semestres[0].debut") === '2026-09-01' && win.eval("anneeScolaire.semestres[0].fin") === '2027-01-15',
    win.eval("JSON.stringify(anneeScolaire.semestres[0])"));
  t('S2 = 01/02/2027 → 15/05/2027',
    win.eval("anneeScolaire.semestres[1].debut") === '2027-02-01' && win.eval("anneeScolaire.semestres[1].fin") === '2027-05-15',
    win.eval("JSON.stringify(anneeScolaire.semestres[1])"));
  t('libellés de semestre normalisés (S1 → 1, S2 → 2)',
    win.eval("anneeScolaire.semestres[0].nom") === '1' && win.eval("anneeScolaire.semestres[1].nom") === '2',
    win.eval("anneeScolaire.semestres.map(function(s){return s.nom;}).join('/')"));
  t('semestre d une date : 01/10/2026 = semestre 1', win.eval("(semestreDeDate('2026-10-01')||{}).nom") === '1');
  t('semestre d une date : 01/03/2027 = semestre 2', win.eval("(semestreDeDate('2027-03-01')||{}).nom") === '2');
  t('entre les 2 semestres (20/01/2027) = aucun', win.eval("semestreDeDate('2027-01-20') === null"));
  t('semestre courant = 1 (11/09/2026)', win.eval('(semestreCourant()||{}).nom') === '1', win.eval('(semestreCourant()||{}).nom'));
  t('libellé année + semestre', win.eval('libelleAnneeScolaire()').indexOf('2026-2027') >= 0 && win.eval('libelleAnneeScolaire()').indexOf('Semestre 1') >= 0,
    win.eval('libelleAnneeScolaire()'));
  t('étiquette sur l écran de connexion', txt('login-annee').indexOf('2026-2027') >= 0, txt('login-annee'));

  // bornes de période
  const b1 = JSON.parse(win.eval("JSON.stringify(bornesPeriode('s1'))"));
  const b2 = JSON.parse(win.eval("JSON.stringify(bornesPeriode('s2'))"));
  const ba = JSON.parse(win.eval("JSON.stringify(bornesPeriode('annee'))"));
  t('période S1 = 2026-09-01 → 2027-01-15', b1.debut === '2026-09-01' && b1.fin === '2027-01-15', JSON.stringify(b1));
  t('période S2 = 2027-02-01 → 2027-05-15', b2.debut === '2027-02-01' && b2.fin === '2027-05-15', JSON.stringify(b2));
  t('période année = 2026-09-01 → 2027-05-15', ba.debut === '2026-09-01' && ba.fin === '2027-05-15', JSON.stringify(ba));
  const optSem = doc.getElementById('stats-periode').querySelector('option[value="s1"]');
  t('option Semestre 1 sans dates (v4.56 : les périodes ne portent plus leurs dates)', optSem && optSem.textContent.indexOf('Semestre 1') >= 0 && optSem.textContent.indexOf('/2026') < 0 && optSem.textContent.indexOf('/2027') < 0,
    optSem ? optSem.textContent : 'absente');

  // ══════════ 2. Renommage d'un professeur (directeur) ══════════
  connecter(compte('directeur'));
  win.switchDirPage('dir-gestion');
  win.switchProfil();   // v3.61 : la liste des professeurs est dans la rubrique RH du Profil
  const profs = doc.querySelectorAll('#dir-profs-list > div');
  t('liste des 11 professeurs dans Gestion', profs.length === 11, profs.length);
  t('phrase de récap supprimée de la carte', doc.getElementById('etab-recap') === null);
  t('champs Libellé S1/S2 supprimés', doc.getElementById('sem1-nom') === null && doc.getElementById('sem2-nom') === null);
  const cssCarte = Array.from(doc.querySelectorAll('style')).map(x => x.textContent).join('\n');
  t('carte compacte (classe .carte-settings)',
    !!doc.getElementById('etab-card') && doc.getElementById('etab-card').classList.contains('carte-settings') &&
    cssCarte.indexOf('.carte-settings .form-group { margin-bottom: 8px; }') > 0 &&
    cssCarte.indexOf('.carte-settings .sd-trigger { min-height: 38px;') > 0,
    cssCarte.indexOf('.carte-settings') > 0 ? 'CSS présente' : 'CSS absente');
  // enregistrement des paramètres établissement
  // v3.69 : les champs etablissement sont dans le popup "Informations de l'établissement"
  win.ouvrirFormulaire('etablissement');
  t('popup Informations de l établissement ouvert', !doc.getElementById('modal-form').classList.contains('hidden') &&
    doc.getElementById('form-titre').textContent.indexOf('Informations') >= 0, doc.getElementById('form-titre').textContent);
  t('bouton dans la carte', !!doc.querySelector('#etab-card button'));
  // v3.57 : academie / direction / annee en listes deroulantes (direction dependante)
  t('12 académies régionales dans la liste (13 options avec le placeholder)',
    Array.from(doc.getElementById('etab-academie').options).filter(o => o.value !== '').length === 12 &&
    doc.getElementById('etab-academie').options.length === 13,
    Array.from(doc.getElementById('etab-academie').options).map(o => o.value || '(vide)').join(','));
  t('liste des années scolaires (2026-2027 présent)',
    Array.from(doc.getElementById('annee-libelle').options).some(o => o.value === '2026-2027'),
    Array.from(doc.getElementById('annee-libelle').options).map(o => o.value).join(','));
  t('la direction dépend de l académie (81 directions au total)',
    win.eval('ACADEMIES.reduce(function(s,a){return s+a.directions.length;},0)') === 81,
    win.eval('ACADEMIES.reduce(function(s,a){return s+a.directions.length;},0)'));
  doc.getElementById('etab-academie').value = 'Grand Casablanca-Settat';
  win.changerAcademie();
  t('15 directions pour Grand Casablanca-Settat', doc.getElementById('etab-direction').options.length === 15,
    doc.getElementById('etab-direction').options.length);
  t('Settat présent dans les directions', Array.from(doc.getElementById('etab-direction').options).some(o => o.value === 'Settat'));
  doc.getElementById('etab-direction').value = 'Settat';
  doc.getElementById('etab-academie').value = 'Dakhla-Oued Ed-Dahab';
  win.changerAcademie();
  t('changement d académie → 2 directions et Settat retiré',
    doc.getElementById('etab-direction').options.length === 2 &&
    !Array.from(doc.getElementById('etab-direction').options).some(o => o.value === 'Settat') &&
    doc.getElementById('etab-direction').value !== 'Settat',
    Array.from(doc.getElementById('etab-direction').options).map(o => o.value).join(','));
  doc.getElementById('etab-academie').value = 'Grand Casablanca-Settat';
  win.changerAcademie();
  doc.getElementById('etab-code').value = '24A1234';
  doc.getElementById('etab-nom').value = 'Collège Al Qasba';
  doc.getElementById('etab-direction').value = 'Settat';
  doc.getElementById('annee-libelle').value = '2026-2027';
  win.enregistrerParametres();
  const etabStocke = JSON.parse(win.localStorage.getItem('etablissement'));
  t('établissement persisté (académie + direction choisies dans les listes)',
    etabStocke.code === '24A1234' && etabStocke.academie === 'Grand Casablanca-Settat' && etabStocke.direction === 'Settat',
    JSON.stringify(etabStocke));
  t('étiquette de connexion mise à jour (nom + année + semestre)',
    txt('login-annee').indexOf('Collège Al Qasba') >= 0 && txt('login-annee').indexOf('2026-2027') >= 0 &&
    txt('login-annee').indexOf('Semestre 1') >= 0, txt('login-annee'));
  // renommage
  win.ouvrirRenommageProf('math-prof1');
  t('modale renommage ouverte + nom prérempli', !doc.getElementById('modal-renommer').classList.contains('hidden') &&
    doc.getElementById('renommer-nom').value === 'أيوب الكمرة', doc.getElementById('renommer-nom').value);
  doc.getElementById('renommer-nom').value = 'Ayoub El Kamra';
  win.confirmerRenommageProf();
  t('nom du compte mis à jour', compteMail('math-prof1@taalim.ma').nom === 'Ayoub El Kamra', compteMail('math-prof1@taalim.ma').nom);
  t('override persisté', JSON.parse(win.localStorage.getItem('nomsProfs'))['math-prof1'] === 'Ayoub El Kamra');
  const abs2 = JSON.parse(win.eval("JSON.stringify(absences.filter(function(a){return a.id===2;})[0])"));
  t('signalements existants renommés', abs2.enseignant === 'Ayoub El Kamra', abs2.enseignant);
  t('modale renommage refermée', doc.getElementById('modal-renommer').classList.contains('hidden'));
  t('liste des profs rafraîchie', doc.getElementById('dir-profs-list').textContent.indexOf('Ayoub El Kamra') >= 0);

  // ══════════ 3. Annulation de séance (directeur, depuis la rubrique RH) ══════════
  connecter(compteMail('d@taalim.ma'));
  t('plus de bouton d annulation sur les Dashboards',
    !doc.querySelector('#page-surveillant .btn-outline-danger') && !doc.querySelector('#page-directeur .btn-outline-danger'));
  win.switchDirPage('dir-gestion');
  t('annulation de séances : carte dédiée dans Gestion + popup de saisie',
    !!doc.querySelector('#annulations-card button') && !!doc.getElementById('annulations-liste') &&
    doc.getElementById('modal-annulation') === null);
  win.ouvrirFormulaire('annulation');
  t('date préremplie = aujourd hui', doc.getElementById('annul-date').value === AUJ, doc.getElementById('annul-date').value);
  t('classes listées', doc.getElementById('annul-classe').options.length === 3, doc.getElementById('annul-classe').options.length);
  doc.getElementById('annul-classe').value = 'TCSF-1';
  win.majCreneauxAnnulation();
  const opts = Array.from(doc.getElementById('annul-creneau').options).map(o => o.value);
  t('séances de TCSF-1 le vendredi (issues du tableau de service)', opts.indexOf('08:00|10:00') >= 0 && opts.length >= 3, opts.join(' / '));
  doc.getElementById('annul-creneau').value = '08:00|10:00';
  doc.getElementById('annul-motif').value = 'Absence du professeur';
  win.confirmerAnnulationSeance();
  const annul = JSON.parse(win.localStorage.getItem('seancesAnnulees'));
  t('annulation persistée (classe + séance + motif + auteur)',
    annul.length === 1 && annul[0].classe === 'TCSF-1' && annul[0].debut === '08:00' && annul[0].motif === 'Absence du professeur' && annul[0].par === 'Directeur',
    JSON.stringify(annul[0]));
  // v4.59 : cette annulation est à 08:00-10:00 alors que l'horloge du banc est à 16:30 :
  // son heure est passée -> elle quitte le Dashboard, mais RESTE dans les calculs.
  t('séance annulée dont l heure est passée : hors du Dashboard, gardée pour les calculs',
    txt('annul-liste').indexOf('TCSF-1') < 0 && win.eval("listeSeancesAnnulees().length") === 1,
    txt('annul-liste').slice(0, 60) + ' | calculs : ' + win.eval("listeSeancesAnnulees().length"));
  // v3.59 : modale compacte + liste des annulations dans un div a defilement
  const cssMod = Array.from(doc.querySelectorAll('style')).map(x => x.textContent).join('\n');
  t('formulaire d annulation compact (carte Fermeture en .carte-settings)',
    cssMod.indexOf('.carte-settings .form-group { margin-bottom: 8px; }') > 0 &&
    cssMod.indexOf('.carte-settings .sd-trigger { min-height: 38px;') > 0 &&
    doc.getElementById('fermeture-card').classList.contains('carte-settings'));
  t('liste des annulations : 4 cartes avant défilement (classe partagée)',
    cssMod.indexOf('.js-seances-annulees, .js-absences-personnel, .js-fermetures, .js-annulations, .js-personnel {') > 0 &&
    cssMod.indexOf('max-height: 190px; overflow-y: auto') > 0 &&
    doc.getElementById('annul-liste').parentElement.id === 'seances-annulees-card',
    doc.getElementById('annul-liste').parentElement.id);
  // plusieurs annulations : elles restent toutes dans le meme div (qui defile)
  // v4.59 : on les place APRÈS 16:30 (l'heure du banc), sans quoi elles quitteraient l'écran
  win.eval("seancesAnnulees.push({id: 'x1', dateISO: '" + AUJ + "', classe: 'TCSF-2', debut: '17:00', fin: '18:00', motif: 'Examen', par: 'Directeur', le: '" + AUJ + " 09:00'})");
  win.eval("seancesAnnulees.push({id: 'x2', dateISO: '" + AUJ + "', classe: 'TCSF-3', debut: '18:00', fin: '19:00', motif: 'Réunion', par: 'Surveillant 1', le: '" + AUJ + " 09:00'})");
  win.afficherSeancesAnnulees();
  t('2 séances annulées encore à venir listées dans le div', doc.getElementById('annul-liste').children.length === 2,
    doc.getElementById('annul-liste').children.length);
  win.eval("seancesAnnulees = seancesAnnulees.filter(function(x){return x.id !== 'x1' && x.id !== 'x2';}); sauvegarderSeancesAnnulees()");
  win.afficherSeancesAnnulees();
  const restants = Array.from(doc.querySelectorAll('#annul-liste > div')).map(x => x.textContent);
  t('l annulation TCSF-1 (08:00-10:00, heure passee) n est plus affichee',
    restants.filter(x => x.indexOf('TCSF-1') >= 0).length === 0, restants.join(' | '));

  t('absence de cette séance = séance annulée', win.eval("absenceEnSeanceAnnulee(absences.find(function(a){return a.id===1;}))") === true);
  t('absence d une autre séance : non concernée', win.eval("absenceEnSeanceAnnulee(absences.find(function(a){return a.id===2;}))") === false);
  const filtresDir = JSON.parse(win.eval("JSON.stringify(statsDirFiltre().map(function(a){return a.id;}))"));
  t('stats du directeur : absence en séance annulée exclue', filtresDir.indexOf(1) < 0 && filtresDir.indexOf(2) >= 0, filtresDir.join(','));
  // double annulation refusée
  win.confirmerAnnulationSeance();
  t('pas de doublon', JSON.parse(win.localStorage.getItem('seancesAnnulees')).length === 1);
  // rétablissement (v3.72 : avec confirmation)
  win.retablirSeance(annul[0].id);
  t('rétablissement : confirmation demandée', !doc.getElementById('modal-confirmation').classList.contains('hidden') &&
    JSON.parse(win.localStorage.getItem('seancesAnnulees')).length === 1);
  win.validerConfirmation();
  t('rétablissement : liste vidée', JSON.parse(win.localStorage.getItem('seancesAnnulees')).length === 0);


  // annulation -> Dashboard enseignant
  win.eval("seancesAnnulees.push({ id: 99, dateISO: '" + AUJ + "', classe: 'TCSF-1', debut: '16:00', fin: '18:00', motif: 'Réunion', par: 'Directeur', le: '" + AUJ + " 10:00' })");
  win.eval('sauvegarderSeancesAnnulees()');
  connecter(compteMail('math-prof1@taalim.ma'));
  win.appliquerTableauService();
  t('enseignant : bloc "Séance annulée" affiché', !doc.getElementById('ens-annulee').classList.contains('hidden'));
  t('enseignant : détail (classe, horaire, motif, auteur)', txt('ens-annulee-detail').indexOf('TCSF-1') >= 0 &&
    txt('ens-annulee-detail').indexOf('Réunion') >= 0 && txt('ens-annulee-detail').indexOf('Directeur') >= 0, txt('ens-annulee-detail'));
  t('enseignant : zone de saisie masquée', doc.getElementById('zone-prise-absence').classList.contains('hidden'));
  t('enseignant : liste des élèves vidée', doc.getElementById('liste-eleves-enseignant').children.length === 0,
    doc.getElementById('liste-eleves-enseignant').children.length);

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
