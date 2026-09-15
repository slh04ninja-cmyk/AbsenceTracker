// Test jsdom : v3.49 — classes TCSF-1/2/3 (12 eleves) + Ab/Rd de test dans les SEANCES EXACTES des tableaux
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

// Jour de reference : vendredi 11/09/2026 (hier = jeudi 10/09, 1er septembre = mardi 01/09)
const FIXE = new Date('2026-09-11T08:30:00').getTime();
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    const VraiDate = win.Date;
    win.Date = class extends VraiDate {
      constructor(...a) { super(...(a.length ? a : [FIXE])); }
      static now() { return FIXE; }
    };
    // Math.random DETERMINISTE : le generateur de donnees de demo tire au hasard. Sans graine,
    // la meme suite produisait des donnees differentes d'une machine a l'autre (echec aleatoire
    // en CI, jamais reproductible). Avec une graine, le jeu de demo est toujours identique.
    let graine = 42;
    win.Math.random = function () {
      graine = (graine * 1103515245 + 12345) % 2147483648;
      return graine / 2147483648;
    };
    win.localStorage.setItem('absenceTrackVersion', 'v2.1');   // != DEMO_VERSION -> nouveau jeu de demo
    win.localStorage.setItem('absences', '[]');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const d2 = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + d2(d.getMonth() + 1) + '-' + d2(d.getDate());

setTimeout(() => {
  const classes = JSON.parse(win.eval('JSON.stringify(classes)'));
  const absences = JSON.parse(win.eval('JSON.stringify(absences)'));
  const comptes = JSON.parse(win.eval('JSON.stringify(comptes)'));
  const tableaux = JSON.parse(win.eval('JSON.stringify(tableauxService)'));

  // Reference des creneaux reels : classe -> jour -> [{debut, matiere, prof}]
  const ref = {};
  Object.keys(tableaux).forEach(mail => tableaux[mail].forEach(c => {
    ref[c.classe] = ref[c.classe] || {};
    (ref[c.classe][c.jour] = ref[c.classe][c.jour] || {});
    ref[c.classe][c.jour][c.debut] = { matiere: c.matiere, prof: c.prof };
  }));

  // ---------- 1. classes ----------
  t('1 classes seulement', classes.length === 3, classes.map(c => c.nom).join(','));
  t('noms = TCSF-1/2/3', classes.map(c => c.nom).join(',') === 'TCSF-1,TCSF-2,TCSF-3');
  t('12 eleves par classe', classes.every(c => c.eleves.length === 12), classes.map(c => c.nom + ':' + c.eleves.length).join(' '));
  t('aucune classe 3eme/4eme/5eme', !classes.some(c => /3ème|4ème|5ème|2BACSPF|2PC1|TC1-G/.test(c.nom)));

  // ---------- 2. anciens Ab/Rd depuis le 01/09, approuves S1/S2/D ----------
  const anciens = absences.filter(a => a.test && a.statut !== 'absent' && a.dateISO < '2026-09-11');
  const juilMini = absences.filter(a => a.test && a.dateISO < '2026-09-01');
  t('anciens Ab/Rd depuis le 01/09', anciens.length >= 20, anciens.length + ' enregistrements');
  t('aucun Ab/Rd avant le 01/09', juilMini.length === 0, juilMini.length);
  t('anciens tous approuves S1/S2/D', anciens.every(a => /^(Surveillant [12]|Directeur)$/.test(a.justifiePar || '')),
    Array.from(new Set(anciens.map(a => a.justifiePar))).join(' / '));
  t('statut coherent avec l approbateur', anciens.every(a => /directeur/i.test(a.justifiePar) ? a.statut === 'justifie_d' : a.statut === 'justifie_s'));
  t('motif + datetime d approbation presents', anciens.every(a => a.motif && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(a.justifieLe || '')));
  t('aucun Ab/Rd le week-end', absences.filter(a => a.test).every(a => {
    const [y, m, j] = a.dateISO.split('-').map(Number);
    const g = new Date(y, m - 1, j).getDay();
    return g !== 0 && g !== 6;
  }));

  // ---------- 3. chaque Ab/Rd tombe dans une SEANCE EXACTE du tableau de l'eleve ----------
  const horsSeance = absences.filter(a => a.test).filter(a => {
    const [y, m, j] = a.dateISO.split('-').map(Number);
    const g = new Date(y, m - 1, j).getDay();
    const creneau = ref[a.classe] && ref[a.classe][g] && ref[a.classe][g][a.heure];
    if (!creneau) return true;
    if (creneau.matiere !== a.matiere) return true;
    if (creneau.prof !== a.profCode) return true;
    const p = comptes.find(c => c.code === a.profCode);
    return !p || p.nom !== a.enseignant;
  });
  t('tous dans une seance exacte du tableau', horsSeance.length === 0,
    horsSeance.length ? JSON.stringify(horsSeance[0]) : absences.filter(a => a.test).length + ' verifies');
  t('eleve appartient bien a la classe', absences.filter(a => a.test).every(a => {
    const cl = classes.find(c => c.nom === a.classe);
    return cl && cl.eleves.some(e => e.id === a.eleveId);
  }));
  t('matiere de l Ab/Rd = matiere du prof', absences.filter(a => a.test).every(a => {
    const p = comptes.find(c => c.code === a.profCode);
    return p && p.matiere === a.matiere;
  }));
  t('seance deduite de l heure (08-12 / 14-18)', absences.filter(a => a.test).every(a =>
    a.seance === (a.heure < '13:00' ? 'matin' : 'apres-midi') && a.heure >= '08:00' && a.heure <= '17:00'));

  // ---------- 4. non justifies : aujourd'hui + 2 hier ----------
  const nonJust = absences.filter(a => a.test && a.statut === 'absent');
  const auj = nonJust.filter(a => a.dateISO === '2026-09-11');
  const hier = nonJust.filter(a => a.dateISO === '2026-09-10');
  t('des non justifies aujourd hui', auj.length >= 1, auj.length);
  t('2 non justifies hier', hier.length === 2, hier.length);
  t('non justifies du jour = MATIN seulement', auj.length > 0 && auj.every(a => a.heure < '12:00' && a.seance === 'matin'),
    auj.map(a => a.heure).join(' / '));
  t('non justifies sans motif ni approbateur', nonJust.every(a => !a.motif && !a.justifiePar && !a.justifieLe));
  const aujR = auj.filter(a => a.type === 'retard').length;
  const hierR = hier.filter(a => a.type === 'retard').length;
  t('aujourd hui : 2 retards + 2 absences non justifies', aujR === 2 && auj.length - aujR === 2, aujR + 'Rd / ' + (auj.length - aujR) + 'Ab');
  t('hier : 1 retard + 1 absence non justifies', hierR === 1 && hier.length - hierR === 1, hierR + 'Rd / ' + (hier.length - hierR) + 'Ab');
  // on passe l'OBJET aux fonctions de l'application (et non son identifiant : les
  // identifiants sont des nombres a virgule flottante, et la recherche par identifiant
  // echouait par intermittence -> l'assertion comparait alors des objets introuvables)
  const eff = a => win.typeEffectif(a);
  t('retard non justifie d hier = hors delai (type effectif absence)',
    hier.filter(a => a.type === 'retard').every(a => eff(a) === 'absence'));
  // CONTRAT (et non hasard) : un retard approuve bascule en absence SI ET SEULEMENT SI
  // l'approbation est arrivee plus de 30 min apres le signalement. L'ancienne version
  // exigeait « au moins un converti », ce qui dependait du tirage aleatoire du jeu de
  // test : la suite echouait une fois sur dix sans qu'aucune regle ne soit cassee.
  const justR = anciens.filter(a => a.type === 'retard');
  const horsDelai = a => win.retardHorsDelai(a);
  const conv = justR.filter(a => eff(a) === 'absence');
  t('retards approuves : conversion conforme au delai de 30 min',
    justR.length > 0 && justR.every(a => (eff(a) === 'absence') === !!horsDelai(a)),
    conv.length + '/' + justR.length + ' convertis');
  const parEleve = {};
  nonJust.forEach(a => { parEleve[a.eleveId] = (parEleve[a.eleveId] || 0) + 1; });
  t('1 seul non justifie par eleve', Object.values(parEleve).every(n => n === 1),
    JSON.stringify(parEleve));
  t('non justifies sur classes differentes ou eleves differents', nonJust.length === Object.keys(parEleve).length);

  // ---------- 5. integrite generale ----------
  const cles = absences.map(a => a.eleveId + '|' + a.dateISO + '|' + a.heure + '|' + a.classe);
  t('aucun doublon eleve/date/heure', new Set(cles).size === cles.length, cles.length + ' -> ' + new Set(cles).size);
  t('un eleve a bien des Ab/Rd dans l historique', anciens.length > 0);
  t('3 classes ont des Ab/Rd anciens', new Set(anciens.map(a => a.classe)).size === 3,
    Array.from(new Set(anciens.map(a => a.classe))).join(','));
  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 400);
