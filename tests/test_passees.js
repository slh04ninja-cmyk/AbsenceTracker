// Test jsdom : absents NON JUSTIFIES des jours precedents (v3.42)
// - Dashboard directeur ET surveillant : aujourd'hui + jours precedents, dates affichees,
//   clic -> popup de signalement (justifiable)
// - Dashboard enseignant : inchange (bloc supprime)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const now = new Date();
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const J0 = iso(now);
const h1 = new Date(now); h1.setDate(h1.getDate() - 1);
const h3 = new Date(now); h3.setDate(h3.getDate() - 3);
const J1 = iso(h1), J3 = iso(h3);
const ddmm = isoStr => isoStr.slice(8, 10) + '/' + isoStr.slice(5, 7);

const classes = [{ id: 1, nom: '3eme A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] }];
const B = (o) => Object.assign({ id: 'r' + Math.random().toString(36).slice(2), classe: '3eme A', dateISO: J0, date: '01/01/2026', seance: 'matin', heure: '08:00', type: 'absence', statut: 'absent', matiere: 'Maths', enseignant: 'أيوب الكمرة' }, o);
const absences = [
  B({ id: 'a1', eleveId: 1, nom: 'El Amrani Ahmed' }),                                              // aujourd'hui, maths
  B({ id: 'a2', eleveId: 2, nom: 'Benali Fatima', enseignant: 'كمال الوردي', matiere: 'SVT' }),        // aujourd'hui, SVT
  B({ id: 'a3', eleveId: 1, nom: 'El Amrani Ahmed', dateISO: J1, date: '30/09/2026' }),              // hier, maths
  B({ id: 'a4', eleveId: 2, nom: 'Benali Fatima', dateISO: J3, date: '28/09/2026' }),                // il y a 3 jours, maths
  B({ id: 'a5', eleveId: 1, nom: 'El Amrani Ahmed', dateISO: J1, date: '30/09/2026', statut: 'justifie_s', justifiePar: 'Surveillant 1', justifieLe: J1 + ' 09:00' })  // justifie -> jamais affiche
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('absences', JSON.stringify(absences));
    win.localStorage.setItem('testHistoGenere_v1', '1');
    win.localStorage.setItem('testHistoGenere_v2', '1');
    win.localStorage.setItem('testHistoGenere_v3', '1');
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const clic = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const compteMail = mail => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='" + mail + "';})[0])"));
const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };

setTimeout(() => {
  // ---------- DIRECTEUR ----------
  connecter(compteMail('d@taalim.ma'));
  const cartes = Array.from(doc.querySelectorAll('#dir-absences-list .absence-card'));
  t('directeur : 4 cartes (2 aujourd hui + hier + il y a 3 jours)', cartes.length === 4, cartes.length);
  t('directeur : les jours precedents portent leur date (hier puis J-3)',
    cartes[2].querySelector('.absence-card-classe').textContent === '3eme A · ' + ddmm(J1) &&
    cartes[3].querySelector('.absence-card-classe').textContent === '3eme A · ' + ddmm(J3),
    cartes.map(c => c.querySelector('.absence-card-classe').textContent).join(' ; '));
  t('directeur : une seule carte pour hier (le justifie du meme eleve/jour est exclu)',
    cartes.filter(c => c.querySelector('.absence-card-classe').textContent.indexOf(ddmm(J1)) > 0).length === 1);
  clic(cartes[3]);
  t('directeur : clic sur une carte d un jour precedent -> popup de signalement justifiable',
    !doc.getElementById('modal-absence-detail').classList.contains('hidden') &&
    doc.getElementById('detail-titre').textContent === 'Benali Fatima' &&
    doc.getElementById('btn-justifier-absence').style.display === 'block',
    doc.getElementById('detail-titre').textContent + ' / ' + doc.getElementById('detail-date').textContent);
  win.fermerDetailAbsence();

  // ---------- SURVEILLANT (desormais identique au directeur) ----------
  connecter(compteMail('s1@taalim.ma'));
  const cartesSurv = Array.from(doc.querySelectorAll('#surv-absences-list .absence-card'));
  t('surveillant : 4 cartes (aujourd hui + jours precedents)', cartesSurv.length === 4, cartesSurv.length);
  t('surveillant : dates sur les cartes des jours precedents',
    cartesSurv[2].querySelector('.absence-card-classe').textContent === '3eme A · ' + ddmm(J1) &&
    cartesSurv[3].querySelector('.absence-card-classe').textContent === '3eme A · ' + ddmm(J3),
    cartesSurv.map(c => c.querySelector('.absence-card-classe').textContent).join(' ; '));
  t('surveillant : il voit tout (le signalement SVT aussi)',
    cartesSurv.some(c => c.querySelector('.absence-card-name').textContent === 'Benali Fatima' && c.querySelector('.absence-card-classe').textContent.indexOf(' · ') < 0));
  clic(cartesSurv[2]);
  t('surveillant : clic -> popup de signalement justifiable',
    !doc.getElementById('modal-absence-detail').classList.contains('hidden') &&
    doc.getElementById('btn-justifier-absence').style.display === 'block' &&
    doc.getElementById('detail-titre').textContent === 'El Amrani Ahmed');
  win.fermerDetailAbsence();
  const compteurs = [doc.getElementById('surv-nouveaux').textContent, doc.getElementById('surv-total-unjustified').textContent, doc.getElementById('surv-total-absents').textContent];
  t('surveillant : la carte du haut reste sur le jour (2 total du jour)', compteurs[2] === '2', compteurs.join('/'));

  // ---------- ENSEIGNANT (inchange : plus de bloc « jours precedents ») ----------
  connecter(compteMail('math-prof1@taalim.ma'));
  t('enseignant : aucun bloc d absences passees (demande annulee)',
    doc.getElementById('ens-absences-passees') === null &&
    doc.getElementById('page-enseignant').innerHTML.indexOf('jours précédents') < 0);
  t('enseignant : la page de saisie reste intacte', !!doc.getElementById('select-classe') && !!doc.getElementById('zone-prise-absence'));

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
