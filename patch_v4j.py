# -*- coding: utf-8 -*-
# patch_v4j.py -> v3.49
# 1. Classes : uniquement TCSF-1 / TCSF-2 / TCSF-3 avec 12 eleves chacune (reset du jeu de demo)
# 2. Donnees de test Ab/Rd : anciens depuis le 01/09 approuves S1/S2/D, + non justifies aujourd'hui et 2 hier,
#    tous places dans les SEANCES EXACTES des tableaux des eleves (creneau reel de la classe).
import io, re, sys

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
orig = s

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-42s occurrences=%d (attendu %d) %s' % (nom or old[:38], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok:
        sys.exit(1)
    s = s.replace(old, new)

# ---------- 1. Classes de demo : TCSF-1/2/3 x 12 eleves ----------
rep("""const nomsClassesDemo = ['3ème A', '3ème B', '4ème A', '4ème B', '5ème A'];
const classesDemo = [];
let idEleveDemo = 1;
nomsClassesDemo.forEach((nomClasse, idx) => {
  const eleves = [];
  for (let i = 0; i < 13; i++) {""",
"""const nomsClassesDemo = ['TCSF-1', 'TCSF-2', 'TCSF-3'];
const NB_ELEVES_DEMO = 12;
const classesDemo = [];
let idEleveDemo = 1;
nomsClassesDemo.forEach((nomClasse, idx) => {
  const eleves = [];
  for (let i = 0; i < NB_ELEVES_DEMO; i++) {""", 1, 'classes de demo = TCSF-1/2/3')

rep("const DEMO_VERSION = 'v2.1';", "const DEMO_VERSION = 'v3.0';", 1, 'DEMO_VERSION -> v3.0 (reset)')

rep('const NB_ELEVES_CLASSE_SERVICE = 13;', 'const NB_ELEVES_CLASSE_SERVICE = 12;', 1, '12 eleves par classe')

# ---------- 2. Injection des donnees de test ----------
deb = s.index('function genererDonneesTestHistorique() {')
fin = s.index('// ========== INIT ==========')
nouvelle = r'''function genererDonneesTestHistorique() {
  if (localStorage.getItem('testHistoGenere_v5')) return;
  const motifs = ['Maladie', 'Raison familiale', 'Raison personnelle', 'Transport', 'Autre'];
  const durees = ['15 min', '30 min', '1 h'];

  // Creneaux REELS d'une classe : { jour -> [{debut, matiere, prof}] } (issus des tableaux des eleves)
  function creneauxClasse(nom) {
    const par = {};
    Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
      if (c.classe !== nom) return;
      const j = String(c.jour);
      par[j] = par[j] || [];
      if (!par[j].some(x => x.debut === c.debut)) par[j].push({ debut: c.debut, matiere: c.matiere, prof: c.prof });
    }));
    return par;
  }
  const ficheProf = code => comptes.find(x => x.code === code) || comptes.find(x => x.email === code + '@taalim.ma') || null;
  const heurePlus = (h, min) => {
    const p = String(h).split(':');
    let t = (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0) + min;
    if (t > 23 * 60 + 59) t = 23 * 60 + 59;
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };
  const tirer = arr => arr[Math.floor(Math.random() * arr.length)];

  // Un Ab/Rd toujours cale sur un creneau reel de la classe (heure + matiere + enseignant de la seance)
  function creer(eleve, classe, creneau, dateISO, justifie) {
    const estRetard = Math.random() < 0.3;
    const p = ficheProf(creneau.prof);
    const par = justifie ? tirer(['Surveillant 1', 'Surveillant 2', 'Directeur']) : '';
    return {
      id: Date.now() + Math.random(),
      eleveId: eleve.id,
      nom: libelleEleve(eleve),
      classe: classe.nom,
      heure: creneau.debut,
      date: dateAffichage(dateISO),
      dateISO: dateISO,
      seance: creneau.debut < '13:00' ? 'matin' : 'apres-midi',
      type: estRetard ? 'retard' : 'absence',
      duree: estRetard ? tirer(durees) : '',
      statut: justifie ? (/directeur/i.test(par) ? 'justifie_d' : 'justifie_s') : 'absent',
      enseignant: p ? p.nom : '',
      matiere: creneau.matiere || (p ? p.matiere : ''),
      profCode: creneau.prof || '',
      motif: justifie ? tirer(motifs) : '',
      justifiePar: par,
      justifieLe: justifie ? dateISO + ' ' + heurePlus(creneau.debut, 30) : '',
      test: true
    };
  }

  // Purge de TOUS les Ab/Rd de test precedents (donnees de demonstration uniquement)
  absences = absences.filter(a => !a.test);

  const creneaux = {};
  classes.forEach(cl => { creneaux[cl.nom] = creneauxClasse(cl.nom); });
  const aujourdHui = new Date();

  // Non justifies : un eleve different par Ab/Rd, et jamais deux fois le meme eleve
  // (regle metier : un seul Ab/Rd non justifie par eleve)
  const dejaNonJustifie = {};
  function placerNonJustifies(nombre, dateISO, jour, matinSeulement) {
    const cands = [];
    classes.forEach(cl => {
      const liste = ((creneaux[cl.nom] || {})[String(jour)] || []).filter(c => !matinSeulement || c.debut < '12:00');
      if (!liste.length) return;
      cl.eleves.forEach(el => { if (!dejaNonJustifie[el.id]) cands.push({ cl: cl, el: el, cr: tirer(liste) }); });
    });
    let n = 0;
    while (n < nombre && cands.length) {
      const p = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
      dejaNonJustifie[p.el.id] = true;
      absences.push(creer(p.el, p.cl, p.cr, dateISO, false));
      n++;
    }
  }

  // A) Historique : du 1er septembre a hier, tous APPROUVES (S1 / S2 / D)
  const debut = new Date(aujourdHui.getFullYear(), 8, 1);
  const hier = new Date(aujourdHui); hier.setDate(hier.getDate() - 1);
  for (let d = new Date(debut); d <= hier; d.setDate(d.getDate() + 1)) {
    const jour = d.getDay();
    if (jour === 0 || jour === 6) continue;            // pas de cours le week-end
    const dateISO = fmtDateISO(d);
    classes.forEach(cl => {
      const liste = (creneaux[cl.nom] || {})[String(jour)] || [];
      if (!liste.length || !cl.eleves.length) return;
      const nb = 1 + Math.floor(Math.random() * 3);
      const pris = [];
      for (let i = 0; i < nb; i++) {
        const cr = tirer(liste);
        const el = tirer(cl.eleves);
        const cle = el.id + '|' + cr.debut + '|' + dateISO;
        if (pris.indexOf(cle) >= 0) continue;
        pris.push(cle);
        absences.push(creer(el, cl, cr, dateISO, true));
      }
    });
  }

  // B) Hier : 2 Ab/Rd NON justifies ; C) Aujourd'hui : Ab/Rd NON justifies du MATIN uniquement
  placerNonJustifies(2, fmtDateISO(hier), hier.getDay());
  placerNonJustifies(4, fmtDateISO(aujourdHui), aujourdHui.getDay(), true);

  localStorage.setItem('absences', JSON.stringify(absences));
  localStorage.setItem('testHistoGenere_v5', '1');
}

'''
s = s[:deb] + nouvelle + s[fin:]
print('%-42s OK (function reecrite)' % 'genererDonneesTestHistorique')

# ---------- 3. Version ----------
rep('AbsenceTrack v3.48', 'AbsenceTrack v3.49', 1, 'label v3.49')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
