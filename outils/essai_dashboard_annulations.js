/* ~/abs2/essai_dashboard_annulations.js — VERIFICATION (lecture seule)
 *
 * Question posee : « les seances annulees affichees dans le Dashboard
 * surveillant/directeur sont-elles bien celles de la BASE ? »
 *
 * Methode : on ouvre l'APPLICATION REELLE (le livrable construit) dans un
 * navigateur sans ecran, on lui donne les donnees REELLES du serveur (copie
 * prise par ~/abs2/dump_base.py), on la laisse lire comme elle le fait sur le
 * telephone, puis on compare :
 *      ce que la BASE contient          (annulations_seances)
 *   et ce que le DASHBOARD affiche       (carte « Seances annulees »)
 *
 * Aucune ecriture, ni dans la base ni dans l'application.
 * Usage : node ~/abs2/essai_dashboard_annulations.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// La racine du depot, deduite de l'emplacement de ce fichier (portable) ;
// les donnees viennent de `outils/dump_base.py` (dossier ~/abs2/base_json).
const DEPOT = path.join(__dirname, '..');
const DONNEES = process.env.AT_BASE_JSON || path.join(require('os').homedir(), 'abs2', 'base_json');
const ETAB = 1;                       // l'etablissement reel (Jerada)

function table(nom) {
  return JSON.parse(fs.readFileSync(path.join(DONNEES, nom + '.json'), 'utf8'));
}
function deLEtab(lignes) {
  return lignes.filter(l => l.etablissement_id === undefined || String(l.etablissement_id) === String(ETAB));
}

(async () => {
  const html = fs.readFileSync(path.join(DEPOT, 'AbsenceTrack-v2.html'), 'utf8');
  const base = {};
  ['classes', 'eleves', 'profils', 'seances', 'signalements', 'absences_personnel',
   'annulations_seances', 'fermetures', 'etablissements'].forEach(n => { base[n] = table(n); });

  const profils = deLEtab(base.profils);
  const directeur = profils.find(p => p.role === 'directeur' && p.id === 1);

  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      // ---- on repond a la place du serveur, avec les donnees REELLES ----
      w.fetch = function (url) {
        const u = String(url);
        const donnees = () => {
          const m = u.match(/rest\/v1\/([a-z_]+)/);
          if (!m) return [];
          const nom = m[1];
          if (!base[nom]) return [];
          let lignes = deLEtab(base[nom]);
          if (u.indexOf('auth_user_id=eq.') > -1) {
            return [directeur];                       // « qui suis-je »
          }
          if (nom === 'profils' && u.indexOf('role=in.') > -1) {
            return lignes.filter(p => p.role === 'enseignant' || p.role === 'surveillant');
          }
          if (nom === 'etablissements' && u.indexOf('id=eq.') > -1) {
            return lignes.filter(e => String(e.id) === String(ETAB));
          }
          return lignes;
        };
        return Promise.resolve({
          ok: true, status: 200,
          text: () => Promise.resolve(JSON.stringify(donnees()))
        });
      };
    }
  });
  const win = dom.window;
  await new Promise(r => win.addEventListener('load', r, { once: true }));
  await new Promise(r => setTimeout(r, 600));

  // ---- le telephone tel qu'il est quand le directeur s'est connecte ----
  win.eval("Depot.ecrire('installationServeur', '1');");
  win.eval("atEnregistrerSession(" + JSON.stringify({
    access_token: 'jeton-de-verification', refresh_token: 'r',
    id: directeur.auth_user_id || '00000000-0000-0000-0000-000000000001',
    email: directeur.email || 'directeur@taalim.ma', expire_le: Date.now() + 3600000
  }) + ");");
  win.eval("utilisateurConnecte = {role:'directeur', nom:" + JSON.stringify(directeur.nom) +
           ", email:" + JSON.stringify(directeur.email || '') + ", code:''};");

  // ---- l'application LIT la base, exactement comme sur le telephone ----
  const lues = await win.eval("chargerDonneesDuServeur(true)");
  console.log('lecture de la base par l\'application :', lues ? 'faite' : 'ECHOUEE');

  // ---- ce que la BASE contient ----
  const annulations = deLEtab(base.annulations_seances);
  const nomClasse = {};
  deLEtab(base.classes).forEach(c => { nomClasse['' + c.id] = c.nom; });
  const hhmm = t => String(t).slice(0, 5);
  const cle = l => [l.date_seance, nomClasse['' + l.classe_id] || '', hhmm(l.debut)].join('|');

  console.log('\n=== CE QUE LA BASE CONTIENT : ' + annulations.length + ' seance(s) annulee(s) ===');
  const clesBase = new Set();
  annulations.forEach(a => {
    clesBase.add(cle(a));
    console.log('   ' + a.date_seance + ' · ' + (nomClasse['' + a.classe_id] || ('classe ' + a.classe_id)) +
                ' · ' + hhmm(a.debut) + '-' + hhmm(a.fin) + ' · ' + (a.motif || '(sans motif)'));
  });

  // ---- ce que le DASHBOARD affiche ----
  win.eval("if (typeof afficherSeancesAnnulees === 'function') afficherSeancesAnnulees();");
  const cartes = win.document.querySelectorAll('.js-seances-annulees');
  console.log('\n=== CE QUE LE DASHBOARD AFFICHE (' + cartes.length + ' carte(s) a remplir) ===');
  let affichees = [];
  cartes.forEach((c, i) => {
    const lignes = Array.prototype.map.call(c.children, e => e.textContent.replace(/\s+/g, ' ').trim());
    console.log('   -- carte ' + (i + 1) + ' : ' + lignes.length + ' ligne(s)');
    lignes.forEach(l => console.log('      ' + l));
    if (i === 0) affichees = lignes;
  });

  const listeApp = JSON.parse(win.eval("JSON.stringify(listeSeancesAnnulees())"));
  console.log('\n=== LA LISTE QUE L\'APPLICATION CALCULE : ' + listeApp.length + ' ligne(s) ===');
  listeApp.forEach(sn => console.log('   [' + sn.origine + '] ' + sn.dateISO + ' · ' + sn.classe +
    ' · ' + sn.debut + '-' + sn.fin + ' · ' + (sn.motif || '') + (sn.genere ? '  (deduite de l\'absence)' : '')));

  const clesApp = new Set(listeApp.map(sn => [sn.dateISO, sn.classe, sn.debut].join('|')));
  const manquantes = listeApp.filter(sn => !clesBase.has([sn.dateISO, sn.classe, sn.debut].join('|')));
  const enPlus = annulations.filter(a => !clesApp.has([a.date_seance, nomClasse['' + a.classe_id] || '',
                                                       hhmm(a.debut)].join('|')));
  // Attention au sens : la carte du Dashboard n'affiche QUE le jour + l'avenir (v4.59), alors
  // que `listeSeancesAnnulees()` — celle qui alimente les statistiques — garde tout. C'est cette
  // liste-la qui doit correspondre a la base, ligne pour ligne.
  console.log('\n=== VERDICT (liste calculee par l\'application <-> base) ===');
  console.log('   base                              : ' + annulations.length + ' ligne(s)');
  console.log('   liste calculee (stats)            : ' + listeApp.length + ' ligne(s)');
  console.log('   dans la liste et PAS en base      : ' + manquantes.length);
  manquantes.forEach(sn => console.log('      ' + sn.dateISO + ' · ' + sn.classe + ' · ' + sn.debut + ' · ' + (sn.motif || '')));
  console.log('   en base SANS equivalent au dashboard : ' + enPlus.length);
  enPlus.forEach(a => console.log('      ' + a.date_seance + ' · ' + (nomClasse['' + a.classe_id] || a.classe_id) +
                                  ' · ' + hhmm(a.debut) + ' · ' + (a.motif || '')));
  console.log('   => ' + ((manquantes.length === 0 && enPlus.length === 0)
    ? 'IDENTIQUES : aucune seance annulee n\'existe d\'un cote sans exister de l\'autre.'
    : 'DIFFERENCE : voir les lignes ci-dessus.'));
  process.exit(0);
})();
