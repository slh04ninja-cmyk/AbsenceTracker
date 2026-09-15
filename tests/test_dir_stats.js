// Test jsdom : page Stats du DIRECTEUR (établissement) — v3.34
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const now = new Date();
const H = String(now.getHours()).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const auj = iso(now);
const moisDernier = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const classes = [
  { id: 1, nom: '3eme A', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }, { id: 2, nom: 'Benali', prenom: 'Fatima' }] },
  { id: 2, nom: '3eme B', eleves: [{ id: 3, nom: 'Alami', prenom: 'Youssef' }] }
];
const B = (cl, eid, nom, o) => Object.assign({ classe: cl, eleveId: eid, nom: nom, dateISO: auj, date: '10/09/2026', seance: 'matin', heure: H + ':05', enseignant: 'أيوب الكمرة', matiere: 'Maths', type: 'absence', statut: 'absent' }, o);
const absences = [
  B('3eme A', 1, 'El Amrani Ahmed', { id: 1 }),
  // retard approuve 15 min apres le signalement (heure du signalement = H:05) -> reste un Retard,
  // quel que soit l'heure a laquelle la suite est lancee (piege du passage 23h50 -> 00h10)
  B('3eme A', 1, 'El Amrani Ahmed', { id: 2, type: 'retard', statut: 'justifie_s', justifiePar: 'Surveillant 1', justifieLe: auj + ' ' + H + ':20' }),
  B('3eme A', 2, 'Benali Fatima', { id: 3, seance: 'apres-midi', statut: 'justifie_d', justifiePar: 'Directeur', justifieLe: auj + ' 11:40' }),
  B('3eme B', 3, 'Alami Youssef', { id: 4 }),
  B('3eme B', 3, 'Alami Youssef', { id: 5 }),
  B('3eme A', 1, 'El Amrani Ahmed', { id: 6, dateISO: iso(moisDernier), date: '15/08/2026' })   // mois precedent -> exclu
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
const compte = role => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='" + role + "';})[0])"));
const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };
const clic = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const txt = id => doc.getElementById(id).textContent;

setTimeout(() => {
  // v3.46 : les classes des tableaux de service sont ajoutees automatiquement -> on garde les notres
  win.eval("classes = classes.filter(function(c){ return " + JSON.stringify(['3eme A','3eme B']) + ".indexOf(c.nom) >= 0; });");
  connecter(compte('directeur'));


  // 1. nav : Stats au milieu
  const nav = doc.querySelector('#page-directeur .bottom-nav');
  const items = Array.from(nav.querySelectorAll('.nav-item')).map(n => n.querySelector('span').textContent);
  t('nav du directeur = 5 onglets', items.length === 5, items.join('|'));
  t('Stats est au milieu (3e)', items[2] === 'Stats', items.join('|'));
  t('icone fa-chart-bar au milieu', nav.querySelectorAll('.nav-item')[2].querySelector('i').className.indexOf('fa-chart-bar') > 0);
  t('page stats existe', !!doc.getElementById('page-dir-stats'));

  // 2. affichage de la page
  win.switchDirPage('dir-stats');
  t('page stats active', doc.getElementById('page-dir-stats').classList.contains('active'));

  // 3. AUCUN tableau de service dans ce jeu de donnees : le taux ne peut pas etre calcule.
  //    (le calcul juste est teste dans tests/test_taux.js, qui fournit un tableau de service)
  t('sans tableau de service : le taux affiche « — » et non un faux 0 %',
    txt('dir-stat-presence') === '—', txt('dir-stat-presence'));
  t('et le detail explique pourquoi',
    txt('dir-stat-presence-detail') === '3 élèves · aucune séance due sur la période', txt('dir-stat-presence-detail'));
  t('la barre reste vide', doc.getElementById('dir-progress-presence').style.width === '0%',
    doc.getElementById('dir-progress-presence').style.width);

  // 4. compteurs (le record du mois precedent est exclu)
  const totaux = doc.getElementById('dir-stats-totaux').textContent;
  t('compteurs 4 / 1 / 3', totaux.indexOf('ABSENCES4') >= 0 && totaux.indexOf('RETARDS1') >= 0 && totaux.indexOf('NON JUST.3') >= 0, totaux);

  // 5. la carte du cercle Ab/Rd est supprimee, et les compteurs passent AVANT le taux
  t('carte du cercle Ab/Rd supprimee', doc.getElementById('dir-chart-repartition') === null &&
    doc.getElementById('page-dir-stats').innerHTML.indexOf('Répartition Ab') < 0);
  t('compteurs avant taux de presence', (() => {
    const html = doc.getElementById('page-dir-stats').innerHTML;
    return html.indexOf('id="dir-stats-totaux"') < html.indexOf('id="dir-stat-presence"');
  })());

  // 6. barres par classe : horizontales, nom a gauche, valeur a droite sur la meme ligne
  const lignesCl = Array.from(doc.querySelectorAll('#dir-chart-absences .barre-ligne'));
  const lireCl = l => [l.querySelector('.barre-nom').textContent, l.querySelector('.barre-valeur').textContent,
                       l.querySelector('.barre-remplissage').style.width];
  t('une ligne par classe (3eme A / 3eme B)', lignesCl.length === 2 && lireCl(lignesCl[0])[0] === '3eme A' && lireCl(lignesCl[1])[0] === '3eme B',
    lignesCl.map(l => lireCl(l).join('/')).join(' | '));
  t('valeurs a droite : 3 puis 2', lireCl(lignesCl[0])[1] === '3' && lireCl(lignesCl[1])[1] === '2', lignesCl.map(l => lireCl(l)[1]).join('|'));
  t('remplissage proportionnel (100% / 67%)', lireCl(lignesCl[0])[2] === '100%' && lireCl(lignesCl[1])[2] === '67%', lignesCl.map(l => lireCl(l)[2]).join('|'));
  t('ordre des elements : nom, barre, valeur', Array.from(lignesCl[0].children).map(e => e.className).join(',') === 'barre-nom,barre-piste,barre-valeur',
    Array.from(lignesCl[0].children).map(e => e.className).join(','));
  t('plus de barres verticales (.bar) dans Par classe', doc.querySelectorAll('#dir-chart-absences .bar').length === 0);

  // 7. top eleves cliquable -> fiche
  const top = doc.querySelectorAll('#dir-top-absents > div');
  t('top = 3 eleves', top.length === 3, top.length);
  t('cartes du top = memes cartes que l historique (nom / classe / pastille / chevron)',
    top[0].classList.contains('carte-eleve') && !!top[0].querySelector('.absence-card-name') &&
    !!top[0].querySelector('.absence-card-classe') && !!top[0].querySelector('.carte-eleve-total') &&
    !!top[0].querySelector('.absence-card-icon'), top[0].textContent.trim());
  t('le top affiche la classe (comme l historique)', top[0].querySelector('.absence-card-classe').textContent === '3eme A',
    top[0].querySelector('.absence-card-classe').textContent);
  const cssCompact = doc.querySelector('style').textContent;
  // v3.54 : la regle compacte couvre aussi l'historique de l'enseignant
  t('cartes compactes : regle de role (directeur + surveillant + enseignant) avec height 44 + padding 4px vertical',
    cssCompact.indexOf('body.role-directeur .carte-eleve,') > 0 &&
    cssCompact.indexOf('body.role-surveillant .carte-eleve,') > 0 &&
    cssCompact.indexOf('body.role-enseignant .carte-eleve { height: 44px; padding: 4px 14px; }') > 0);
  t('cartes du top eleves = .carte-eleve, donc compactes en role directeur',
    top[0].classList.contains('carte-eleve') && doc.body.classList.contains('role-directeur'));
  t('1er = le plus signale (2)', top[0].textContent.indexOf('El Amrani Ahmed') >= 0 && top[0].textContent.trim().endsWith('2'), top[0].textContent);
  clic(top[0]);
  t('fiche eleve ouverte depuis le top', !doc.getElementById('modal-fiche-eleve').classList.contains('hidden') &&
    doc.getElementById('fiche-titre').textContent.indexOf('El Amrani') >= 0, doc.getElementById('fiche-titre').textContent);
  // 7bis. marques simples + ligne d approbation (datetime a gauche, code a droite)
  const fiche = doc.getElementById('fiche-historique');
  const marques = Array.from(fiche.querySelectorAll('span')).map(e => e.textContent).filter(x => x === 'Rd' || x === 'Ab');
  t('marque redevenue simple (Rd sans code)', fiche.innerHTML.indexOf('Rd - S1') < 0 && fiche.innerHTML.indexOf('Ab - D') < 0 && marques.length === 3,
    marques.join('|'));
  const ddmm = auj.slice(8, 10) + '/' + auj.slice(5, 7) + '/' + auj.slice(0, 4);
  t('ligne d approbation : datetime + S1 a droite',
    fiche.innerHTML.indexOf('Approuvé le ' + ddmm + ' · ' + H + ':20') > 0 && fiche.innerHTML.indexOf('>S1<') > 0,
    'attendu : Approuvé le ' + ddmm + ' · ' + H + ':20');
  const spans = Array.from(fiche.querySelectorAll('span'));
  const spDate = spans.find(e => e.textContent.indexOf('Approuvé le') >= 0);
  const spCode = spans.find(e => e.textContent === 'S1');
  t('datetime et code dans la meme ligne, code a droite',
    !!spDate && !!spCode && spDate.parentElement === spCode.parentElement &&
    spDate.parentElement.className.indexOf('justify-between') >= 0 &&
    spDate.parentElement.lastElementChild === spCode,
    spDate && spCode ? spDate.textContent + ' | ' + spCode.textContent : 'introuvable');
  const ficheHtml2 = fiche.innerHTML;
  const iApprob = ficheHtml2.indexOf('Approuvé le');
  const iInfo = ficheHtml2.indexOf('MATH ·', iApprob);
  t('ligne « Approuvé le » juste apres la datetime, avant la ligne info',
    iApprob > 0 && iInfo > iApprob && (iInfo - iApprob) < 220, iApprob + ' -> ' + iInfo);
  t('plus d icone dans la ligne d approbation', ficheHtml2.indexOf('fa-check-circle') < 0);
  win.fermerFicheEleve();

  // 8. filtre Type = retards
  doc.getElementById('dir-stats-type').value = 'retard';
  win.changerFiltreStatsDir();
  const tot2 = doc.getElementById('dir-stats-totaux').textContent;
  t('filtre retards : 0 Ab / 1 Rd', tot2.indexOf('ABSENCES0') >= 0 && tot2.indexOf('RETARDS1') >= 0, tot2);
  t('par classe suit le filtre (3eme A=1, 3eme B=0)',
    Array.from(doc.querySelectorAll('#dir-chart-absences .barre-valeur')).map(e => e.textContent).join('|') === '1|0',
    Array.from(doc.querySelectorAll('#dir-chart-absences .barre-valeur')).map(e => e.textContent).join('|'));
  t('la barre d une classe a 0 n est pas remplie',
    doc.querySelectorAll('#dir-chart-absences .barre-ligne')[1].querySelector('.barre-remplissage').style.width === '0%',
    doc.querySelectorAll('#dir-chart-absences .barre-ligne')[1].querySelector('.barre-remplissage').style.width);

  // 9. periode personnalisee : les champs de date apparaissent
  doc.getElementById('dir-stats-type').value = 'tous';
  doc.getElementById('dir-stats-periode').value = 'perso';
  win.changerFiltreStatsDir();
  t('champs de dates affiches en mode perso', doc.getElementById('dir-stats-dates').style.display === 'grid',
    doc.getElementById('dir-stats-dates').style.display);

  // 10. retour au mois : tout revient
  doc.getElementById('dir-stats-periode').value = 'mois';
  win.changerFiltreStatsDir();
  t('retour au mois : 4 absences et le taux toujours non calculable',
    txt('dir-stat-presence') === '—' && doc.getElementById('dir-stats-totaux').textContent.indexOf('ABSENCES4') >= 0,
    txt('dir-stat-presence') + ' / ' + doc.getElementById('dir-stats-totaux').textContent.slice(0, 40));

  // 10bis. la meme fiche pour l'enseignant (compte de la matiere concernee : أيوب الكمرة)
  const profMath = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.email==='math-prof1@taalim.ma';})[0])"));
  connecter(profMath);
  win.ouvrirFicheEleveParNom('El Amrani Ahmed', '3eme A');
  t('fiche enseignant : ligne d approbation presente',
    doc.getElementById('fiche-historique').innerHTML.indexOf('Approuvé le ' + (auj.slice(8, 10) + '/' + auj.slice(5, 7) + '/' + auj.slice(0, 4)) + ' · ' + H + ':20') > 0 &&
    doc.getElementById('fiche-historique').innerHTML.indexOf('Rd - S1') < 0,
    doc.getElementById('fiche-titre').textContent);
  win.fermerFicheEleve();

  // 10ter. tendance dynamique selon la periode
  const barsT = () => Array.from(doc.querySelectorAll('#dir-chart-tendance .bar')).map(b => {
    const v = b.querySelector('.bar-value').textContent, l = b.querySelector('.bar-label').textContent;
    return l + '=' + v;
  });
  const titre = () => doc.getElementById('dir-tendance-titre').textContent;
  const somme = () => Array.from(doc.querySelectorAll('#dir-chart-tendance .bar-value')).reduce((a, b) => a + parseInt(b.textContent, 10), 0);

  doc.getElementById('dir-stats-periode').value = 'mois';
  win.changerFiltreStatsDir();
  const nbJoursMois = now.getDate();                        // du 1er du mois a aujourd'hui
  t('mois -> Tendance Mensuel : 1 barre par jour', titre() === 'Tendance Mensuel' && barsT().length === nbJoursMois,
    titre() + ' — ' + barsT().length + ' barres / ' + nbJoursMois + ' jours');
  t('mois -> total = 5 signaux', somme() === 5, String(somme()));

  doc.getElementById('dir-stats-periode').value = 'jour';
  win.changerFiltreStatsDir();
  t('jour -> Tendance Journalier : 1 barre par heure', titre() === 'Tendance Journalier' && barsT().join('|') === H + 'h=5',
    titre() + ' — ' + barsT().join('|'));

  doc.getElementById('dir-stats-periode').value = 'semaine';
  win.changerFiltreStatsDir();
  const noms = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const jourSem = noms[(now.getDay() + 6) % 7];
  t('semaine -> Tendance Hebdomadaire : 7 jours',
    titre() === 'Tendance Hebdomadaire' && barsT().length === 7, titre() + ' — ' + barsT().join('|'));
  t('semaine -> le total est sur le jour courant (' + jourSem + ')', barsT().includes(jourSem + '=5'), barsT().join('|'));
  t('semaine -> total = 5', somme() === 5, String(somme()));

  doc.getElementById('dir-stats-periode').value = 'trimestre';
  win.changerFiltreStatsDir();
  t('trimestre -> Tendance Trimestriel : barres S1, S2...',
    titre() === 'Tendance Trimestriel' && barsT().length > 0 && barsT()[0].indexOf('S1=') === 0, titre() + ' — ' + barsT().join('|'));
  t('trimestre -> total = 6 (5 aujourd hui + 1 le mois dernier, dans le trimestre)', somme() === 6, String(somme()));

  doc.getElementById('dir-stats-periode').value = 'perso';
  win.changerFiltreStatsDir();
  t('personnalisee -> Tendance Personnalisée', titre() === 'Tendance Personnalisée', titre());

  doc.getElementById('dir-stats-periode').value = 'mois';
  win.changerFiltreStatsDir();

  // 10quater. Dashboard allege
  const dash = doc.getElementById('page-directeur');
  t('Dashboard : plus d Alertes ni Classes critiques ni Tendance',
    dartMissing(dash));
  function dartMissing(d) {
    return d.innerHTML.indexOf('Alertes importantes') < 0 && d.innerHTML.indexOf('Classes critiques') < 0 &&
      d.innerHTML.indexOf('dir-alerts') < 0 && d.innerHTML.indexOf('dir-critical-classes') < 0 &&
      d.innerHTML.indexOf('dir-tendance') < 0 &&
    // v3.66 : une seule carte est ajoutee au Dashboard (liste des seances annulees)
    d.querySelectorAll('.stat-card').length === 1 && !!d.querySelector('#seances-annulees-card');
  }
  t('Dashboard : carte du haut + liste des absents conserves',
    !!dash.querySelector('.stat-card-absences') && !!dash.querySelector('#dir-absences-list') &&
    dash.querySelector('#dir-absences-list').querySelectorAll('.absence-card').length === 4,
    dash.querySelector('#dir-absences-list').querySelectorAll('.absence-card').length + ' (3 aujourd hui + 1 du mois dernier, v3.41)');

  // 11. regression : la page Stats de l'enseignant fonctionne toujours
  win.choisirClasse(1);
  win.afficherStatistiques();
  t('stats enseignant toujours OK (bloc rempli)', txt('stat-presence') !== '' && txt('stat-presence-detail') !== '',
    txt('stat-presence') + ' / ' + txt('stat-presence-detail'));
  // ce jeu de donnees n'a pas de tableau de service -> le taux n'est pas calculable
  t('stats enseignant : taux « — » sans tableau de service (jamais un faux chiffre)',
    txt('stat-presence') === '—' && txt('stat-presence-detail').indexOf('aucune séance due') >= 0,
    txt('stat-presence') + ' / ' + txt('stat-presence-detail'));
  t('stats enseignant : compteurs remplis', doc.getElementById('stats-totaux').textContent.indexOf('ABSENCES') >= 0);

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
}, 400);
