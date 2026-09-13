// Test jsdom : liste des absents + popup sur le Dashboard DIRECTEUR (v3.30)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const now = new Date();
const H = String(now.getHours()).padStart(2, '0');
const jour = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
const classe = { id: 1, nom: '3eme A', eleves: [{ id: 1, nom: 'A', prenom: 'A' }, { id: 2, nom: 'B', prenom: 'B' }] };
const A = (o) => Object.assign({ id: 'a' + Math.random().toString(36).slice(2), classe: '3eme A', type: 'absence', statut: 'absent', dateISO: jour, seance: 'matin', heure: H + ':10', enseignant: 'أيوب الكمرة', eleveId: 1, nom: 'El Amrani Ahmed' }, o);
const absences = [
  A({}),                                                                             // absent, eleve 1
  A({ id: 'b1', eleveId: 2, nom: 'Benali Fatima' }),                                 // absent, eleve 2
  A({ id: 'c1', statut: 'justifie_s', motif: 'Maladie' }),                           // justifie
  A({ id: 'd1', type: 'retard', statut: 'absent', eleveId: 3, nom: 'Alami Youssef' })// retard non justifie
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('classes', JSON.stringify([classe]));
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
const compte = role => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='" + role + "';})[0])"));
const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };

setTimeout(() => {
  connecter(compte('directeur'));

  const liste = doc.getElementById('dir-absences-list');
  t('la div de liste existe sous la carte du directeur', !!liste);
  // v3.63 : plus de bouton d'annulation sur le Dashboard (deplace dans la rubrique RH)
  t('la div est juste sous la carte (sans bouton d annulation)',
    (() => {
      const enf = Array.from(doc.getElementById('page-directeur').querySelector('.page-content .p-4').children);
      const i = enf.findIndex(e => e.id === 'dir-absences-list');
      // v3.66 : carte absences, puis carte "Séances annulées", puis la liste des absents
      return i === 2 && enf[0].className.indexOf('stat-card-absences') >= 0 && enf[1].id === 'seances-annulees-card';
    })(),
    Array.from(doc.getElementById('page-directeur').querySelector('.page-content .p-4').children).map(e => e.id || e.className).join(' | '));
  t('3 cartes d absents (non justifies du jour)', liste.querySelectorAll('.absence-card').length === 3,
    liste.querySelectorAll('.absence-card').length);
  t('meme habillage que le surveillant (carte-eleve)',
    Array.from(liste.querySelectorAll('.absence-card')).every(c => c.classList.contains('carte-eleve')) &&
    liste.querySelector('.absence-card-name').textContent === 'El Amrani Ahmed',
    liste.querySelector('.absence-card-name').textContent + ' / ' + liste.querySelector('.absence-card-classe').textContent);

  // popup partage
  clic(liste.querySelectorAll('.absence-card')[0]);
  const modal = doc.getElementById('modal-absence-detail');
  t('popup ouvert au clic sur une carte', !modal.classList.contains('hidden'));
  // v3.55 : le nom complet passe en titre (centre) et la ligne Eleve devient le numero dans la liste
  t('popup : titre = nom complet de l eleve', doc.getElementById('detail-titre').textContent === 'El Amrani Ahmed',
    doc.getElementById('detail-titre').textContent);
  t('popup : titre centre', doc.getElementById('detail-titre').className.indexOf('text-center') >= 0,
    doc.getElementById('detail-titre').className);
  t('popup : ligne Numero (rang dans la liste)', doc.getElementById('detail-numero').textContent === '1',
    doc.getElementById('detail-numero').textContent);
  t('popup rempli (numero / classe)', doc.getElementById('detail-classe').textContent === '3eme A',
    doc.getElementById('detail-classe').textContent);
  t('popup : plus d icone dans Motif de justification',
    doc.querySelector('#bloc-motif .motif-icone') === null && doc.querySelector('#bloc-motif i') === null);
  t('bloc motif visible (absence non justifiee)', doc.getElementById('bloc-motif').style.display === 'block');

  // justification par le DIRECTEUR depuis le popup
  clic(doc.querySelectorAll('#chips-motif .motif-chip')[3]);           // Transport
  t('motif choisi dans les chips', doc.getElementById('select-motif').value === 'Transport', doc.getElementById('select-motif').value);
  clic(doc.getElementById('btn-justifier-absence'));
  t('popup referme apres justification', doc.getElementById('modal-absence-detail').classList.contains('hidden'));
  const justifieD = JSON.parse(win.eval("JSON.stringify(absences.filter(function(a){return a.statut==='justifie_d';}))"));
  t('statut = Justifiee D (et non S)', justifieD.length === 1, justifieD.length + ' enregistrement(s)');
  t('motif = celui des chips, justifie par = Directeur',
    justifieD[0] && justifieD[0].motif === 'Transport' && justifieD[0].justifiePar === 'Directeur',
    justifieD[0] && (justifieD[0].motif + ' / ' + justifieD[0].justifiePar));
  t('carte retiree de la liste', doc.getElementById('dir-absences-list').querySelectorAll('.absence-card').length === 2,
    doc.getElementById('dir-absences-list').querySelectorAll('.absence-card').length);
  t('compteur non justifiees mis a jour', doc.getElementById('dir-nonjustifiees').textContent === '2', doc.getElementById('dir-nonjustifiees').textContent);
  t('localStorage enregistre', win.localStorage.getItem('absences').indexOf('justifie_d') > 0);

  // surveillance : la source reste 'surv' (Justifiee S)
  connecter(compte('surveillant'));
  const l2 = doc.getElementById('surv-absences-list');
  t('surveillant : meme liste (2 cartes restantes)', l2.querySelectorAll('.absence-card').length === 2,
    l2.querySelectorAll('.absence-card').length);
  t('surveillant : memes valeurs de carte', doc.getElementById('surv-nouveaux').textContent === doc.getElementById('dir-nouveaux').textContent &&
    doc.getElementById('surv-total-unjustified').textContent === doc.getElementById('dir-nonjustifiees').textContent &&
    doc.getElementById('surv-total-absents').textContent === doc.getElementById('dir-total').textContent,
    doc.getElementById('surv-nouveaux').textContent + '/' + doc.getElementById('surv-total-unjustified').textContent + '/' + doc.getElementById('surv-total-absents').textContent);
  clic(l2.querySelectorAll('.absence-card')[0]);
  clic(doc.getElementById('btn-justifier-absence'));
  const justifieS = JSON.parse(win.eval("JSON.stringify(absences.filter(function(a){return a.statut==='justifie_s' && a.justifiePar==='Surveillant 1';}))"));
  t('surveillant : statut Justifiee S conserve', justifieS.length === 1, justifieS.length);

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
