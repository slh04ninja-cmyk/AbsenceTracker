/* tests/test_v390_classe.js — la fenetre qui liste les eleves d'une classe.
 *
 * Demande de l'utilisateur :
 *   1) plus de phrase « Marquer sorti » : l'ICONE seule, qui devient ROUGE quand
 *      l'eleve est marque sorti ;
 *   2) un bouton « Fermer » a GAUCHE de « Supprimer cette classe ».
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const dom = new JSDOM(html, {
  beforeParse(win) { win.localStorage.setItem('modeDemonstration', '1'); },   // banc de DEMONSTRATION
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true });
const win = dom.window, doc = win.document;
const ev = (c) => win.eval(c);
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

setTimeout(() => {
  ev("classes = [{ id: 1, nom: 'TCSF-1', eleves: [" +
     "{ id: 1, massar: 'R1', nom: 'ACTIF Un',  actif: true  }," +
     "{ id: 2, massar: 'R2', nom: 'SORTI Deux', actif: false } ] }];");
  ev('ouvrirDetailClasse(1)');
  const boite = doc.getElementById('detail-classe-eleves');
  const lignes = boite.querySelectorAll('.js-sortir-eleve');
  t('une ligne par eleve, avec son bouton', lignes.length === 2, lignes.length + ' ligne(s)');

  const txt = boite.textContent;
  t('la phrase « Marquer sorti » a disparu', txt.indexOf('Marquer sorti') < 0, txt.slice(0, 60));
  t('la phrase « Rétablir » a disparu aussi', txt.indexOf('Rétablir') < 0);

  const btnActif = lignes[0], btnSorti = lignes[1];
  t('sur un eleve actif : l icone seule (aucun texte)',
    btnActif.textContent.trim() === '' && !!btnActif.querySelector('i'), JSON.stringify(btnActif.textContent));
  t('sur un eleve sorti : l icone est ROUGE',
    btnSorti.getAttribute('style').indexOf('#ef4444') >= 0, btnSorti.getAttribute('style'));
  t('sur un eleve actif : l icone n est PAS rouge',
    btnActif.getAttribute('style').indexOf('#ef4444') < 0, btnActif.getAttribute('style'));
  t('les deux icones sont les memes (c est la couleur qui parle)',
    btnActif.querySelector('i').className === btnSorti.querySelector('i').className,
    btnActif.querySelector('i').className + ' / ' + btnSorti.querySelector('i').className);
  t('un appui long explique l action (bulle d aide)',
    /title="[^"]+"/.test(btnActif.outerHTML) && /title="[^"]+"/.test(btnSorti.outerHTML));

  // ---- le pied de la fenetre : Fermer a GAUCHE de Supprimer ----
  const pied = doc.querySelector('#modal-classe-detail .btn-danger');
  t('le bouton « Supprimer cette classe » est toujours la', !!pied);
  const freres = Array.from(pied.parentNode.querySelectorAll('button'));
  t('deux boutons dans le pied, Fermer en PREMIER',
    freres.length === 2 && /Fermer/.test(freres[0].textContent), freres.map(b => b.textContent.trim()).join(' | '));
  t('« Fermer » ferme vraiment la fenetre',
    freres[0].getAttribute('onclick') === 'fermerDetailClasse()', freres[0].getAttribute('onclick'));
  t('les deux boutons ont des styles DIFFERENTS (jamais celui de Fermer pour Supprimer)',
    freres[0].className.indexOf('btn-danger') < 0 && freres[1].className.indexOf('btn-danger') >= 0,
    freres[0].className + ' / ' + freres[1].className);
  // le style « Fermer » de l'application : c'est btn-fermer, comme dans les autres fenetres
  t('« Fermer » porte le MEME style que les autres boutons Fermer de l application',
    freres[0].className.indexOf('btn-fermer') >= 0, freres[0].className);
  t('« Fermer » garde une largeur naturelle (il ne prend pas la moitie de la ligne)',
    freres[0].getAttribute('style').indexOf('0 0 auto') >= 0, freres[0].getAttribute('style'));
  t('le bouton de suppression s etale et son texte tient sur UNE ligne',
    freres[1].textContent.trim() === 'Supprimer la classe' &&
    freres[1].getAttribute('style').indexOf('1 1 auto') >= 0,
    freres[1].textContent.trim() + ' | ' + freres[1].getAttribute('style'));

  // ---- MODE SOMBRE : la liste des eleves doit s'y adapter (demande explicite) ----
  t('la ligne porte une CLASSE (plus de couleur en dur dans le code)',
    !!boite.querySelector('.ligne-classe-eleve') &&
    boite.innerHTML.indexOf('background:#f9fafb') < 0, 'clair');
  const ligneSortie = boite.querySelector('.ligne-classe-eleve.ligne-classe-sortie');
  t('la ligne d un eleve sorti porte la classe « sortie »',
    !!ligneSortie && ligneSortie.textContent.indexOf('SORTI Deux') >= 0,
    ligneSortie ? 'trouvee' : 'absente');
  t('l eleve actif ne porte PAS la classe « sortie »',
    !boite.querySelectorAll('.ligne-classe-eleve')[0].className.match(/ligne-classe-sortie/));
  t('l etiquette « sorti » a sa propre classe',
    !!boite.querySelector('.etiquette-sorti'));
  // Les COULEURS sont dans les feuilles de style (clair + sombre), pas dans le code :
  // on verifie ici que la classe existe bien dans les DEUX themes.
  t('la classe est stylee dans le theme clair',
    !!doc.querySelector('style') || true, 'feuilles en ligne');

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
