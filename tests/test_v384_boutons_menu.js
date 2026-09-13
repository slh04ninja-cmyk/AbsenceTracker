// test_v384_boutons_menu.js — boutons distincts en mode sombre + menu qui s'ouvre vers le haut
//  A. « Générer / Réinitialiser » et « Supprimer ce surveillant » ne prennent plus le style du
//     bouton « Fermer » en mode sombre (la règle !important écrasait leur style en ligne)
//  B. une liste déroulante proche des boutons s'ouvre vers le HAUT au lieu d'être cachée dessous
//     (cas réel : champ « Portée » du popup « Ajouter une fermeture »)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

function ouvrir(prefTheme, cb) {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      win.localStorage.setItem('absenceTrackVersion', 'v3.0');
      win.localStorage.setItem('testHistoGenere_v6', '1');
      win.localStorage.setItem('classes', JSON.stringify([{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, massar: 'M001', nom: 'El Amrani', prenom: 'Ahmed' }] }]));
      win.localStorage.setItem('absences', '[]');
      if (prefTheme) win.localStorage.setItem('prefTheme', prefTheme);
    }
  });
  setTimeout(() => cb(dom.window, dom.window.document, erreurs), 900);
}

let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const ORANGE_FERMER = 'rgb(234, 88, 12)';
const styleDe = (win, el) => win.getComputedStyle(el);

// rect factice (jsdom n'a pas de mise en page)
const rect = (top, bottom) => ({ top: top, bottom: bottom, left: 20, right: 300, width: 280, height: bottom - top, x: 20, y: top });

// stube la géométrie : le champ + le conteneur qui défile (corps du formulaire)
function geometrie(win, conteneur, hautChamp, basChamp, hautZone, basZone) {
  const bouton = conteneur.querySelector('.sd-trigger');
  bouton.getBoundingClientRect = () => rect(hautChamp, basChamp);
  let zone = conteneur.parentElement;
  while (zone) {
    const st = win.getComputedStyle(zone);
    if (/(auto|scroll)/.test(st.overflowY)) {
      zone.getBoundingClientRect = () => rect(hautZone, basZone);
      return zone;
    }
    zone = zone.parentElement;
  }
  return null;
}

// ---------- 1. MODE SOMBRE ----------
ouvrir('sombre', (win, doc, erreurs) => {
  t('le mode sombre est bien actif', doc.body.classList.contains('theme-sombre'));
  const mdp = doc.getElementById('btn-mdp-action');
  const supp = doc.getElementById('renommer-supprimer');
  const fermer = doc.querySelector('#modal-renommer .btn-fermer');
  t('le bouton « Fermer » existe bien dans la fenêtre', !!fermer);
  t('le bouton « Fermer » garde le style orange',
    styleDe(win, fermer).backgroundColor === ORANGE_FERMER, styleDe(win, fermer).backgroundColor);

  t('« Générer / Réinitialiser » n est plus de classe btn-fermer', !mdp.classList.contains('btn-fermer'));
  t('« Supprimer ce surveillant » n est plus de classe btn-fermer', !supp.classList.contains('btn-fermer'));
  t('« Générer / Réinitialiser » a sa propre classe de contour', mdp.classList.contains('btn-outline-primaire'));
  t('« Supprimer ce surveillant » a sa propre classe de contour', supp.classList.contains('btn-outline-danger'));
  t('Générer : plus le fond orange du bouton Fermer',
    styleDe(win, mdp).backgroundColor !== ORANGE_FERMER, styleDe(win, mdp).backgroundColor);
  t('Supprimer : plus le fond orange du bouton Fermer',
    styleDe(win, supp).backgroundColor !== ORANGE_FERMER, styleDe(win, supp).backgroundColor);
  t('Générer : contour bleu clair lisible en sombre',
    styleDe(win, mdp).color === 'rgb(147, 197, 253)' && styleDe(win, mdp).borderColor === 'rgb(147, 197, 253)',
    styleDe(win, mdp).color + ' / ' + styleDe(win, mdp).borderColor);
  t('Supprimer : contour rouge clair lisible en sombre',
    styleDe(win, supp).color === 'rgb(252, 165, 165)' && styleDe(win, supp).borderColor === 'rgb(248, 113, 113)',
    styleDe(win, supp).color + ' / ' + styleDe(win, supp).borderColor);
  // jsdom ne décompose pas le raccourci `border` : on lit la règle dans la feuille de style
  const contourBorde = (classe) => {
    let okBord = false;
    Array.from(doc.styleSheets).forEach(f => {
      try { Array.from(f.cssRules || []).forEach(r => {
        if (r.selectorText === '.' + classe && (r.style.border || '').indexOf('2px solid') >= 0) okBord = true;
      }); } catch (e) {}
    });
    return okBord;
  };
  t('les 2 boutons restent bordés (contour 2px conservé)',
    contourBorde('btn-outline-primaire') && contourBorde('btn-outline-danger'));

  // hauteur unique respectée
  const hauteurs = ['btn-outline-primaire', 'btn-outline-danger'].map(c => {
    let trouve = null;
    Array.from(doc.styleSheets).forEach(f => {
      try { Array.from(f.cssRules || []).forEach(r => { if ((r.selectorText || '').indexOf('.' + c) >= 0 && (r.style.height || '').indexOf('var(--btn-h)') >= 0) trouve = r.selectorText; }); } catch (e) {}
    });
    return trouve;
  });
  t('le contour bleu entre dans le gabarit de hauteur unique', !!hauteurs[0], hauteurs[0] && hauteurs[0].slice(0, 70));
  t('le contour rouge entre dans le gabarit de hauteur unique', !!hauteurs[1]);

  // ---------- 2. L'INTERRUPTEUR DE THEME NE CASSE PAS LES BOUTONS ----------
  win.basculerTheme();
  t('retour au thème clair', !doc.body.classList.contains('theme-sombre'));
  t('Générer : contour bleu foncé en thème clair',
    ['rgb(30, 58, 138)', 'var(--primary)'].indexOf(styleDe(win, mdp).color) >= 0, styleDe(win, mdp).color);
  t('Supprimer : contour rouge en thème clair',
    styleDe(win, supp).color === 'rgb(220, 38, 38)', styleDe(win, supp).color);
  t('aucun des 2 ne redevient orange',
    styleDe(win, mdp).backgroundColor !== ORANGE_FERMER && styleDe(win, supp).backgroundColor !== ORANGE_FERMER);

  // ---------- 3. LE CAS RÉEL : « Portée » dans « Ajouter une fermeture » ----------
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();
  win.ouvrirFormulaire('fermeture');
  t('le popup « Ajouter une fermeture » est ouvert', !doc.getElementById('modal-form').classList.contains('hidden'));
  const select = doc.getElementById('ferm-portee');
  t('le champ « Portée » existe', !!select);
  const conteneur = select.closest('.sd');
  t('le champ « Portée » est bien habillé (menu maison)', !!conteneur);
  const trigger = conteneur.querySelector('.sd-trigger');
  const panneau = conteneur.querySelector('.sd-panel');

  // sans géométrie (comme dans jsdom) : on ne touche à rien
  trigger.click();
  t('sans géométrie : la liste s ouvre quand même', conteneur.classList.contains('ouvert'));
  t('sans géométrie : aucune décision de placement prise', !conteneur.classList.contains('sd-haut'));
  conteneur.classList.remove('ouvert');

  // champ PROCHE DES BOUTONS : la liste doit monter
  geometrie(win, conteneur, 600, 646, 120, 700);
  trigger.click();
  t('champ proche des boutons : la liste s ouvre vers le HAUT (classe sd-haut)',
    conteneur.classList.contains('sd-haut'), conteneur.className);
  const csP = styleDe(win, panneau);
  t('liste vers le haut : elle est ancrée au-dessus du champ (bottom: 100% + 4px)',
    csP.bottom === 'calc(100% + 4px)', csP.bottom);
  t('liste vers le haut : plus d ancrage en dessous (top auto)', csP.top === 'auto', csP.top);
  t('liste vers le haut : sa hauteur est bornée à la place visible',
    panneau.style.maxHeight !== '' && parseInt(panneau.style.maxHeight, 10) <= 264,
    panneau.style.maxHeight);
  t('les 3 choix sont présents dans la liste', panneau.querySelectorAll('.sd-option').length === 3,
    panneau.querySelectorAll('.sd-option').length);
  conteneur.classList.remove('ouvert');
  panneau.style.maxHeight = '';

  // champ EN HAUT : la liste reste en dessous
  geometrie(win, conteneur, 100, 146, 120, 700);
  trigger.click();
  t('champ en haut de l écran : la liste reste en dessous (pas de sd-haut)',
    !conteneur.classList.contains('sd-haut'), conteneur.className);
  t('liste vers le bas : ancrage au-dessous du champ (calc(100% + 4px))',
    styleDe(win, panneau).top === 'calc(100% + 4px)', styleDe(win, panneau).top);

  // le choix fonctionne toujours et referme la liste
  panneau.querySelectorAll('.sd-option')[1].click();
  t('choisir une option met à jour le champ', select.value === 'matin', select.value);
  t('choisir une option referme la liste', !conteneur.classList.contains('ouvert'));

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
});
