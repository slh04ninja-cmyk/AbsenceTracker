// Test jsdom : la carte du directeur affiche LES MEMES donnees que celle du surveillant
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const now = new Date();
const H = String(now.getHours()).padStart(2, '0');           // heure actuelle
const autre = H === '07' ? '06' : '07';                       // heure differente
const jour = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(now);
const classe = { id: 1, nom: '3eme A', eleves: [{ id: 1, nom: 'Test', prenom: 'Eleve' }] };
const A = (heure, statut, type) => ({ id: Math.random().toString(36).slice(2), eleveId: 1, classe: '3eme A', nom: 'Test Eleve', type: type || 'absence', statut, dateISO: jour, seance: 'matin', heure, enseignant: 'أيوب الكمرة' });
const absences = [
  A(H + ':05', 'absent'), A(H + ':20', 'absent'), A(H + ':35', 'justifie_s'), A(H + ':40', 'absent', 'retard'),
  A(autre + ':10', 'absent'), A(autre + ':50', 'justifie_d')
];
const attendus = {
  nouveau: absences.filter(a => a.heure.startsWith(H)).length,          // 4
  nonJust: absences.filter(a => a.statut === 'absent').length,          // 4
  total: absences.length                                                // 6
};

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
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

setTimeout(() => {
  const compte = role => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='" + role + "';})[0])"));
  const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };

  connecter(compte('directeur'));
  const dir = {
    nouveau: doc.getElementById('dir-nouveaux').textContent,
    nonJust: doc.getElementById('dir-nonjustifiees').textContent,
    total: doc.getElementById('dir-total').textContent
  };
  const labels = Array.from(doc.getElementById('page-directeur').querySelectorAll('.absence-label')).map(e => e.textContent).join('/');
  const subs = Array.from(doc.getElementById('page-directeur').querySelectorAll('.absence-subtext')).map(e => e.textContent).join('/');
  const carte = doc.getElementById('page-directeur').querySelector('.stat-card-absences');
  t('carte = design du surveillant, en 1re position',
    !!carte && doc.getElementById('page-directeur').querySelector('.page-content .p-4').firstElementChild.classList.contains('stat-card-absences'));
  t('3 blocs + 2 separateurs', carte.querySelectorAll('.absence-item').length === 3 && carte.querySelectorAll('.absence-divider').length === 2);
  t('valeurs en .absence-value (blanches sur le degrade)',
    doc.getElementById('dir-nouveaux').classList.contains('absence-value') && doc.getElementById('dir-total').classList.contains('absence-value'));
  t('ancienne grille de mini-cartes supprimee',
    doc.getElementById('page-directeur').querySelectorAll('.stat-mini').length === 0);
  t('libelles identiques au surveillant', labels === 'Nouveau/Non justifiée/Total' && subs === "heure actuelle/aujourd'hui/du jour", labels + '  |  ' + subs);
  t('donnees directeur = attendues',
    dir.nouveau == attendus.nouveau && dir.nonJust == attendus.nonJust && dir.total == attendus.total,
    'nouveau=' + dir.nouveau + ' nonjust=' + dir.nonJust + ' total=' + dir.total + ' (attendus ' + attendus.nouveau + '/' + attendus.nonJust + '/' + attendus.total + ')');

  connecter(compte('surveillant'));
  const surv = {
    nouveau: doc.getElementById('surv-nouveaux').textContent,
    nonJust: doc.getElementById('surv-total-unjustified').textContent,
    total: doc.getElementById('surv-total-absents').textContent
  };
  t('surveillant : memes valeurs', surv.nouveau == dir.nouveau && surv.nonJust == dir.nonJust && surv.total == dir.total,
    'surveillant ' + surv.nouveau + '/' + surv.nonJust + '/' + surv.total + ' vs directeur ' + dir.nouveau + '/' + dir.nonJust + '/' + dir.total);
  const labS = Array.from(doc.getElementById('page-surveillant').querySelectorAll('.absence-label')).map(e => e.textContent).join('/');
  const subS = Array.from(doc.getElementById('page-surveillant').querySelectorAll('.absence-subtext')).map(e => e.textContent).join('/');
  t('libelles surveillant inchanges', labS === 'NOUVEAU/NON JUSTIFIÉE/TOTAL', labS);
  t('la carte surveillant garde ses sous-textes', subS === "heure actuelle/aujourd'hui/du jour", subS);

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 4).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
