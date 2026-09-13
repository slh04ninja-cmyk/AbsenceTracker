// fichier: app/js/15-donnees-test.js
// ========== DONNEES DE TEST (historique aleatoire, une seule fois) ==========
function genererDonneesTestHistorique() {
  if (localStorage.getItem('testHistoGenere_v6')) return;
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

  // 1 retard justifie sur 4 est approuve APRES les 30 min (demonstration de la transformation en absence)
  let compteurRetardsJustifies = 0;

  // Un Ab/Rd toujours cale sur un creneau reel de la classe (heure + matiere + enseignant de la seance)
  function creer(eleve, classe, creneau, dateISO, justifie, typeForce) {
    const estRetard = typeForce ? (typeForce === 'retard') : (Math.random() < 0.3);
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
      justifieLe: justifie ? dateISO + ' ' + heurePlus(creneau.debut, estRetard ? ((compteurRetardsJustifies++ % 4 === 3) ? 40 + Math.floor(Math.random() * 50) : 5 + Math.floor(Math.random() * 20)) : 30) : '',
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
  function placerNonJustifies(nombre, dateISO, jour, matinSeulement, types) {
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
      absences.push(creer(p.el, p.cl, p.cr, dateISO, false, types ? types[n] : ''));
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
  placerNonJustifies(2, fmtDateISO(hier), hier.getDay(), false, ['absence', 'retard']);
  placerNonJustifies(4, fmtDateISO(aujourdHui), aujourdHui.getDay(), true, ['absence', 'retard', 'retard', 'absence']);

  localStorage.setItem('absences', JSON.stringify(absences));
  localStorage.setItem('testHistoGenere_v6', '1');
}

