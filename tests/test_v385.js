// test_v385.js — cascade d'ouverture de la FICHE ÉLÈVE (cartes, lignes, boutons)
//  - l'en-tête, la carte infos, la carte historique puis les BOUTONS entrent l'un après l'autre
//  - les lignes de l'historique montent une par une (délai croissant, plafonné)
//  - les boutons sont INERTES tant qu'ils sont invisibles (pas d'appui à l'aveugle)
//  - l'animation se rejoue à chaque ouverture, et rien ne fuit sur les autres popups
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [{ id: 1, nom: 'TCSF-2', eleves: [{ id: 7, massar: 'M100', nom: 'El Mansouri', prenom: 'Aya', nomFr: 'El Mansouri' }] }];
// 13 incidents : 8 absences + 5 retards (assez pour vérifier le plafond des délais)
const absences = [];
for (let i = 0; i < 13; i++) {
  const retard = i % 3 === 2;
  absences.push({
    id: 100 + i, eleveId: 7, nom: 'El Mansouri Aya', classe: 'TCSF-2',
    date: String(2 + i).padStart(2, '0') + '/09/2026', dateISO: '2026-09-' + String(2 + i).padStart(2, '0'),
    heure: '0' + (8 + (i % 3)) + ':05', seance: i % 2 ? 'soir' : 'matin',
    type: retard ? 'retard' : 'absence', duree: '',
    statut: i % 2 ? 'absent' : 'justifie_s', justifiePar: i % 2 ? '' : 'S1',
    justifieLe: i % 2 ? '' : '2026-09-' + String(2 + i).padStart(2, '0') + ' 08:30',
    motif: ['Maladie', 'Transport', 'Raison familiale'][i % 3],
    enseignant: 'أيوب الكمرة', matiere: 'MATH'
  });
}

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', JSON.stringify(absences));
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const fiche = () => doc.getElementById('modal-fiche-eleve');
const blocs = () => Array.from(fiche().querySelectorAll('.fiche-anim'));
const lignes = () => Array.from(doc.getElementById('fiche-historique').children);
const regle = (sel) => {
  let trouvee = null;
  Array.from(doc.styleSheets).forEach(f => {
    try { Array.from(f.cssRules || []).forEach(r => { if (r.selectorText === sel) trouvee = r; }); } catch (e) {}
  });
  return trouvee;
};
const cle = (nom) => {
  let trouvee = null;
  Array.from(doc.styleSheets).forEach(f => {
    try { Array.from(f.cssRules || []).forEach(r => { if (r.type === 7 && r.name === nom) trouvee = r; }); } catch (e) {}
  });
  return trouvee;
};

setTimeout(async () => {
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();

  // ---- ouverture de la fiche ----
  win.ouvrirFicheEleve(7, 1);
  t('la fiche est ouverte', !fiche().classList.contains('hidden'));
  t('titre = nom de l élève', doc.getElementById('fiche-titre').textContent === 'El Mansouri Aya',
    doc.getElementById('fiche-titre').textContent);

  // ---- 1. les 4 blocs en cascade ----
  t('4 blocs animés dans la fiche (en-tête, infos, historique, pied)', blocs().length === 4, blocs().length);
  t('en-tête en premier (cascade-1)', blocs()[0].classList.contains('cascade-1'));
  t('carte infos en 2e (cascade-2)', blocs()[1].classList.contains('cascade-2'));
  t('carte historique en 3e (cascade-3)', blocs()[2].classList.contains('cascade-3'));
  t('pied de page en 4e (cascade-4)', blocs()[3].classList.contains('cascade-4'));
  t('le pied contient bien Fermer et Exporter',
    blocs()[3].querySelectorAll('button').length === 2 &&
    blocs()[3].textContent.indexOf('Fermer') >= 0 && blocs()[3].textContent.indexOf('Exporter') >= 0);
  t('les cartes animées sont bien les cartes de la fiche',
    blocs()[1].querySelector('#fiche-infos') !== null && blocs()[2].querySelector('#fiche-historique') !== null);

  // ---- 1bis. GARDE-FOU : aucun bloc ne doit porter un nom d'icône Font Awesome ----
  // (fa-1 … fa-9 sont les icônes « chiffres » : elles affichaient 1, 2, 3, 4 devant les blocs)
  const fauxIcones = blocs().map(b => Array.from(b.classList).filter(c => /^fa-[a-z0-9-]+$/.test(c))).flat();
  t('aucun bloc ne porte un nom d icône Font Awesome', fauxIcones.length === 0, fauxIcones.join(','));
  t('les délais utilisent bien les classes cascade-1…4',
    [1, 2, 3, 4].every(n => regle('#modal-fiche-eleve .fiche-anim.cascade-' + n)));
  t('plus aucune classe fa-<chiffre> dans la fiche',
    doc.querySelectorAll('#modal-fiche-eleve [class*="fa-1"], #modal-fiche-eleve [class*="fa-2"], #modal-fiche-eleve [class*="fa-3"], #modal-fiche-eleve [class*="fa-4"]').length === 0);

  // ---- 2. le CSS fait bien monter les blocs ----
  const rBloc = regle('#modal-fiche-eleve .fiche-anim');
  t('règle CSS du bloc animé présente', !!rBloc);
  t('les blocs partent invisibles (opacity 0)', !!rBloc && rBloc.style.opacity === '0', rBloc && rBloc.style.opacity);
  t('animation « ficheMonte » avec conservation de l état final',
    !!rBloc && rBloc.style.animation.indexOf('ficheMonte') >= 0 && rBloc.style.animation.indexOf('forwards') >= 0,
    rBloc && rBloc.style.animation);
  t('les blocs sont INERTES pendant l animation (pointer-events: none)',
    !!rBloc && rBloc.style.pointerEvents === 'none', rBloc && rBloc.style.pointerEvents);
  const rPret = regle('#modal-fiche-eleve .fiche-anim.pret');
  t('ils redeviennent cliquables une fois l animation finie', !!rPret && rPret.style.pointerEvents === 'auto',
    rPret && rPret.style.pointerEvents);
  const kf = cle('ficheMonte');
  t('les images clés « ficheMonte » existent', !!kf);

  // ---- 3. délais croissants ----
  const delai = c => parseFloat(regle('#modal-fiche-eleve .fiche-anim.' + c).style.animationDelay);
  const d1 = delai('cascade-1'), d2 = delai('cascade-2'), d3 = delai('cascade-3'), d4 = delai('cascade-4');
  t('délais croissants : ' + [d1, d2, d3, d4].join(' < '), d1 < d2 && d2 < d3 && d3 < d4, [d1, d2, d3, d4].join('/'));
  t('le pied de page arrive en dernier (et non à 0.9 s comme la maquette)',
    d4 >= 0.2 && d4 <= 0.5, d4);

  // ---- 4. les lignes de l'historique montent une par une ----
  const ls = lignes();
  t('les 13 incidents sont listés', ls.length === 13, ls.length);
  t('chaque ligne porte la classe animée', ls.every(l => l.classList.contains('fiche-ligne')));
  const ld = ls.map(l => parseFloat(l.style.animationDelay));
  t('premier délai de ligne posé', ld[0] === 0.24, ld[0]);
  t('délais des lignes croissants', ld[1] === 0.29 && ld[2] === 0.34 && ld[3] === 0.39, ld.slice(0, 4).join('/'));
  t('le délai est plafonné (pas d attente interminable)', ld[12] === 0.6, ld[12]);
  t('aucun délai au-delà du plafond', Math.max.apply(null, ld) <= 0.6, Math.max.apply(null, ld));
  t('la cascade des lignes commence après la carte historique', ld[0] >= d3, ld[0] + ' >= ' + d3);

  // ---- 5. contenu intact (régression) ----
  const infos = doc.getElementById('fiche-infos').textContent;
  t('la carte infos garde ses lignes', infos.indexOf('Classe') >= 0 && infos.indexOf('Code MASSAR') >= 0, infos.slice(0, 70));
  t('les totaux sont toujours calculés', infos.indexOf('absences') >= 0 && infos.indexOf('retards') >= 0, infos.slice(0, 90));
  const couleurs = JSON.parse(win.eval("JSON.stringify(couleursAbsRd())"));
  t('couleurs sémantiques Ab/Rd inchangées',
    couleurs.abs === '#ef4444' && couleurs.rd === '#f59e0b', JSON.stringify(couleurs));
  t('les marques Ab et Rd sont dans les lignes',
    doc.getElementById('fiche-historique').innerHTML.indexOf('>Ab<') >= 0 &&
    doc.getElementById('fiche-historique').innerHTML.indexOf('>Rd<') >= 0);

  // ---- 6. protection des boutons, puis libération ----
  t('à l ouverture : boutons inertes (pas encore de libération)', blocs().every(b => !b.classList.contains('pret')));
  await attendre(950);
  t('après l animation : les 4 blocs sont libérés (cliquables)', blocs().every(b => b.classList.contains('pret')),
    blocs().map(b => b.classList.contains('pret')).join(','));

  // ---- 7. fermeture puis réouverture : l animation se rejoue ----
  win.fermerFicheEleve();
  t('fermeture : la fiche est cachée', fiche().classList.contains('hidden'));
  t('fermeture : la libération est retirée (prochaine ouverture protégée à nouveau)',
    blocs().every(b => !b.classList.contains('pret')));
  win.ouvrirFicheEleve(7, 1);
  t('réouverture : blocs inertes de nouveau', blocs().every(b => !b.classList.contains('pret')));
  t('réouverture : les lignes sont re-cascadées', lignes().every(l => l.classList.contains('fiche-ligne')));
  await attendre(950);
  t('réouverture : libération après l animation', blocs().every(b => b.classList.contains('pret')));

  // ---- 8. aucune fuite sur les autres popups ----
  t('le popup du formulaire n est pas touché', doc.querySelectorAll('#modal-form .fiche-anim').length === 0);
  t('les détails de signalement ne sont pas touchés', doc.querySelectorAll('#modal-detail-absence .fiche-ligne').length === 0);
  // ---- 9. invariante générale : une classe « fa-xxx » ne sert QUE d icône (élément <i>) ----
  // C'est la règle qu'a violée la v3.85 : un <div class="fa-1"> a fait afficher « 1 » par
  // Font Awesome (les classes fa-1 … fa-9 sont les icônes « chiffres »).
  const horsIcone = [];
  Array.from(doc.querySelectorAll('*')).forEach(el => {
    Array.from(el.classList).forEach(c => {
      if (/^fa-[a-z0-9-]+$/.test(c) && el.tagName !== 'I') horsIcone.push(el.tagName + ' .' + c);
    });
  });
  t('aucune classe d icône Font Awesome en dehors d un <i> (invariante anti-chiffres)',
    horsIcone.length === 0, horsIcone.slice(0, 3).join(' | '));

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 900);
