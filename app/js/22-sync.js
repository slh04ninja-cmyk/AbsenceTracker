// fichier: app/js/22-sync.js
// ========== SYNCHRONISATION : CHAQUE MODIFICATION VA DANS LA BASE ==========
// Probleme signale (v4.11) : les modifications du directeur (approuver une absence,
// ajouter une absence de personnel, annuler une seance, importer des eleves, supprimer
// une ligne...) restaient sur le telephone. Seul le bouton « Envoyer mes donnees »
// les faisait monter.
//
// CE MODULE REPOND A CELA : des qu'une liste de travail change sur le telephone
// (absences, classes, absences du personnel, seances annulees, fermetures), la
// modification part dans la base — la ligne AJOUTEE est creee, la ligne MODIFIEE est
// mise a jour, la ligne SUPPRIMEE est retiree. Rien n'est renvoye inutilement : chaque
// ligne porte une empreinte (« signature ») ; seules les lignes qui ont change partent.
//
// Sur un telephone non relie, tout reste local : rien n'est envoye.

const SYNCHRO_DELAI = 700;          // on laisse la main a l'ecran avant d'envoyer
const atSyncMinuteurs = {};
const atSyncSignatures = {};

function synchroLire(famille) {
  try { return JSON.parse(Depot.lire('synchro_' + famille, '{}')) || {}; } catch (e) { return {}; }
}
function synchroEcrire(famille, objet) { Depot.ecrireJSON('synchro_' + famille, objet); }

// ---- les lignes du telephone, dans la forme attendue par la base ----
function atLignesSignalements() {
  const out = {};
  (absences || []).forEach(function (a) {
    const eleve = a.eleveId;
    if (!eleve) return;
    const cle = String(eleve) + '|' + a.dateISO + '|' + MOMENT_DE(a.seance);
    const statut = STATUT_DE(a);
    out[cle] = { cle: cle, corps: null, local: a, statut: statut, eleve: eleve };
  });
  return out;
}
function atLignesClasses() {
  const out = {};
  (classes || []).forEach(function (c) { out[String(c.nom)] = c; });
  return out;
}
function atLignesEleves() {
  const out = {};
  (classes || []).forEach(function (c) {
    (c.eleves || []).forEach(function (e) {
      const massar = String(e.massar || '').trim();
      out[String(c.nom) + '|' + (massar || ('nom:' + (e.nom || '') + ' ' + (e.prenom || '')))] = { classe: c, eleve: e };
    });
  });
  return out;
}
function atLignesSeances() {
  const out = {};
  Object.keys(tableauxService || {}).forEach(function (code) {
    (tableauxService[code] || []).forEach(function (s) {
      out[code + '|' + s.jour + '|' + s.debut + '|' + s.classe] = { code: code, seance: s };
    });
  });
  return out;
}
function atLignesIndispo() {
  const out = {};
  (indispoProfs || []).forEach(function (i) { out[i.profCode + '|' + i.debut + '|' + (i.fin || i.debut)] = i; });
  return out;
}
function atLignesAnnulations() {
  const out = {};
  // les saisies directes (la liste enregistree)
  (seancesAnnulees || []).forEach(function (sn) { out[sn.dateISO + '|' + sn.classe + '|' + sn.debut] = sn; });
  // + les seances annulees PAR une absence de personnel : calculees (modele v4.04) mais
  // elles doivent aussi aller dans la base — c'est leur seul chemin.
  try {
    if (typeof seancesAnnuleesParAbsence === 'function') {
      seancesAnnuleesParAbsence().forEach(function (sn) {
        const cle = sn.dateISO + '|' + sn.classe + '|' + sn.debut;
        if (out[cle]) return;                      // une saisie directe prime
        out[cle] = { dateISO: sn.dateISO, classe: sn.classe, debut: sn.debut, fin: sn.fin || '',
                     motif: motifAbsencePersonne(sn.profCode, sn.motif), origine: 'absence',
                     idAbsence: sn.idAbsence };
      });
    }
  } catch (e) {}
  return out;
}

// Le motif d'une seance annulee par une absence nomme LA PERSONNE (jamais un compte
// sans identifiant : plus de « Absence de Surveillant 1 »).
function motifAbsencePersonne(profCode, secours) {
  let nom = '';
  try { nom = nomProfCode(profCode) || ''; } catch (e) { nom = ''; }
  if (!nom) { try { nom = (nomsProfs || {})[profCode] || ''; } catch (e) { nom = ''; } }
  nom = String(nom || '').trim();
  if (!nom || /surveillant/i.test(nom) === false && nom === profCode) nom = String(nom || '').trim();
  return nom ? ('Absence de ' + nom) : (secours || 'Absence du professeur');
}
function atLignesFermetures() {
  const out = {};
  (fermeturesEtab || []).forEach(function (f) { out[f.debut + '|' + (f.fin || f.debut) + '|' + (f.libelle || f.type || '')] = f; });
  return out;
}

// ============================================================
// LA SYNCHRONISATION D'UNE FAMILLE
// ============================================================
async function atSynchroFamille(famille) {
  const pret = await atPretPourEcriture();
  if (!pret) return null;
  const moi = pret.moi;
  const jeton = pret.jeton;
  const etab = moi.fiche.etablissement_id;
  const estDirecteur = String(moi.fiche.role || '') === 'directeur';
  const ids = idsEcole();
  const vus = synchroLire(famille);
  const neuf = {};
  let crees = 0, majs = 0, retires = 0, rates = 0;

  // ---- une ligne de signalement (absence / retard) ----
  if (famille === 'absences') {
    const lignes = atLignesSignalements();
    // L'eleve du telephone -> l'eleve de la base : sans cette traduction, la base refuse
    // la ligne (elle ne connait pas cet eleve). On cherche d'abord dans les classes
    // chargees de la base, puis dans la correspondance gardee par l'envoi.
    const eleveDeBase = function (idLocal, classeNom, nomEleve) {
      const c = (classes || []).find(function (x) { return String(x.nom) === String(classeNom); });
      if (!c) return null;
      const dedans = function (e) { return '' + e.id === '' + idLocal; };
      if ((c.eleves || []).some(dedans)) return idLocal;                 // deja l'identifiant de la base
      const m = (ids.elevesParId || {})['' + idLocal];
      if (m) return m;                                                   // correspondance de l'envoi
      const n = String(nomEleve || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (n) {
        const trouve = (c.eleves || []).find(function (e) {
          return (String(e.nom || '') + ' ' + String(e.prenom || '')).replace(/\s+/g, ' ').trim().toLowerCase() === n;
        });
        if (trouve) return trouve.id;
      }
      return null;
    };
    for (const cle of Object.keys(lignes)) {
      const L = lignes[cle];
      const a = L.local;
      const sig = [L.statut, a.motif || '', a.type || 'absence', a.heure || '', a.seance || '',
                   a.classe || '', a.justifiePar || '', a.justifieLe || '', a.duree || ''].join('~');
      if (vus[cle] === sig && (ids.signalements || {})[cle]) { neuf[cle] = sig; continue; }
      try {
        const eleveBase = eleveDeBase(a.eleveId, a.classe, a.nom);
        if (!eleveBase) { rates++; continue; }                 // eleve pas encore dans la base
        const cid = await atClasseIdParNom(a.classe, jeton);
        const pid = (await atProfilIdDe(a.enseignant)) || moi.fiche.id;
        if (!cid) { rates++; continue; }
        const statut = STATUT_DE(a);
        const corps = {
          etablissement_id: etab, eleve_id: eleveBase, classe_id: cid, prof_id: pid,
          date_abs: a.dateISO, moment: MOMENT_DE(a.seance), heure: HEURE_DE(a),
          type: (a.type === 'retard' ? 'retard' : 'absence'),
          retard_minutes: (a.type === 'retard' ? (parseInt(String(a.duree || '0'), 10) || 5) : null),
          statut: statut, motif: a.motif || null, signale_par: (ids.signalements[cle] ? undefined : moi.fiche.id)
        };
        if (statut !== 'absent') {
          corps.decide_par = (await atProfilIdDe(a.justifiePar)) || moi.fiche.id;
          corps.decide_le = HORODATAGE(a.justifieLe);
        }
        if (corps.signale_par === undefined) delete corps.signale_par;
        const id = await envoyerLigne(ids, 'signalements', cle, corps, jeton);
        if (id || ids.signalements[cle]) { neuf[cle] = sig; if (vus[cle]) majs++; else crees++; }
        else rates++;
      } catch (e) { rates++; }
    }
  }

  // ---- les classes et les eleves (le directeur seulement) ----
  if (famille === 'classes' && estDirecteur) {
    const cls = atLignesClasses();
    for (const nom of Object.keys(cls)) {
      const sig = 'c:' + (cls[nom].nom || '');
      if (vus['c|' + nom] === sig && (ids.classes || {})[nom]) { neuf['c|' + nom] = sig; continue; }
      try {
        const id = await envoyerLigne(ids, 'classes', nom, { etablissement_id: etab, nom: nom }, jeton);
        if (id || ids.classes[nom]) { neuf['c|' + nom] = sig; crees++; }
      } catch (e) { rates++; }
    }
    const els = atLignesEleves();
    for (const cle of Object.keys(els)) {
      const E = els[cle];
      const e = E.eleve;
      const sig = 'e:' + [e.nom || '', e.prenom || '', e.actif !== false ? 1 : 0].join('~');
      if (vus['e|' + cle] === sig && (ids.eleves || {})[cle]) { neuf['e|' + cle] = sig; continue; }
      try {
        const massar = String(e.massar || '').trim();
        const id = await envoyerLigne(ids, 'eleves', cle, {
          classe_id: ids.classes[String(E.classe.nom)], code_massar: massar ? massar : null,
          nom: e.nom || '', prenom: e.prenom || '', actif: e.actif !== false
        }, jeton);
        if (id || ids.eleves[cle]) { neuf['e|' + cle] = sig; crees++; }
      } catch (err) { rates++; }
    }
  }

  // ---- les emplois du temps ----
  if (famille === 'seances' && estDirecteur) {
    const se = atLignesSeances();
    for (const cle of Object.keys(se)) {
      const s = se[cle].seance; const code = se[cle].code;
      const sig = [s.jour, s.debut, s.fin || '', s.matiere || '', s.salle || ''].join('~');
      if (vus[cle] === sig && (ids.seances || {})[cle]) { neuf[cle] = sig; continue; }
      try {
        const pid = await atProfilIdDe(code);
        const cid = await atClasseIdParNom(s.classe, jeton);
        if (!pid || !cid) { rates++; continue; }
        const id = await envoyerLigne(ids, 'seances', cle, {
          etablissement_id: etab, prof_id: pid, classe_id: cid, jour: s.jour, debut: s.debut,
          fin: s.fin || s.debut, salle: s.salle || '', matiere: s.matiere || ''
        }, jeton);
        if (id || ids.seances[cle]) { neuf[cle] = sig; crees++; }
      } catch (e) { rates++; }
    }
  }

  // ---- les absences du personnel ----
  if (famille === 'indispoProfs' && estDirecteur) {
    const ind = atLignesIndispo();
    for (const cle of Object.keys(ind)) {
      const i = ind[cle];
      const sig = [roleAbsence(i), i.motif || '', i.portee || '', i.fin || ''].join('~');
      if (vus[cle] === sig && (ids.absences_personnel || {})[cle]) { neuf[cle] = sig; continue; }
      try {
        const pid = await atProfilIdDe(i.profCode);
        if (!pid) { rates++; continue; }
        const id = await envoyerLigne(ids, 'absences_personnel', cle, {
          etablissement_id: etab, prof_id: pid,
          role_absent: (roleAbsence(i) === 'enseignant' ? 'enseignant' : 'surveillant'),
          debut: i.debut, fin: i.fin || i.debut, portee: i.portee || 'journee',
          motif: i.motif || '', cree_par: moi.fiche.id
        }, jeton);
        if (id || ids.absences_personnel[cle]) { neuf[cle] = sig; crees++; }
      } catch (e) { rates++; }
    }
  }

  // ---- les annulations de seance ----
  if (famille === 'seancesAnnulees' && estDirecteur) {
    const ann = atLignesAnnulations();
    for (const cle of Object.keys(ann)) {
      const sn = ann[cle];
      const sig = [sn.debut, sn.fin || '', sn.motif || ''].join('~');
      if (vus[cle] === sig && (ids.annulations_seances || {})[cle]) { neuf[cle] = sig; continue; }
      try {
        const cid = await atClasseIdParNom(sn.classe, jeton);
        if (!cid) { rates++; continue; }
        const id = await envoyerLigne(ids, 'annulations_seances', cle, {
          etablissement_id: etab, date_seance: sn.dateISO, classe_id: cid,
          debut: sn.debut, fin: sn.fin || sn.debut, motif: sn.motif || '', cree_par: moi.fiche.id
        }, jeton);
        if (id || ids.annulations_seances[cle]) { neuf[cle] = sig; crees++; }
      } catch (e) { rates++; }
    }
  }

  // ---- les fermetures ----
  if (famille === 'fermeturesEtab' && estDirecteur) {
    const fer = atLignesFermetures();
    for (const cle of Object.keys(fer)) {
      const f = fer[cle];
      const sig = [f.type || '', f.portee || '', f.fin || ''].join('~');
      if (vus[cle] === sig && (ids.fermetures || {})[cle]) { neuf[cle] = sig; continue; }
      try {
        const id = await envoyerLigne(ids, 'fermetures', cle, {
          etablissement_id: etab, type: f.type || 'Fermeture', libelle: f.libelle || '',
          debut: f.debut, fin: f.fin || f.debut, portee: f.portee || 'journee', cree_par: moi.fiche.id
        }, jeton);
        if (id || ids.fermetures[cle]) { neuf[cle] = sig; crees++; }
      } catch (e) { rates++; }
    }
  }

  // ---- les lignes qui ne sont plus sur le telephone sont retirees de la base ----
  const table = { absences: 'signalements', indispoProfs: 'absences_personnel',
                  seancesAnnulees: 'annulations_seances', fermeturesEtab: 'fermetures', seances: 'seances' }[famille];
  if (famille === 'classes' && estDirecteur) {
    // une classe retiree (et ses eleves) ou un eleve retire quitte aussi la base
    for (const cle of Object.keys(vus)) {
      if (neuf[cle] !== undefined) continue;
      if (cle.indexOf('c|') === 0) {
        const nom = cle.slice(2);
        const id = (ids.classes || {})[nom];
        if (id) { try { await atSupprimer('classes', id, jeton); delete ids.classes[nom]; retires++; } catch (e) { rates++; } }
      } else if (cle.indexOf('e|') === 0) {
        const k = cle.slice(2);
        const id = (ids.eleves || {})[k];
        if (id) { try { await atSupprimer('eleves', id, jeton); delete ids.eleves[k]; retires++; } catch (e) { rates++; } }
      }
    }
  } else if (table) {
    for (const cle of Object.keys(vus)) {
      if (neuf[cle] !== undefined) continue;
      const id = (ids[table] || {})[cle];
      if (!id) continue;
      try { await atSupprimer(table, id, jeton); delete ids[table][cle]; retires++; } catch (e) { rates++; }
    }
  }

  sauverIdsEcole(ids);
  synchroEcrire(famille, neuf);
  return { crees: crees, majs: majs, retires: retires, rates: rates };
}

// Une modification a eu lieu sur le telephone : on envoie peu apres (regroupe).
function atSynchroAuto(famille) {
  if (typeof estModeEcole !== 'function' || !estModeEcole()) return;
  // Tant que les donnees ne viennent pas de la base, on n'ecrit rien : la ligne doit
  // d'abord exister dans la base (c'est l'envoi qui la cree, avec la bonne traduction
  // des eleves). Sans cette garde, des lignes au nom d'eleves inconnus etaient refusees.
  if (typeof window !== 'undefined' && window.atDonneesPretes !== true) return;
  if (atSyncMinuteurs[famille]) clearTimeout(atSyncMinuteurs[famille]);
  atSyncMinuteurs[famille] = setTimeout(function () {
    atSyncMinuteurs[famille] = null;
    atSynchroFamille(famille).catch(function () {});
  }, SYNCHRO_DELAI);
}

// Tout envoyer (utilise apres l'envoi global et a la connexion).
async function atSynchroTout() {
  const ordre = ['classes', 'seances', 'absences', 'indispoProfs', 'seancesAnnulees', 'fermeturesEtab'];
  for (const f of ordre) { try { await atSynchroFamille(f); } catch (e) {} }
}

// Les empreintes de ce qui est actuellement sur le telephone (memes regles que l'envoi).
function atSignaturesLocales() {
  const S = { absences: {}, classes: {}, seances: {}, indispoProfs: {}, seancesAnnulees: {}, fermeturesEtab: {} };
  const eleveBase = function (idLocal, classeNom, nomEleve) {
    const c = (classes || []).find(function (x) { return String(x.nom) === String(classeNom); });
    const dedans = function (e) { return '' + e.id === '' + idLocal; };
    if (c && (c.eleves || []).some(dedans)) return idLocal;
    const ids0 = idsEcole();
    const m = (ids0.elevesParId || {})['' + idLocal];
    if (m) return m;
    const n = String(nomEleve || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (c && n) {
      const tr = (c.eleves || []).find(function (e) {
        return (String(e.nom || '') + ' ' + String(e.prenom || '')).replace(/\s+/g, ' ').trim().toLowerCase() === n;
      });
      if (tr) return tr.id;
    }
    return null;
  };
  (absences || []).forEach(function (a) {
    if (!a.eleveId) return;
    const eb = eleveBase(a.eleveId, a.classe, a.nom);
    if (!eb) return;
    S.absences[String(eb) + '|' + a.dateISO + '|' + MOMENT_DE(a.seance)] =
      [STATUT_DE(a), a.motif || '', a.type || 'absence', a.heure || '', a.seance || '', a.classe || '',
       a.justifiePar || '', a.justifieLe || '', a.duree || ''].join('~');
  });
  (classes || []).forEach(function (c) {
    S.classes['c|' + String(c.nom)] = 'c:' + (c.nom || '');
    (c.eleves || []).forEach(function (e) {
      const massar = String(e.massar || '').trim();
      S.classes['e|' + String(c.nom) + '|' + (massar || ('nom:' + (e.nom || '') + ' ' + (e.prenom || '')))] =
        'e:' + [e.nom || '', e.prenom || '', e.actif !== false ? 1 : 0].join('~');
    });
  });
  Object.keys(tableauxService || {}).forEach(function (code) {
    (tableauxService[code] || []).forEach(function (s) {
      S.seances[code + '|' + s.jour + '|' + s.debut + '|' + s.classe] =
        [s.jour, s.debut, s.fin || '', s.matiere || '', s.salle || ''].join('~');
    });
  });
  (indispoProfs || []).forEach(function (i) {
    S.indispoProfs[i.profCode + '|' + i.debut + '|' + (i.fin || i.debut)] =
      [roleAbsence(i), i.motif || '', i.portee || '', i.fin || ''].join('~');
  });
  (seancesAnnulees || []).forEach(function (sn) {
    S.seancesAnnulees[sn.dateISO + '|' + sn.classe + '|' + sn.debut] = [sn.debut, sn.fin || '', sn.motif || ''].join('~');
  });
  (fermeturesEtab || []).forEach(function (f) {
    S.fermeturesEtab[f.debut + '|' + (f.fin || f.debut) + '|' + (f.libelle || f.type || '')] = [f.type || '', f.portee || '', f.fin || ''].join('~');
  });
  return S;
}
// Ce qui vient d'etre envoye (ou lu de la base) est deja enregistre : on note les
// empreintes pour ne rien renvoyer inutilement.
function atSynchroNoterTout() {
  const S = atSignaturesLocales();
  Object.keys(S).forEach(function (k) { synchroEcrire(k, S[k]); });
}

// ============================================================
// LES SEANCES DEDUITES D'UNE ABSENCE DE PROF : ecrites dans la base
// ============================================================
// Une seule regle, la meme pour les trois gestes du directeur :
//   - il AJOUTE une absence      -> les seances deduites sont CREEES dans la base
//   - il MODIFIE (duree, motif)  -> les seances deduites sont MISE A JOUR
//   - il SUPPRIME l'absence      -> les seances deduites sont SUPPRIMEES de la base
// A chaque fois on recalcule ce qui est SOUHAITE, puis on aligne la base sur ce souhait.
// L'identite d'une seance deduite est : date + classe + heure de debut. C'est ce qui
// permet de la retrouver pour la mettre a jour ou la retirer (et d'eviter les doublons).
async function alignerAnnulationsDeduites() {
  const pret = await atPretPourEcriture();
  if (!pret) return null;
  try {
    if (!pret.moi || String(pret.moi.fiche.role || '') !== 'directeur') return null;   // seul le directeur ecrit
    const jeton = pret.jeton;
    const etab = pret.moi.fiche.etablissement_id;
    const ids = idsEcole();

    // 1. ce qui est SOUHAITE (le calcul de l'application, comme dans le Dashboard)
    const souhaite = {};
    let calculees = [];
    try { calculees = (typeof seancesAnnuleesParAbsence === 'function') ? seancesAnnuleesParAbsence() : []; } catch (e) { calculees = []; }
    calculees.forEach(function (sn) {
      const cle = String(sn.dateISO) + '|' + String(sn.classe) + '|' + String(sn.debut);
      souhaite[cle] = sn;
    });

    // 2. ce que la base porte deja pour les seances deduites (motif « Absence de ... »)
    const lignes = await atLignesServeur('annulations_seances', 'id,date_seance,classe_id,debut,fin,motif', jeton);
    const nomClasse = {};
    (classes || []).forEach(function (c) { nomClasse['' + c.id] = c.nom; });
    const enBase = {};
    lignes.forEach(function (a) {
      if (!/^\s*absence\s+d/i.test(String(a.motif || ''))) return;      // saisie directe : intouchable
      const cle = String(a.date_seance) + '|' + (nomClasse['' + a.classe_id] || '') + '|' + heureDeTexte(a.debut);
      enBase[cle] = a;
    });

    // 3. on aligne : creer ce qui manque, mettre a jour ce qui a change
    let crees = 0, majs = 0, supprimes = 0;
    for (const cle of Object.keys(souhaite)) {
      const sn = souhaite[cle];
      const motif = (typeof motifAbsencePersonne === 'function')
        ? motifAbsencePersonne(sn.profCode, 'Absence du professeur') : 'Absence du professeur';
      const cid = await atClasseIdParNom(sn.classe, jeton);
      if (!cid) continue;
      const corps = { etablissement_id: etab, date_seance: sn.dateISO, classe_id: cid,
                      debut: sn.debut, fin: sn.fin || sn.debut, motif: motif, cree_par: pret.moi.fiche.id };
      const deja = enBase[cle];
      if (deja) {
        if (String(deja.motif || '') !== motif || String(heureDeTexte(deja.debut)) !== String(sn.debut)) {
          await atPatch('annulations_seances', deja.id, corps, jeton); majs++;
        }
      } else {
        const cree = await atPost('annulations_seances', corps, jeton);
        if (cree && cree.id) { if (!ids.annulations_seances) ids.annulations_seances = {}; ids.annulations_seances[cle] = cree.id; crees++; }
      }
    }

    // 4. ce qui n'est PLUS souhaite (absence supprimee ou raccourcie) quitte la base
    for (const cle of Object.keys(enBase)) {
      if (souhaite[cle]) continue;
      try { await atSupprimer('annulations_seances', enBase[cle].id, jeton); supprimes++; } catch (e) {}
    }
    sauverIdsEcole(ids);
    if (crees || majs || supprimes) {
      afficherToast('Seances annulees par absence : base mise a jour (' + crees + ' ajout, ' + majs + ' modif, ' + supprimes + ' retrait)', 'success');
    }
    return { crees: crees, majs: majs, supprimes: supprimes };
  } catch (e) { return null; }
}

function heureDeTexte(v) { const s = String(v || ''); return s.length >= 5 ? s.slice(0, 5) : s; }
async function atLignesServeur(table, champs, jeton) {
  const rep = await fetch(AT_BASE + '/rest/v1/' + table + '?select=' + champs, { headers: atEntetes(jeton) });
  const d = await atReponse(rep);
  return Array.isArray(d) ? d : [];
}

// ============================================================
// RAFRAICHISSEMENT AUTOMATIQUE (toutes les 5 secondes)
// ============================================================
// But : que le telephone et la base ne se separent JAMAIS. A chaque tour :
//   1. ce qui a change sur le telephone part dans la base (ajout, modification, suppression)
//   2. la base est relue et l'ecran est redessine
// Le tour ne se lance QUE si l'application est ouverte et connectee, et jamais deux tours
// en meme temps. Rien n'est envoye s'il n'y a rien de nouveau (les empreintes evitent
// les ecritures inutiles).
let atRafraichissementOrdre = null;
let atRafraichissementEnCours = false;

async function atUnTourDeRafraichissement() {
  if (atRafraichissementEnCours) return;                                     // un tour a la fois
  if (typeof estModeEcole !== 'function' || !estModeEcole()) return;         // telephone libre
  if (typeof document !== 'undefined' && document.hidden) return;            // application en arriere-plan
  try { if (!atChargerSession || !atChargerSession() || !atChargerSession().access_token) return; } catch (e) { return; }
  atRafraichissementEnCours = true;
  try {
    // 1. le telephone -> la base
    if (typeof atSynchroTout === 'function') { try { await atSynchroTout(); } catch (e) {} }
    if (typeof alignerAnnulationsDeduites === 'function') { try { await alignerAnnulationsDeduites(); } catch (e) {} }
    // 2. la base -> le telephone (et l'ecran se redessine)
    if (typeof chargerDonneesDuServeur === 'function') { try { await chargerDonneesDuServeur(true); } catch (e) {} }
    if (typeof verifierBlocageAbsence === 'function') { try { verifierBlocageAbsence(); } catch (e) {} }
  } finally { atRafraichissementEnCours = false; }
}

function demarrerRafraichissementAuto(secondes) {
  const delai = Math.max(5, parseInt(secondes || 5, 10) || 5) * 1000;
  if (atRafraichissementOrdre) clearInterval(atRafraichissementOrdre);
  atRafraichissementOrdre = setInterval(function () { atUnTourDeRafraichissement(); }, delai);
  return delai;
}

if (typeof window !== 'undefined') {
  window.atUnTourDeRafraichissement = atUnTourDeRafraichissement;
  window.demarrerRafraichissementAuto = demarrerRafraichissementAuto;
  window.alignerAnnulationsDeduites = alignerAnnulationsDeduites;
  window.atSynchroFamille = atSynchroFamille;
  window.atSynchroNoterTout = atSynchroNoterTout;
  window.atSynchroAuto = atSynchroAuto;
  window.atSynchroTout = atSynchroTout;
}
