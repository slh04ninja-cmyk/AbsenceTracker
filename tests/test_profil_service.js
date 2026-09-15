// Test jsdom : v3.51 — "Mon tableau de service" deplace du Dashboard enseignant vers la page Profil
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const compte = (role, mail) => JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='" + role + "'" + (mail ? " && c.email==='" + mail + "'" : '') + ";})[0])"));
const connecter = c => { doc.getElementById('login-email').value = c.email; doc.getElementById('login-password').value = c.password; win.connexion(); };

setTimeout(() => {
  // ---------- 1. Dashboard enseignant : la 3e div a disparu ----------
  const prof = compte('enseignant', 'math-prof1@taalim.ma');
  connecter(prof);
  t('connexion enseignant', doc.getElementById('page-enseignant').classList.contains('active'), prof.nom);
  t('dashboard : plus de div "Mon tableau de service"',
    doc.getElementById('ens-repos-creneaux') === null && doc.getElementById('ens-repos-jour') === null);
  t('dashboard : page sans le texte "Mon tableau de service"',
    doc.getElementById('page-enseignant').innerHTML.indexOf('Mon tableau de service') < 0);
  // mode repos : on force l'affichage et on verifie le bloc "En repos" + prochain cours
  win.eval('afficherReposEnseignant()');
  t('bloc "En repos" toujours la', !doc.getElementById('ens-repos').classList.contains('hidden'));
  t('prochain cours renseigne', doc.getElementById('ens-repos-prochain').textContent.length > 0,
    doc.getElementById('ens-repos-prochain').textContent);

  // ---------- 2. page Profil : la div est la et liste la semaine ----------
  const creneaux = JSON.parse(win.eval("JSON.stringify(creneauxUtilisateur('" + prof.email + "'))"));
  const service = win.eval("formatDureeService(heuresServiceMinutes('" + prof.email + "'))");
  win.switchProfil();
  const carte = doc.getElementById('profil-service-card');
  t('page Profil : carte presente', !!carte && carte.style.display === 'block');
  t('titre = Mon tableau de service (X h)',
    doc.getElementById('profil-service-card').textContent.indexOf('Mon tableau de service (' + service + ')') >= 0,
    doc.getElementById('profil-service-card').textContent.slice(0, 60));
  // meme style que le titre "Changer le mot de passe" + icone
  const titreSrv = doc.getElementById('profil-service-card').querySelector('h3');
  const titreMdp = Array.from(doc.querySelectorAll('#page-profil h3')).find(h => h.textContent.indexOf('Changer le mot de passe') >= 0);
  t('titre = h3 comme "Changer le mot de passe"', !!titreSrv && !!titreMdp && titreSrv.tagName === 'H3');
  t('meme typographie et couleur que "Changer le mot de passe"',
    ['font-bold', 'text-gray-800'].every(cl => titreSrv.classList.contains(cl) && titreMdp.classList.contains(cl)),
    titreSrv.className + ' vs ' + titreMdp.className);
  t('icone Font Awesome, meme habillage que le titre MDP', (() => {
    const i = titreSrv.querySelector('i');
    const ref = titreMdp.querySelector('i');
    if (!i || !ref) return false;
    // meme famille + meme couleur + meme marge, glyphe different (calendrier vs cle)
    return i.className.indexOf('fas') >= 0 && i.className.indexOf('fa-calendar') > 0 &&
      i.classList.contains('text-blue-900') && i.classList.contains('mr-2') &&
      ref.classList.contains('text-blue-900') && ref.classList.contains('mr-2');
  })(), titreSrv.querySelector('i') ? titreSrv.querySelector('i').className : 'aucune');
  const cont = doc.getElementById('profil-service-creneaux');
  const items = Array.from(cont.children).filter(e => e.className.indexOf('flex justify-between') >= 0);
  t('toutes les seances de la semaine listees', items.length === creneaux.length, items.length + ' / ' + creneaux.length);
  // meme presentation que l'ancienne liste : classe a gauche, horaire a droite
  const attendu = creneaux.slice().sort((a, b) => a.jour - b.jour || a.debut.localeCompare(b.debut))
    .map(c => c.classe + '|' + c.debut + '–' + c.fin + (c.salle ? ' · ' + c.salle : ''));
  const obtenu = items.map(it => {
    const spans = it.querySelectorAll('span');
    return spans[0].textContent + '|' + spans[1].textContent;
  });
  t('meme presentation (classe a gauche, horaire a droite)', JSON.stringify(obtenu) === JSON.stringify(attendu),
    obtenu.slice(0, 2).join(' // '));
  // jours : un titre par jour avec des seances, dans l'ordre
  const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const titres = Array.from(cont.children).filter(e => e.className.indexOf('text-xs font-bold') >= 0).map(e => e.textContent);
  const attendusJours = jours.filter((j, i) => creneaux.some(c => c.jour === i + 1))
    .map(j => j.charAt(0).toUpperCase() + j.slice(1));
  t('regroupe par jour dans l ordre', JSON.stringify(titres) === JSON.stringify(attendusJours), titres.join(' | '));
  t('aucune seance le samedi/dimanche', !titres.includes('Samedi') && !titres.includes('Dimanche'));

  // ---------- 3. surveillant + directeur : carte masquee ----------
  win.deconnexion();
  connecter(compte('surveillant'));
  win.switchProfil();
  t('surveillant : carte masquee', doc.getElementById('profil-service-card').style.display === 'none',
    doc.getElementById('profil-service-card').style.display);
  win.deconnexion();
  connecter(compte('directeur'));
  win.switchProfil();
  t('directeur : carte masquee', doc.getElementById('profil-service-card').style.display === 'none',
    doc.getElementById('profil-service-card').style.display);

  // ---------- 4. erreurs ----------
  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 400);
