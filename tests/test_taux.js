// test_taux.js — le TAUX DE PRÉSENCE doit être calculé sur les séances DUES (tableau de
// service), pas sur les signalements.
// Avant : le nombre de séances était le nombre de couples (date, séance) trouvés PARMI les
// signalements -> plus il y avait d'absences, plus le taux montait, et un jour sans
// signalement ne comptait pas du tout.
// Maintenant : séances dues = tableau de service moins fermetures, annulations et absences
// de professeurs ; effectif = élèves ACTIFS (les « sortis » ne comptent pas) ; s'il n'y a
// aucune séance due, on affiche « — » plutôt qu'un pourcentage qui ne veut rien dire.
//
// Fixture : TCSF-1 (2 actifs + 1 sorti) avec SON tableau de service (mardi 08h, mardi 14h,
// vendredi 08h). Horloge figée au vendredi 11/09/2026. L'application ajoute ses propres
// classes de démonstration : les attentes GLOBALES sont donc recalculées avec les fonctions
// de l'application (c'est la cohérence affichage <=> règles qu'on vérifie), tandis que les
// nombres de TCSF-1 sont calculés à la main dans les commentaires.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const FIXE = new Date('2026-09-11T08:30:00').getTime();
const DEBUT = '2026-09-01', FIN = '2026-09-11';        // période « mois » bornée à l'année
const classes = [{ id: 1, nom: 'TCSF-1', eleves: [
  { id: 1, massar: 'M001', nom: 'El Amrani', prenom: 'Mehdi' },
  { id: 2, massar: 'M002', nom: 'Berrada',   prenom: 'Imane' },
  { id: 3, massar: 'M003', nom: 'Ouazzani',  prenom: 'Karim', actif: false }   // sorti
]}];
const sc = (j, d, f) => ({ classe: 'TCSF-1', jour: j, debut: d, fin: f, matiere: 'MATH', prof: 'Prof Maths' });
const tableaux = { 'math-prof1@taalim.ma': [sc(2, '08:00', '09:00'), sc(2, '14:00', '15:00'), sc(5, '08:00', '09:00')] };
const sig = (id, eleveId, dateISO, heure, type) => ({
  id: id, eleveId: eleveId, nom: 'Eleve ' + eleveId, classe: 'TCSF-1',
  date: dateISO.slice(8) + '/09/2026', dateISO: dateISO, heure: heure, seance: 'matin',
  type: type, duree: '', statut: 'absent', enseignant: 'Prof Maths', matiere: 'MATH'
});

let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
  beforeParse(win) {
    const Vrai = win.Date;
    win.Date = class extends Vrai {
      constructor(...a) { super(...(a.length ? a : [FIXE])); }
      static now() { return FIXE; }
    };
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('tableauxService_v2', JSON.stringify(tableaux));
    win.localStorage.setItem('absences', JSON.stringify([
      sig(1, 1, '2026-09-11', '08:05', 'absence')      // aujourd'hui, à l'heure -> absence
    ]));
  }
});
const win = dom.window, doc = win.document;
const ev = code => win.eval(code);
const tauxAffiche = () => doc.getElementById('dir-stat-presence').textContent;
const detail = () => doc.getElementById('dir-stat-presence-detail').textContent;

// ce que l'application DOIT afficher, recalculé avec les règles (séances dues, élèves actifs)
function attendu(debut, fin) {
  let eff = 0, dues = 0, places = 0;
  JSON.parse(ev('JSON.stringify(classes)')).forEach(c => {
    const n = ev('elevesActifs(classes.filter(function(x){return x.id===' + c.id + ';})[0]).length');
    const d = ev('seancesDuesClasse(' + JSON.stringify(c.nom) + ',' + JSON.stringify(debut) + ',' + JSON.stringify(fin) + ')');
    eff += n; dues += d; places += n * d;
  });
  const abs = ev('absencesCompteesPeriode(' + JSON.stringify(debut) + ',' + JSON.stringify(fin) + ').length');
  const den = Math.max(places, 1);
  return { eff: eff, dues: dues, abs: abs, taux: Math.max(0, Math.min(100, Math.round(((den - abs) / den) * 100))) };
}

setTimeout(async () => {
  const db = JSON.parse(ev('JSON.stringify(comptes.filter(function(c){return c.role==="directeur";})[0])'));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();

  // ---------- 1. les séances dues viennent du TABLEAU DE SERVICE ----------
  t('TCSF-1 en septembre : 14 séances dues (5 mardis x 2 + 4 vendredis x 1)',
    ev('seancesDuesClasse("TCSF-1","2026-09-01","2026-09-30")') === 14,
    ev('seancesDuesClasse("TCSF-1","2026-09-01","2026-09-30")'));
  t('un mardi seul : 2 séances dues', ev('seancesDuesClasse("TCSF-1","2026-09-08","2026-09-08")') === 2);
  t('un mercredi : aucune séance due', ev('seancesDuesClasse("TCSF-1","2026-09-09","2026-09-09")') === 0);
  t('du 01 au 11/09 : 6 séances dues', ev('seancesDuesClasse("TCSF-1","' + DEBUT + '","' + FIN + '")') === 6,
    ev('seancesDuesClasse("TCSF-1","' + DEBUT + '","' + FIN + '")'));

  // ---------- 2. LE COMPTE NE DÉPEND PLUS DES SIGNALEMENTS (le bug corrigé) ----------
  const avant = ev('seancesDuesClasse("TCSF-1","2026-09-01","2026-09-30")');
  ev('absences.push({ id: 99, eleveId: 2, classe: "TCSF-1", dateISO: "2026-09-15", date: "15/09/2026", heure: "08:05", seance: "matin", type: "absence", statut: "absent" })');
  t('ajouter un signalement ne change PAS le nombre de séances dues',
    ev('seancesDuesClasse("TCSF-1","2026-09-01","2026-09-30")') === avant, avant);
  ev('absences = absences.filter(function(a){ return a.id !== 99; })');

  // ---------- 3. effectif : les élèves sortis ne comptent pas ----------
  t('TCSF-1 : 2 élèves actifs (le 3e est sorti)', ev('elevesActifs(classes.filter(function(c){return c.id===1;})[0]).length') === 2);

  // ---------- 4. l'affichage correspond aux règles ----------
  win.mettreAJourDashboardDir();
  win.afficherStatistiquesDir();
  const a1 = attendu(DEBUT, FIN);
  t('le détail parle de séances DUES', detail().indexOf('séance(s) due(s)') >= 0, detail());
  t('le détail annonce ' + a1.eff + ' élèves · ' + a1.dues + ' séances · ' + a1.abs + ' absence(s)',
    detail().indexOf(a1.eff + ' élèves · ' + a1.dues + ' séance(s) due(s) · ' + a1.abs + ' absence(s)') === 0, detail());
  t('le taux affiché = ' + a1.taux + ' % (calculé avec les mêmes règles)', tauxAffiche() === a1.taux + '%', tauxAffiche());

  // ---------- 5. la règle des 30 minutes (retard non approuvé -> absence) ----------
  const temoin = ev('typeEffectif({ type: "retard", heure: "08:05", classe: "TCSF-1", dateISO: "2026-09-11", seance: "matin" })');
  t('un retard récent reste un retard', temoin === 'retard', temoin);
  // horloge figée à 08:30 : un signalement de 07:50 attend depuis 40 min -> absence
  const long = ev('typeEffectif({ type: "retard", heure: "07:50", classe: "TCSF-1", dateISO: "2026-09-11", seance: "matin" })');
  t('un retard non approuvé au bout de 40 min devient une absence', long === 'absence', long);

  const avant2 = attendu(DEBUT, FIN);
  ev('absences.push({ id: 20, eleveId: 2, classe: "TCSF-1", dateISO: "2026-09-11", date: "11/09/2026", heure: "07:50", seance: "matin", type: "retard", statut: "absent", enseignant: "Prof Maths", matiere: "MATH" })');
  win.afficherStatistiquesDir();
  const a2 = attendu(DEBUT, FIN);
  t('un retard non approuvé compte comme une absence', a2.abs === avant2.abs + 1, avant2.abs + ' -> ' + a2.abs);
  t('et le taux baisse de ' + avant2.taux + ' % à ' + a2.taux + ' %', a2.taux <= avant2.taux && tauxAffiche() === a2.taux + '%', tauxAffiche());

  // ---------- 6. une fermeture : plus rien de dû, rien de compté ----------
  ev('fermeturesEtab.push({ id: 1, type: "Fermeture", libelle: "Test", debut: "2026-09-11", fin: "2026-09-11", portee: "journee" })');
  t('la fermeture annule la séance due du jour', ev('seancesDuesClasse("TCSF-1","2026-09-11","2026-09-11")') === 0);
  const a3 = attendu(DEBUT, FIN);
  t('les absences du jour de fermeture ne comptent plus', a3.abs === a2.abs - 2, a2.abs + ' -> ' + a3.abs);
  win.afficherStatistiquesDir();
  t('le taux affiché suit (' + a3.taux + ' %)', tauxAffiche() === a3.taux + '%', tauxAffiche());
  ev('fermeturesEtab.pop()');

  // ---------- 7. une séance annulée sort du dénominateur ----------
  ev('seancesAnnulees.push({ id: 1, dateISO: "2026-09-08", classe: "TCSF-1", debut: "08:00", fin: "09:00", motif: "Examen" })');
  t('le mardi 08/09 : 1 seule séance due (l autre est annulée)',
    ev('seancesDuesClasse("TCSF-1","2026-09-08","2026-09-08")') === 1,
    ev('seancesDuesClasse("TCSF-1","2026-09-08","2026-09-08")'));
  t('et 13 séances dues en septembre', ev('seancesDuesClasse("TCSF-1","2026-09-01","2026-09-30")') === 13,
    ev('seancesDuesClasse("TCSF-1","2026-09-01","2026-09-30")'));

  // ---------- 7bis. aucun tableau de service : « — », jamais un faux pourcentage ----------
  const tableauxGardes = ev('JSON.stringify(tableauxService)');
  ev('tableauxService = {}');
  win.afficherStatistiquesDir();
  t('sans tableau de service : le taux affiche « — »', tauxAffiche() === '—', tauxAffiche());
  t('et le détail dit « aucune séance due »', detail().indexOf('aucune séance due') >= 0, detail());
  ev('tableauxService = ' + tableauxGardes);      // on remet les tableaux pour la suite
  win.afficherStatistiquesDir();

  // ---------- 8. côté prof : même formule ----------
  const ens = JSON.parse(ev('JSON.stringify(comptes.filter(function(c){return c.role==="enseignant";})[0])'));
  win.deconnexion();
  doc.getElementById('login-email').value = ens.email;
  doc.getElementById('login-password').value = ens.password;
  win.connexion();
  win.choisirClasse(1);
  win.afficherStatistiques();
  const dt = doc.getElementById('stat-presence-detail').textContent;
  const duesClasse = ev('seancesDuesClasse("TCSF-1","' + DEBUT + '","' + FIN + '")');
  t('page des profs : 2 élèves actifs (le sorti est exclu)', dt.indexOf('2 élèves') === 0, dt);
  t('page des profs : le détail parle de séances dues', dt.indexOf('séance(s) due(s)') >= 0, dt);
  t('page des profs : même nombre de séances dues que côté directeur (' + duesClasse + ')',
    dt.indexOf(duesClasse + ' séance(s) due(s)') >= 0, dt);

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 900);
