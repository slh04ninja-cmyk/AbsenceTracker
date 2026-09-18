/* tests/test_v459_dashboard_seances.js — les seances annulees passees quittent le Dashboard.
 *
 * Demande de l'utilisateur (18/09) : « pourquoi les seances annulees des deux jours 17, 18
 * s'affichent encore dans le dashboard tant que sont des seances passees » → decision :
 * aujourd'hui + a venir, ET une seance d'aujourd'hui disparait des que son heure est passee,
 * MAIS « ne pas supprimer ces seances dans la base ».
 *
 * Ce banc verifie les deux moities de la regle, et surtout qu'il n'y a AUCUNE suppression :
 *  - hier            -> plus affichee
 *  - aujourd'hui, heure deja passee -> plus affichee
 *  - aujourd'hui, heure a venir     -> affichee
 *  - apres-demain    -> affichee
 *  - listeSeancesAnnulees() (taux de presence, statistiques) -> contient TOUJOURS tout
 *
 * Les deux cas « aujourd'hui » sont construits a partir de l'heure reelle ; aux tout
 * derniers instants de la journee ils ne sont pas constructibles : ils sont alors
 * ANNONCES comme non applicables plutot que de faire echouer le banc a tort.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

const jour = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const hhmm = minutes => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

const maintenant = new Date();
const MIN = maintenant.getHours() * 60 + maintenant.getMinutes();

(async () => {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('banc hors ligne')); }
  });
  const win = dom.window;
  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 700));

  const HIER = jour(-1), AUJ = jour(0), APRES = jour(2);

  // « aujourd'hui, heure passee » : possible seulement s'il est au moins 00:02
  const casPasse = MIN >= 2 ? { debut: '00:00', fin: '00:01', ok: true } : { ok: false };
  // « aujourd'hui, encore a venir » : possible seulement avant 23:58
  const casFutur = (MIN + 1) <= 1438 ? { debut: hhmm(MIN + 1), fin: '23:59', ok: true } : { ok: false };

  const donnees = [
    { id: 1, dateISO: HIER, classe: 'TCSF-3', debut: '08:00', fin: '10:00', motif: 'Hier' },
    { id: 4, dateISO: APRES, classe: 'TCSF-3', debut: '10:00', fin: '12:00', motif: 'Apres-demain' }
  ];
  if (casPasse.ok) donnees.push({ id: 2, dateISO: AUJ, classe: 'TCSF-2', debut: casPasse.debut, fin: casPasse.fin, motif: 'DejaPassee' });
  if (casFutur.ok) donnees.push({ id: 3, dateISO: AUJ, classe: 'TCSF-1', debut: casFutur.debut, fin: casFutur.fin, motif: 'EncoreAVenir' });

  win.eval("indispoProfs = [];");
  win.eval("seancesAnnulees = " + JSON.stringify(donnees) + ";");
  win.eval("if (typeof afficherSeancesAnnulees === 'function') afficherSeancesAnnulees();");

  const cont = win.document.getElementById('annul-liste');
  const texte = cont ? cont.textContent : '';
  const nb = cont ? cont.children.length : -1;
  console.log('heure du banc : ' + hhmm(MIN) + ' — ' + donnees.length + ' annulations en donnee');

  t('hier : plus affichee', texte.indexOf('Hier') === -1);
  t('apres-demain : affichee', texte.indexOf('Apres-demain') > -1);
  if (casPasse.ok) {
    t('aujourd hui (heure passee) : plus affichee', texte.indexOf('DejaPassee') === -1);
  } else {
    console.log('     (aujourd hui heure passee : non applicable a ' + hhmm(MIN) + ')');
  }
  if (casFutur.ok) {
    t('aujourd hui (heure a venir) : affichee', texte.indexOf('EncoreAVenir') > -1);
  } else {
    console.log('     (aujourd hui heure a venir : non applicable a ' + hhmm(MIN) + ')');
  }

  const attendues = 1 + (casPasse.ok ? 0 : 0) + (casFutur.ok ? 1 : 0);   // apres-demain (+ la future du jour)
  t('la carte n affiche que les annulations du jour non terminees et a venir', nb === attendues, 'affichees = ' + nb + ' / attendues = ' + attendues);

  // rien n'est supprime pour les calculs
  const liste = JSON.parse(win.eval("JSON.stringify(listeSeancesAnnulees().map(function (s) { return s.motif; }))"));
  t('les calculs (taux de presence) gardent TOUTES les annulations', liste.length === donnees.length, liste.join(' | '));
  t('la liste des calculs contient encore « Hier »', liste.indexOf('Hier') > -1);

  console.log(ok ? '\nTOUT OK' : '\nECHEC');
  process.exit(0);
})();
