// Test jsdom : v3.54 — cartes de l'Historique enseignant, fiche sans "Nom arabe",
// retard converti = coche A (rouge) au lieu de R dans le Dashboard enseignant
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

// "maintenant" = vendredi 11/09/2026 16:30 (creneau de math-prof1 : 16:00-18:00 TCSF-1, apres-midi)
const FIXE = new Date('2026-09-11T16:30:00').getTime();
const AUJ = '2026-09-11', HIER = '2026-09-10';
const classes = [{ id: 1, nom: 'TCSF-1', eleves: [
  { id: 1, nom: 'El Amrani', prenom: 'Ahmed', massar: 'M00001' },
  { id: 2, nom: 'Benali', prenom: 'Fatima', massar: 'M00002' },
  { id: 3, nom: 'Alami', prenom: 'Youssef', massar: 'M00003' }
] }];
const B = o => Object.assign({ classe: 'TCSF-1', date: '11/09/2026', enseignant: 'أيوب الكمرة', matiere: 'Maths', statut: 'absent' }, o);
const absences = [
  // eleve 1 : retard d'HIER non approuve -> transforme en absence (rouge, coche A)
  B({ id: 1, eleveId: 1, nom: 'El Amrani Ahmed', dateISO: HIER, seance: 'matin', heure: '10:00', type: 'retard', duree: '15 min' }),
  // eleve 2 : retard d'AUJOURD'HUI (15 min) -> encore un retard (orange, coche R)
  B({ id: 2, eleveId: 2, nom: 'Benali Fatima', dateISO: AUJ, seance: 'apres-midi', heure: '16:15', type: 'retard', duree: '30 min' }),
  // eleve 3 : absence d'hier non approuvee -> rouge, coche A
  B({ id: 3, eleveId: 3, nom: 'Alami Youssef', dateISO: HIER, seance: 'matin', heure: '09:00', type: 'absence' })
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
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

// jsdom normalise les couleurs inline en rgb()
const ROUGE = /rgb\(239, *68, *68\)|#ef4444/i;
const ORANGE = /rgb\(245, *158, *11\)|#f59e0b/i;

setTimeout(() => {
  // ---------- 1. CSS : les cartes eleves ont la meme hauteur pour les 3 roles ----------
  const css = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n');
  const regle = css.match(/body\.role-directeur \.carte-eleve[^}]*}/);
  t('regle compacte presente pour les 3 roles',
    !!regle && regle[0].indexOf('body.role-surveillant .carte-eleve') > 0 && regle[0].indexOf('body.role-enseignant .carte-eleve') > 0 &&
    regle[0].indexOf('height: 44px') > 0 && regle[0].indexOf('padding: 4px 14px') > 0,
    regle ? regle[0].replace(/\s+/g, ' ') : 'absente');

  // ---------- 2. Dashboard enseignant : coche A pour un retard converti ----------
  const prof = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='math-prof1@taalim.ma';})[0])"));
  doc.getElementById('login-email').value = prof.email;
  doc.getElementById('login-password').value = prof.password;
  win.connexion();
  t('connexion enseignant', doc.getElementById('page-enseignant').classList.contains('active'), prof.nom);
  t('classe du creneau preselectionnee', String(doc.getElementById('select-classe').value) === '1',
    doc.getElementById('select-classe').value + ' / ' + doc.getElementById('select-classe').options[0].textContent);

  const lignes = Array.from(doc.querySelectorAll('#liste-eleves-enseignant > div'));
  t('3 eleves listes', lignes.length === 3, lignes.length);
  const lireLigne = l => {
    const cbs = l.querySelectorAll('input[type=checkbox]');
    return {
      texte: l.textContent,
      a: { coche: cbs[0].checked, bloque: cbs[0].disabled },
      r: { coche: cbs[1].checked, bloque: cbs[1].disabled },
      bordure: (l.style.borderLeft || '').trim(),
      nom: l.querySelectorAll('span')[1].getAttribute('style') || ''
    };
  };
  const l1 = lireLigne(lignes[0]), l2 = lireLigne(lignes[1]), l3 = lireLigne(lignes[2]);

  t('retard converti (hier) : coche A + bloquee', l1.a.coche && l1.a.bloque, JSON.stringify(l1.a));
  t('retard converti (hier) : R non cochee', !l1.r.coche, JSON.stringify(l1.r));
  t('retard converti : bordure ROUGE (absence)', ROUGE.test(l1.bordure), l1.bordure);
  t('retard converti : nom en rouge', ROUGE.test(l1.nom), l1.nom.slice(l1.nom.indexOf('color')));

  t('retard du jour (15 min) : coche R', l2.r.coche && !l2.a.coche, JSON.stringify(l2.r) + JSON.stringify(l2.a));
  t('retard du jour : bordure ORANGE', ORANGE.test(l2.bordure), l2.bordure);

  t('absence d hier : coche A + bloquee', l3.a.coche && l3.a.bloque, JSON.stringify(l3.a));
  t('absence d hier : bordure ROUGE', ROUGE.test(l3.bordure), l3.bordure);

  // ---------- 3. fiche eleve : plus de "Nom arabe" ----------
  win.eval("setTimeout(function(){},0)");
  const eleveAvecArabe = { id: 9, nom: 'Test', prenom: 'Arabe' };
  win.eval("classes[0].eleves.push(" + JSON.stringify({ id: 9, nom: 'Berrada', prenom: 'Souad', massar: 'J130012349', nomArabe: 'برادة سعاد', nomFr: 'Berrada Souad' }) + ")");
  win.ouvrirFicheEleve(9, 1);
  const infosFiche = doc.getElementById('fiche-infos').textContent;
  t('fiche : plus de ligne "Nom arabe"', infosFiche.indexOf('Nom arabe') < 0, infosFiche.slice(0, 90));
  t('fiche : nom francais conserve', infosFiche.indexOf('Nom français') >= 0 && infosFiche.indexOf('Berrada Souad') >= 0);
  win.fermerFicheEleve();

  // ---------- 4. popup : titre = nom complet, numero dans la liste ----------
  const abs3 = JSON.parse(win.eval("JSON.stringify(absences.filter(function(a){return a.id===3;})[0])"));
  win.afficherDetailAbsence(abs3);
  t('popup : titre = nom complet', doc.getElementById('detail-titre').textContent === 'Alami Youssef',
    doc.getElementById('detail-titre').textContent);
  t('popup : numero = rang dans la classe (3e eleve)', doc.getElementById('detail-numero').textContent === '3',
    doc.getElementById('detail-numero').textContent);
  t('popup : date . heure conservee',
    doc.getElementById('detail-date').textContent === abs3.date + ' . ' + abs3.heure,
    doc.getElementById('detail-date').textContent + ' (attendu ' + abs3.date + ' . ' + abs3.heure + ')');
  win.fermerDetailAbsence();

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
