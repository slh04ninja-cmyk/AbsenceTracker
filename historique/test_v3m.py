# -*- coding: utf-8 -*-
import io, re, subprocess, shutil, json

html = io.open('AbsenceTrack-v2.html', encoding='utf-8').read()

def fct(nom):
    i = html.index('function ' + nom + '(')
    j = html.index('{', i)
    d, k = 0, j
    while True:
        if html[k] == '{': d += 1
        elif html[k] == '}':
            d -= 1
            if d == 0: break
        k += 1
    return html[i:k+1]

extraits = [fct(n) for n in ['fmtDateISO', 'couleursAbsRd', 'lireFiltresStats', 'changerFiltreStats', 'bornesPeriode', 'statsBornes', 'statsFiltre', 'barresStats', 'afficherStatistiques']]

harness = r'''
// DOM simule
function noeud(){ const o = { innerHTML:'', textContent:'', value:'', style:{}, className:'', enfants:[],
  appendChild(c){ o.enfants.push(c); } }; return o; }
const noeuds = {};
const valeurs = { 'stats-periode':'mois', 'stats-type':'tous', 'stats-debut':'', 'stats-fin':'' };
const document = {
  getElementById(id){ if (!noeuds[id]) { noeuds[id] = noeud(); noeuds[id].value = valeurs[id] !== undefined ? valeurs[id] : ''; } return noeuds[id]; },
  createElement(){ return noeud(); }
};
const utilisateurConnecte = { nom: 'Prof. Mathématiques', role: 'enseignant' };
const classes = [
  { id:1, nom:'3eme A', eleves:[{id:1},{id:2},{id:3}] },
  { id:2, nom:'3eme B', eleves:[{id:4},{id:5},{id:6}] }
];
let classeSelectionnee = classes[0];
const auj = new Date();
const iso = (j) => { const x = new Date(auj); x.setDate(x.getDate() - j); return x.toISOString().slice(0,10); };
const absences = [
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'absent',     dateISO: iso(1), seance:'matin',      heure:'08:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'justifie_s', dateISO: iso(2), seance:'matin',      heure:'09:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'justifie_d', dateISO: iso(3), seance:'apres-midi', heure:'14:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'absent',     dateISO: iso(4), seance:'matin',      heure:'10:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'retard',  statut:'justifie_s', dateISO: iso(5), seance:'matin',      heure:'11:00', enseignant:'Prof. Mathématiques' },
  { eleveId:2, classe:'3eme A', nom:'Fatima Benali',   type:'absence', statut:'absent',     dateISO: iso(2), seance:'matin',      heure:'08:00', enseignant:'Prof. Mathématiques' },
  { eleveId:2, classe:'3eme A', nom:'Fatima Benali',   type:'retard',  statut:'justifie_s', dateISO: iso(6), seance:'matin',      heure:'09:00', enseignant:'Prof. SVT' },
  { eleveId:4, classe:'3eme B', nom:'Nadia Chraibi',   type:'absence', statut:'absent',     dateISO: iso(2), seance:'matin',      heure:'08:00', enseignant:'Prof. Mathématiques' }
];
const COULEUR_ABSENCE = '#ef4444';
const COULEUR_RETARD = '#f59e0b';
const SEUIL_ALERTE_MOIS = 4;
let statsPeriode = 'mois';
let statsType = 'tous';
function sansBalises(t){ return String(t).replace(/<[^>]*>/g, ''); }
'''

tests = r'''
function resume(t){
  const tete = noeuds['top-absents'].enfants.map(e => sansBalises(e.innerHTML)).join(' | ');
  const cls = noeuds['chart-absences'].enfants.map(e => sansBalises(e.innerHTML)).join(' | ');
  const rep = sansBalises(noeuds['chart-repartition'].innerHTML || '');
  const tot = sansBalises(noeuds['stats-totaux'].innerHTML || '');
  console.log('--- ' + t);
  console.log('   taux      : ' + noeuds['stat-presence'].textContent + '  (' + noeuds['stat-presence-detail'].textContent + ')');
  console.log('   totaux    : ' + tot);
  console.log('   top       : ' + (tete || '(vide)'));
  console.log('   par classe: ' + (cls || '(vide)'));
  console.log('   anneau    : ' + (rep || '(vide)'));
  console.log('   residus   : evolution=' + (noeuds['chart-evolution'] === undefined) + ' seance=' + (noeuds['chart-seance'] === undefined) + ' jour=' + (noeuds['chart-jour'] === undefined) + ' surveiller=' + (noeuds['stats-surveiller'] === undefined));
}

noeuds['stat-presence'] = noeud(); noeuds['stat-presence-detail'] = noeud();
noeuds['progress-presence'] = noeud();

valeur('stats-periode', 'mois'); valeur('stats-type', 'tous');
afficherStatistiques(); resume('mois + Ab+Rd (mes signalements)');

valeur('stats-type', 'retard'); changerFiltreStats(); resume('mois + retards seuls');

valeur('stats-type', 'tous'); valeur('stats-periode', 'semaine'); changerFiltreStats(); resume('cette semaine + Ab+Rd');

valeur('stats-periode', 'jour'); changerFiltreStats(); resume("aujourd'hui (aucune donnee attendue)");

valeur('stats-periode', 'mois'); changerFiltreStats(); resume('retour mois (memoire des filtres)');
'''

js = harness + '\n' + '\n\n'.join(extraits) + '\nvaleur = function(id,v){ document.getElementById(id).value = v; };\n' + tests
io.open('_test_stats2.js', 'w', encoding='utf-8').write(js)
node = shutil.which('node') or shutil.which('nodejs')
r = subprocess.run([node, '_test_stats2.js'], capture_output=True, text=True)
print(r.stdout)
print(r.stderr[-1500:] if r.stderr else '')
