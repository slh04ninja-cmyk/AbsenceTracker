// test_v384.js — interrupteur clair/sombre + cases à cocher dessinées
//  - le bouton rond est remplacé par un INTERRUPTEUR (piste + pouce) dans les 12 pages
//  - l'interrupteur suit toujours l'état réel du thème (y compris après redémarrage)
//  - dans la barre : piste translucide (lisible en clair comme en sombre)
//  - les cases à cocher deviennent des cases dessinées (bord, coche, remplissage animé)
//    tout en restant de VRAIES cases (l'input est conservé : les tests s'en servent)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [{ id: 1, nom: 'TCSF-1', eleves: [
  { id: 1, massar: 'M001', nom: 'El Amrani', prenom: 'Ahmed' },
  { id: 2, massar: 'M002', nom: 'Berrada', prenom: 'Imane' },
  { id: 3, massar: 'M003', nom: 'Ouazzani', prenom: 'Karim' }
]}];

function ouvrir(prefTheme, cb) {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      win.localStorage.setItem('absenceTrackVersion', 'v3.0');
      win.localStorage.setItem('testHistoGenere_v6', '1');
      win.localStorage.setItem('classes', JSON.stringify(classes));
      win.localStorage.setItem('absences', '[]');
      if (prefTheme) win.localStorage.setItem('prefTheme', prefTheme);
    }
  });
  setTimeout(() => cb(dom.window, dom.window.document, erreurs), 900);
}

let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

// ---------- 1. thème clair (par défaut) ----------
ouvrir(null, (win, doc, erreurs) => {
  const sw = Array.from(doc.querySelectorAll('.sw-theme'));
  t('12 interrupteurs (11 barres de titre + connexion)', sw.length === 12, sw.length);
  t('plus aucun ancien bouton rond', doc.querySelectorAll('button[onclick*="basculerTheme"]').length === 0,
    doc.querySelectorAll('button[onclick*="basculerTheme"]').length);
  t('l ancienne icône .icone-theme n est plus dans la page', doc.querySelectorAll('.icone-theme').length === 0);
  t('structure : input + piste + pouce',
    sw.every(s => s.querySelector('input[type=checkbox]') && s.querySelector('.track') && s.querySelector('.thumb')));
  t('le pouce porte le soleil (fa-sun) et la lune (fa-moon)',
    sw.every(s => s.querySelector('.thumb .fa-sun') && s.querySelector('.thumb .fa-moon')));
  t('au départ (clair) : interrupteurs décochés', sw.every(s => s.querySelector('input').checked === false));
  t('au départ : pas de thème sombre', !doc.body.classList.contains('theme-sombre'));
  t('libellé d accessibilité correct', sw[0].title === 'Passer en mode sombre', sw[0].title);

  const csT = win.getComputedStyle(sw[0].querySelector('.track'));
  const csTh = win.getComputedStyle(sw[0].querySelector('.thumb'));
  t('piste arrondie (9999px)', csT.borderRadius === '9999px', csT.borderRadius);
  t('pouce rond (50%)', csTh.borderRadius === '50%', csTh.borderRadius);
  t('mouvement du pouce animé (cubic-bezier)', csTh.transition.indexOf('cubic-bezier') >= 0, csTh.transition);

  // ---------- 2. bascule ----------
  win.basculerTheme();
  t('après bascule : thème sombre actif', doc.body.classList.contains('theme-sombre'));
  t('après bascule : TOUS les interrupteurs suivent (cochés)',
    sw.every(s => s.querySelector('input').checked === true));
  t('après bascule : libellé inversé', sw[0].title === 'Passer en mode clair', sw[0].title);
  t('après bascule : la piste change de couleur (sombre)',
    win.getComputedStyle(sw[0].querySelector('.track')).background.indexOf('none') < 0,
    win.getComputedStyle(sw[0].querySelector('.track')).background);
  win.basculerTheme();
  t('re-bascule : retour au clair', !doc.body.classList.contains('theme-sombre') &&
    sw.every(s => s.querySelector('input').checked === false));
  t('clair/sombre mémorisé pour la prochaine ouverture',
    win.localStorage.getItem('prefTheme') === 'clair', win.localStorage.getItem('prefTheme'));

  // ---------- 3. cases à cocher dessinées ----------
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='enseignant';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();
  win.choisirClasse(1);
  const lignes = Array.from(doc.querySelectorAll('#liste-eleves-enseignant > div'));
  t('les 3 élèves sont listés', lignes.length === 3, lignes.length);
  const labels = lignes[0].querySelectorAll('label.check');
  t('chaque ligne a 2 cases dessinées (Ab / Rd)', labels.length === 2, labels.length);
  t('la case contient une VRAIE case à cocher (input conservé)',
    labels[0].querySelector('input[type=checkbox]') !== null);
  t('la case a sa boîte dessinée (span.box)', labels[0].querySelector('span.box') !== null);
  t('l’input est juste après l’ouverture du label (sélecteur + .box)', (() => {
    const l = labels[0];
    return l.children[0].tagName === 'INPUT' && l.children[1].classList.contains('box');
  })());
  const box = labels[0].querySelector('.box');
  const csBox = win.getComputedStyle(box);
  t('boîte : coins arrondis 6px', csBox.borderRadius === '6px', csBox.borderRadius);
  t('boîte : remplissage masqué (overflow hidden)', csBox.overflow === 'hidden', csBox.overflow);
  t('boîte : 22 px de côté', csBox.width === '22px' && csBox.height === '22px', csBox.width + 'x' + csBox.height);
  t('boîte : bordure visible quand non cochée', csBox.borderStyle === 'solid', csBox.borderStyle);
  // jsdom ne calcule pas les pseudo-éléments : on lit la règle dans la feuille de style
  const regleBox = (suffixe) => {
    let trouvee = null;
    Array.from(doc.styleSheets).forEach(f => {
      let regles = [];
      try { regles = Array.from(f.cssRules || []); } catch (e) { return; }
      regles.forEach(r => { if (r.selectorText === '.check .box' + suffixe) trouvee = r; });
    });
    return trouvee;
  };
  const rApres = regleBox('::after');
  t('la coche est dessinée par un pseudo-élément (::after)', !!rApres);
  t('la coche est masquée au repos (scale 0)', !!rApres && rApres.style.transform.indexOf('scale(0)') >= 0,
    rApres && rApres.style.transform);
  t('la coche apparaît quand la case est cochée',
    !!(regleBox(':checked + .box::after') || regleBox(' input:checked + .box::after')) ||
    Array.from(doc.styleSheets).some(f => { try { return Array.from(f.cssRules).some(r => (r.selectorText || '').indexOf('.check input:checked + .box::after') >= 0); } catch (e) { return false; } }));
  t('le remplissage monte au lieu d apparaitre (translateY)',
    !!regleBox('::before') && regleBox('::before').style.transform.indexOf('translateY') >= 0,
    regleBox('::before') && regleBox('::before').style.transform);

  // la case reste fonctionnelle : on la coche, l'app enregistre
  const inp = labels[0].querySelector('input');
  inp.checked = true;
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
  win.validerConfirmation();
  const nb = JSON.parse(win.localStorage.getItem('absences') || '[]').length;
  t('cocher la case dessinée enregistre bien un signalement', nb === 1, nb);
  win.choisirClasse(1);
  const apres = doc.querySelectorAll('#liste-eleves-enseignant > div')[0];
  t('la case reste cochée après l enregistrement',
    !!apres && apres.querySelector('input').checked === true,
    apres ? apres.querySelector('input').checked : 'ligne absente');
  t('la case dessinée est bien dans une ligne élève (et non un vestige)',
    !!apres && apres.querySelectorAll('label.check').length === 2,
    apres ? apres.querySelectorAll('label.check').length : 'ligne absente');

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');

  // ---------- 4. redémarrage en thème sombre : l'interrupteur doit être déjà basculé ----------
  ouvrir('sombre', (win2, doc2, err2) => {
    const sw2 = Array.from(doc2.querySelectorAll('.sw-theme'));
    t('redémarrage en sombre : le thème est appliqué', doc2.body.classList.contains('theme-sombre'));
    t('redémarrage en sombre : les interrupteurs sont déjà basculés',
      sw2.every(s => s.querySelector('input').checked === true));
    t('redémarrage : libellé « Passer en mode clair »', sw2[0].title === 'Passer en mode clair', sw2[0].title);
    t('redémarrage : aucune erreur JS', err2.length === 0, err2[0] || '');
    console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
    process.exit(ok ? 0 : 1);
  });
});
