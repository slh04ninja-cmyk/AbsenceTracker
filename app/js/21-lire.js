// fichier: app/js/21-lire.js
// ========== LIRE LES DONNEES DEPUIS LA BASE (etape 2) ==========
// L'application ne travaille plus sur les listes du telephone : a la connexion, elle
// CHARGE de la base tout le travail de l'ecole — classes, eleves, emplois du temps,
// absences et retards, annulations de seance, fermetures, absences du personnel — et
// les range dans la memoire du telephone dans la forme habituelle de l'application.
// Ainsi TOUS les ecrans continuent de fonctionner sans changement ; ils lisent
// simplement des donnees qui viennent du serveur.
//
// Le telephone garde une copie (pour travailler hors ligne), mais la reference est la
// base : chaque connexion recharge ce qui s'y trouve.

function heureCourte(v) {
  const s = String(v || '');
  return s.length >= 5 ? s.slice(0, 5) : s;
}
function dateCourteFr(iso) {
  const p = String(iso || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}
async function atLignes(table, champs, jeton) {
  const rep = await fetch(AT_BASE + '/rest/v1/' + table + '?select=' + champs, { headers: atEntetes(jeton) });
  const d = await atReponse(rep);
  return Array.isArray(d) ? d : [];
}

async function chargerDonneesDuServeur(silencieux) {
  if (typeof estModeEcole !== 'function' || !estModeEcole()) return false;
  const moi = await atQuiSuisJe();
  if (!moi || !moi.fiche) return false;
  const jeton = await atJeton();
  const etab = moi.fiche.etablissement_id;

  // ---- le personnel (pour relier les seances et les absences a une personne) ----
  const fiches = await atFichesPersonnel();
  const ficheParId = {};
  const cleDe = {};
  fiches.forEach(function (f) {
    ficheParId['' + f.id] = f;
    cleDe['' + f.id] = f.email || f.code || String(f.id);
  });

  // ---- classes et eleves ----
  const cls = await atLignes('classes', 'id,nom', jeton);
  const els = await atLignes('eleves', 'id,classe_id,code_massar,nom,prenom,actif', jeton);   // id inclus
  const classesServeur = cls.map(function (c) {
    return {
      id: c.id, nom: c.nom,
      eleves: els.filter(function (e) { return String(e.classe_id) === String(c.id); }).map(function (e) {
        return { id: e.id, massar: e.code_massar || '', nom: e.nom || '', prenom: e.prenom || '', actif: e.actif !== false };
      })
    };
  });
  const nomClasse = {};
  classesServeur.forEach(function (c) { nomClasse['' + c.id] = c.nom; });
  const eleveParId = {};
  classesServeur.forEach(function (c) { c.eleves.forEach(function (e) { eleveParId['' + e.id] = { eleve: e, classe: c }; }); });

  // ---- emplois du temps (seances) ----
  const sc = await atLignes('seances', 'id,prof_id,classe_id,jour,debut,fin,salle,matiere', jeton);
  const nomsProfs = {};
  const tableaux = {};
  sc.forEach(function (s) {
    const fiche = ficheParId['' + s.prof_id] || {};
    const k = cleDe['' + s.prof_id] || ('prof-' + s.prof_id);
    if (!tableaux[k]) tableaux[k] = [];
    tableaux[k].push({
      jour: s.jour, debut: heureCourte(s.debut), fin: heureCourte(s.fin || s.debut),
      classe: nomClasse['' + s.classe_id] || '', matiere: s.matiere || '',
      // « prof » porte l'ADRESSE de la fiche (la meme valeur que la liste deroulante des
      // absences du personnel) : c'est ce qui relie une seance a la personne, y compris
      // pour retrouver les seances annulees par une absence de ce professeur.
      prof: fiche.email || fiche.code || fiche.nom || '', salle: s.salle || ''
    });
    if (fiche.nom && !nomsProfs[k]) { nomsProfs[k] = fiche.nom; }
  });

  // ---- absences et retards ----
  const sig = await atLignes('signalements',
    'id,eleve_id,classe_id,prof_id,date_abs,moment,heure,type,retard_minutes,statut,motif', jeton);
  const absencesServeur = sig.map(function (s) {
    const e = eleveParId['' + s.eleve_id];
    const fiche = ficheParId['' + s.prof_id] || {};
    return {
      id: s.id,
      eleveId: s.eleve_id,
      nom: e ? (e.eleve.nom + (e.eleve.prenom ? ' ' + e.eleve.prenom : '')) : '',
      classe: nomClasse['' + s.classe_id] || (e ? e.classe.nom : ''),
      heure: heureCourte(s.heure),
      date: dateCourteFr(s.date_abs),
      dateISO: s.date_abs,
      seance: s.moment,
      type: s.type,
      duree: s.retard_minutes ? String(s.retard_minutes) : '',
      statut: s.statut, motif: s.motif || '',
      // le CODE de la fiche (pas l'adresse) : c'est l'identifiant que porte l'emploi du
      // temps, donc celui qui permet de retrouver les seances annulees par une absence.
      enseignant: fiche.code || fiche.email || fiche.nom || '', matiere: fiche.matiere || ''
    };
  });

  // ---- annulations de seance ----
  const ann = await atLignes('annulations_seances', 'id,date_seance,classe_id,debut,fin,motif', jeton);   // id inclus
  const annulationsServeur = ann.map(function (a) {
    // Une annulation dont le motif dit « Absence de ... » est une seance annulee PAR une
    // absence de personnel : elle appartient au Dashboard, PAS a la carte « Annulation de
    // seances » (celle des saisies directes). Cette marque manquait a la relecture : les
    // lignes venues de la base s'affichaient donc dans les deux endroits (defaut signale).
    const deduit = /^\s*absence\s+d/i.test(String(a.motif || ''));   // « Absence de ... » / « Absence du professeur »
    return {
      id: a.id, dateISO: a.date_seance, classe: nomClasse['' + a.classe_id] || '',
      debut: heureCourte(a.debut), fin: heureCourte(a.fin), motif: a.motif || '',
      origine: deduit ? 'absence' : 'saisie', genere: deduit
    };
  });

  // ---- fermetures ----
  const fer = await atLignes('fermetures', 'id,type,libelle,debut,fin,portee', jeton);
  const fermeturesServeur = fer.map(function (f) {
    return { id: f.id, type: f.type || 'Fermeture', libelle: f.libelle || '', debut: f.debut, fin: f.fin, portee: f.portee || 'journee' };
  });

  // ---- absences du personnel ----
  const ap = await atLignes('absences_personnel', 'id,prof_id,role_absent,debut,fin,portee,motif', jeton);
  const absencesPersonnelServeur = ap.map(function (a) {
    return {
      id: a.id, profCode: (ficheParId['' + a.prof_id] || {}).code || cleDe['' + a.prof_id] || '',
      role: a.role_absent,
      debut: a.debut, fin: a.fin, portee: a.portee || 'journee', motif: a.motif || ''
    };
  });

  // ---- on range dans la memoire du telephone (forme habituelle de l'application) ----
  // REGLE DE SECURITE : la base ne remplace une liste QUE si elle en a une. Si la base
  // est vide pour une famille, le travail du telephone est GARDE (il n'a pas encore ete
  // envoye) : rien ne doit jamais disparaitre a la connexion.
  const prendre = function (listeServeur, lireLocal, poser) {
    if (listeServeur && listeServeur.length) { poser(listeServeur); return listeServeur; }
    const local = lireLocal();
    return (local && local.length) ? local : [];
  };
  // Les eleves font partie de la famille « classes » : une base qui a des classes mais
  // AUCUN eleve (envoi interrompu) ne doit pas faire disparaitre les eleves du telephone.
  const localClasses = (function () { try { return chargerClasses(); } catch (e) { return []; } })();
  const totalElevesLocal = localClasses.reduce(function (n, c) { return n + (c.eleves || []).length; }, 0);
  if (classesServeur.length && (els.length > 0 || totalElevesLocal === 0)) {
    classes = classesServeur;
    Depot.ecrireJSON('classes', classesServeur);
    Depot.ecrire('absenceTrackVersion', DEMO_VERSION);
  } else {
    classes = localClasses;
  }
  tableauxService = (Object.keys(tableaux).length) ? tableaux
    : (function () { try { return chargerTableauxService(); } catch (e) { return {}; } })();
  if (Object.keys(tableaux).length) Depot.ecrireJSON('tableauxService_v2', tableaux);
  absences = prendre(absencesServeur, function () { return chargerListe('absences'); }, function (v) { Depot.ecrireJSON('absences', v); });
  seancesAnnulees = prendre(annulationsServeur, function () { return chargerListe('seancesAnnulees'); }, function (v) { Depot.ecrireJSON('seancesAnnulees', v); });
  fermeturesEtab = prendre(fermeturesServeur, function () { return chargerListe('fermeturesEtab'); }, function (v) { Depot.ecrireJSON('fermeturesEtab', v); });
  indispoProfs = prendre(absencesPersonnelServeur, function () { return chargerListe('indispoProfs'); }, function (v) { Depot.ecrireJSON('indispoProfs', v); });

  // Les donnees du telephone sont celles de CETTE ecole : l'etiquette suit.
  Depot.ecrire('etablissementDonnees', Depot.lire('etablissementDonnees', ''));
  try {
    const code = Depot.lire('ecoleOuverteCode', '');
    if (code) Depot.ecrire('etabDonnees', code);
    Depot.ecrire('etiquetteEcole', String(etab));
  } catch (e) {}

  // ---- LES IDENTIFIANTS DE LA BASE (indispensable pour MODIFIER une ligne) ----
  // Ils sont reconstruits ICI a partir de ce que la base vient de rendre : un telephone
  // qui gardait les identifiants d'une AUTRE ecole ne peut plus viser a cote (c'etait la
  // cause des modifications « perdues »).
  const anciens = idsEcole();
  const idsBase = { etablissement: etab, classes: {}, eleves: {}, seances: {}, signalements: {},
                    annulations_seances: {}, absences_personnel: {}, fermetures: {}, conflits: [],
                    elevesParId: anciens.elevesParId || {} };
  classesServeur.forEach(function (c) {
    idsBase.classes[String(c.nom)] = c.id;
    c.eleves.forEach(function (e) {
      const massar = String(e.massar || '').trim();
      idsBase.eleves[String(c.nom) + '|' + (massar || ('nom:' + (e.nom || '') + ' ' + (e.prenom || '')))] = e.id;
    });
  });
  sc.forEach(function (s) {
    const code = cleDe['' + s.prof_id] || ('prof-' + s.prof_id);
    idsBase.seances[code + '|' + s.jour + '|' + heureCourte(s.debut) + '|' + (nomClasse['' + s.classe_id] || '')] = s.id;
  });
  sig.forEach(function (s) {
    if (!s.eleve_id) return;
    idsBase.signalements[String(s.eleve_id) + '|' + s.date_abs + '|' + s.moment] = s.id;
  });
  ann.forEach(function (a) {
    idsBase.annulations_seances[a.date_seance + '|' + (nomClasse['' + a.classe_id] || '') + '|' + heureCourte(a.debut)] = a.id;
  });
  ap.forEach(function (a) {
    const cle = cleDe['' + a.prof_id] || '';
    if (cle) idsBase.absences_personnel[cle + '|' + a.debut + '|' + (a.fin || a.debut)] = a.id;
  });
  fer.forEach(function (f) {
    idsBase.fermetures[f.debut + '|' + (f.fin || f.debut) + '|' + (f.libelle || f.type || '')] = f.id;
  });
  sauverIdsEcole(idsBase);

  // Ce qui vient de la base est deja dans la base : on note les empreintes (sinon la
  // synchronisation renverrait tout a chaque connexion).
  try {
    Depot.ecrireJSON('nomsProfs', nomsProfs);            // les noms des professeurs (disque)
    if (typeof nomsProfsGlobal === 'undefined') { window.nomsProfsGlobal = nomsProfs; }
    Object.keys(nomsProfs).forEach(function (k) { if (!nomsProfs[k]) return; });
    // la memoire vive doit connaitre ces noms (sinon le motif d'une seance deduite
    // afficherait l'adresse du professeur au lieu de son nom)
    seancesAnnuleesParAbsence();                          // (aucun effet : simple lecture)
    if (typeof window !== 'undefined') { window.nomsProfs = nomsProfs; }
  } catch (e) {}
  if (typeof window !== 'undefined') window.atDonneesPretes = true;     // la base a parle
  // les seances annulees « deduites d'une absence » deviennent de vraies lignes (base)
  try { if (typeof purgerAnnulationsDeduitesEnregistrees === 'function') purgerAnnulationsDeduitesEnregistrees(); } catch (e) {}
  try { if (typeof alignerAnnulationsDeduites === 'function') alignerAnnulationsDeduites().catch(function () {}); } catch (e) {}
  if (typeof atSynchroNoterTout === 'function') atSynchroNoterTout();
  rafraichirEcransApresChargement();
  const totalAbs = absencesServeur.length;
  if (!silencieux) {
    afficherToast('Donnees de la base : ' + classesServeur.length + ' classe(s), ' +
      els.length + ' eleve(s), ' + sc.length + ' seance(s), ' + totalAbs + ' absence(s)', 'success');
  }
  return true;
}

// Redessine les ecrans ouverts avec les donnees qui viennent d'arriver.
function rafraichirEcransApresChargement() {
  const essais = [
    'remplirListeClasses', 'mettreAJourDashboardDir', 'mettreAJourDashboardSurv',
    'afficherListeProfs', 'afficherIndispos', 'afficherSeancesAnnulees',
    'afficherAnnulationsEnregistrees', 'appliquerTableauService', 'afficherInfosProf',
    'afficherListeEleves', 'afficherStatsDir'
  ];
  essais.forEach(function (nom) {
    try { if (typeof window[nom] === 'function') window[nom](); } catch (e) {}
  });
}

if (typeof window !== 'undefined') {
  window.chargerDonneesDuServeur = chargerDonneesDuServeur;
  window.rafraichirEcransApresChargement = rafraichirEcransApresChargement;
}
