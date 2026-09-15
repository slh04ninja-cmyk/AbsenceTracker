// Test jsdom : v3.50 — un retard non approuve dans les 30 min se transforme en absence
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

// "maintenant" = vendredi 11/09/2026 10:00
const FIXE = new Date('2026-09-11T10:00:00').getTime();
const AUJ = '2026-09-11';
const classes = [
  { id: 1, nom: 'TCSF-1', eleves: [
    { id: 1, nom: 'El Amrani', prenom: 'Ahmed', massar: 'M00001' },
    { id: 2, nom: 'Benali', prenom: 'Fatima', massar: 'M00002' },
    { id: 3, nom: 'Alami', prenom: 'Youssef', massar: 'M00003' }
  ] }
];
const B = (o) => Object.assign({
  classe: 'TCSF-1', dateISO: AUJ, date: '11/09/2026', seance: 'matin',
  enseignant: 'أيوب الكمرة', matiere: 'Maths', type: 'absence', statut: 'absent'
}, o);
const absences = [
  // eleve 1 : retard en attente 10 min -> doit rester un Retard
  B({ id: 1, eleveId: 1, nom: 'El Amrani Ahmed', heure: '09:50', type: 'retard', duree: '15 min' }),
  // eleve 1 : retard approuve a temps (20 min) -> reste un Retard
  B({ id: 2, eleveId: 1, nom: 'El Amrani Ahmed', heure: '08:00', type: 'retard', duree: '30 min',
      statut: 'justifie_s', justifiePar: 'Surveillant 1', justifieLe: AUJ + ' 08:20', motif: 'Transport' }),
  // eleve 1 : retard approuve trop tard (65 min) -> devient une Absence
  B({ id: 3, eleveId: 1, nom: 'El Amrani Ahmed', heure: '08:00', type: 'retard', duree: '1 h',
      statut: 'justifie_d', justifiePar: 'Directeur', justifieLe: AUJ + ' 09:05', motif: 'Maladie' }),
  // eleve 2 : retard en attente depuis 45 min -> Retard -> Absence
  B({ id: 4, eleveId: 2, nom: 'Benali Fatima', heure: '09:15', type: 'retard', duree: '15 min' }),
  // eleve 2 : absence normale + exclusion (jamais transformees)
  B({ id: 5, eleveId: 2, nom: 'Benali Fatima', heure: '08:00' }),
  B({ id: 6, eleveId: 2, nom: 'Benali Fatima', heure: '11:00', type: 'exclusion' }),
  // eleve 3 : absence AVEC duree -> la ligne Duree doit s'afficher
  B({ id: 7, eleveId: 3, nom: 'Alami Youssef', heure: '11:00', type: 'absence', duree: '1 h' })
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

setTimeout(() => {
  // 1. constante + helpers
  t('delai = 30 min', win.eval('DELAI_RETARD_MIN') === 30, win.eval('DELAI_RETARD_MIN'));
  const eff = id => win.eval("typeEffectif(absences.find(function(a){return a.id===" + id + ";}))");
  t('retard en attente 10 min = retard', eff(1) === 'retard', eff(1));
  t('retard approuve a temps = retard', eff(2) === 'retard', eff(2));
  t('retard approuve trop tard = absence', eff(3) === 'absence', eff(3));
  t('retard en attente 45 min = absence', eff(4) === 'absence', eff(4));
  t('absence normale inchangee', eff(5) === 'absence', eff(5));
  t('exclusion inchangee', eff(6) === 'exclusion', eff(6));

  // 2. connexion surveillant (popup Details du signalement)
  const surv = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='surveillant';})[0])"));
  doc.getElementById('login-email').value = surv.email;
  doc.getElementById('login-password').value = surv.password;
  win.connexion();
  t('connexion surveillant', doc.getElementById('page-surveillant').classList.contains('active'), surv.nom);

  const abs_ = id => JSON.parse(win.eval("JSON.stringify(absences.find(function(a){return a.id===" + id + ";}))"));
  const txt = id => doc.getElementById(id).textContent;
  const couleur = () => {
    const sp = doc.getElementById('detail-type').querySelector('span');
    return sp ? sp.style.color : '';
  };

  win.afficherDetailAbsence(abs_(1));
  t('popup retard dans les temps = Retard', txt('detail-type') === 'Retard', txt('detail-type'));
  const palRd = couleur();

  win.afficherDetailAbsence(abs_(4));
  t('popup retard hors delai = Retard -> Absence', txt('detail-type') === 'Retard → Absence', txt('detail-type'));
  const palAbs = couleur();
  t('couleur du type = couleur Absence (plus d orange)', palAbs && palAbs !== palRd, palRd + ' -> ' + palAbs);

  // v3.54 : Heure fusionnee avec Date, pas de duree pour un retard
  t('popup : plus de ligne Heure', doc.getElementById('detail-heure') === null);
  win.afficherDetailAbsence(abs_(1));
  t('popup : Date et Heure sur une ligne ({Date} . {Time})', txt('detail-date') === '11/09/2026 . 09:50', txt('detail-date'));
  t('popup : pas de ligne Duree pour un retard', doc.getElementById('row-duree').style.display === 'none',
    doc.getElementById('row-duree').style.display);
  win.afficherDetailAbsence(abs_(4));
  t('popup : pas de ligne Duree pour un retard converti', doc.getElementById('row-duree').style.display === 'none',
    doc.getElementById('row-duree').style.display);
  win.afficherDetailAbsence(abs_(7));
  t('popup : ligne Duree affichee pour une absence', doc.getElementById('row-duree').style.display === 'flex' && txt('detail-duree') === '1 h',
    doc.getElementById('row-duree').style.display + ' / ' + txt('detail-duree'));

  win.afficherDetailAbsence(abs_(5));
  t('popup absence inchangee', txt('detail-type') === 'Absence', txt('detail-type'));
  win.afficherDetailAbsence(abs_(6));
  t('popup exclusion inchangee', txt('detail-type') === 'Exclusion de cours', txt('detail-type'));

  // 3. historique (fiche eleve) : apres approbation le type est Ab, pas Rd
  win.ouvrirFicheEleve(1, 1);
  const fiche1 = doc.getElementById('fiche-historique').innerHTML;
  const lignes1 = Array.from(doc.querySelectorAll('#fiche-historique > div')).map(d => d.textContent);
  t('fiche eleve 1 : 3 lignes', lignes1.length === 3, lignes1.length);
  t('historique : exactement 2 marques Rd (les 2 retards dans les temps)', lignes1.filter(l => l.indexOf('Rd') >= 0).length === 2,
    lignes1.map(l => (l.indexOf('Rd') >= 0 ? 'Rd' : 'Ab')).join(','));
  t('historique : le retard converti porte Ab', lignes1.some(l => l.indexOf('Ab') >= 0));
  t('historique : approuve tard = Ab + D', lignes1.some(l => l.indexOf('Ab') >= 0 && l.indexOf('Approuvé le') >= 0));
  t('totaux fiche eleve 1 = 1 absence · 2 retards',
    txt('fiche-infos').indexOf('1 absence') >= 0 && txt('fiche-infos').indexOf('2 retards') >= 0, txt('fiche-infos'));
  t('aucun Rd pour l enregistrement converti', (() => {
    const l = lignes1.find(x => x.indexOf('08:00') >= 0 && x.indexOf('09:05') >= 0) || lignes1.find(x => x.indexOf('08:00') >= 0);
    return !l || !/(^|\D)Rd(\D|$)/.test(l);
  })(), lignes1.find(x => x.indexOf('08:00') >= 0));

  // 4. eleve 2 : 3 absences (dont le retard converti), 0 retard
  win.ouvrirFicheEleve(2, 1);
  t('fiche eleve 2 : 3 absences · 0 retards',
    txt('fiche-infos').indexOf('3 absences') >= 0 && txt('fiche-infos').indexOf('0 retard') >= 0, txt('fiche-infos'));
  const lignes2 = Array.from(doc.querySelectorAll('#fiche-historique > div')).map(d => d.textContent);
  t('fiche eleve 2 : aucune marque Rd', !lignes2.some(l => /(^|\D)Rd(\D|$)/.test(l)), lignes2.join(' || '));

  // 5. pas d erreur JS
  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 400);
