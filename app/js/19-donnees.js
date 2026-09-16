// fichier: app/js/19-donnees.js
// ========== LES DONNEES SUR LE SERVEUR (etape 1 : montee) ==========
// Regle de conception : l'ECOLE, les COMPTES et le PERSONNEL sont deja sur le serveur ;
// les DONNEES de travail (classes, eleves, emplois du temps, absences, annulations,
// fermetures, absences du personnel) doivent y etre aussi.
// L'application envoie ce qu'elle a sur le telephone, puis RELIT du serveur et COMPARE
// les nombres : on ne dit jamais « c'est envoye » sans le prouver.
//
// Chaque ligne envoyee garde son identifiant de base dans la memoire du telephone
// (`idsEcole`) : renvoyer deux fois met a jour au lieu de dupliquer.
//
// v4.08 — ce que la vraie ecole a appris (essai outils/essai_reel.js) :
//   1. un eleve peut ne PAS avoir de code MASSAR : la base accepte plusieurs eleves
//      sans code (on envoie « vide » et non une chaine vide, qui bloquait la 2eme ligne) ;
//   2. les absences du telephone nomment le professeur par son NOM (« أيوب الكمرة »),
//      pas par son adresse : on relie donc aussi par le nom ;
//   3. une absence justifiee doit porter QUI a decide et QUAND (regle de la base) ;
//   4. l'heure d'un signalement est obligatoire dans la base ;
//   5. un emploi du temps s'envoie en ATTENDANT la reponse (avant, il partait sans
//      attendre : le rapport annoncait 0 seance alors qu'elles montaient) ;
//   6. une ligne qui ne peut pas partir (professeur inconnu, eleve absent de la base)
//      ne doit PAS arreter tout l'envoi : elle est notee et l'envoi continue.

function idsEcole() {
  try { return JSON.parse(Depot.lire('idsEcole', '{}')) || {}; } catch (e) { return {}; }
}
function sauverIdsEcole(ids) { Depot.ecrireJSON('idsEcole', ids); }

async function atPost(table, corps, jeton) {
  const entetes = Object.assign(atEntetes(jeton, true), { Prefer: 'return=representation' });
  const rep = await fetch(AT_BASE + '/rest/v1/' + table, { method: 'POST', headers: entetes, body: JSON.stringify(corps) });
  const d = await atReponse(rep);
  return Array.isArray(d) ? d[0] : d;
}

async function atPatch(table, id, corps, jeton) {
  const entetes = atEntetes(jeton, true); entetes.Prefer = 'return=representation';
  const rep = await fetch(AT_BASE + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH', headers: entetes, body: JSON.stringify(corps)
  });
  const d = await atReponse(rep);
  return Array.isArray(d) ? d[0] : d;
}

async function atLire(table, jeton, champs) {
  const rep = await fetch(AT_BASE + '/rest/v1/' + table + '?select=' + (champs || 'id'), { headers: atEntetes(jeton) });
  return (await atReponse(rep)) || [];
}

// Envoie une ligne : met a jour si on la connait deja, cree sinon.
async function envoyerLigne(ids, table, cle, corps, jeton) {
  if (!ids[table]) ids[table] = {};
  const connu = ids[table][cle];
  if (connu) { await atPatch(table, connu, corps, jeton); return connu; }
  try {
    const cree = await atPost(table, corps, jeton);
    if (cree && cree.id !== undefined) ids[table][cle] = cree.id;
    return cree && cree.id;
  } catch (e) {
    // Une ligne deja presente sur le serveur (envoyee par un autre telephone) ne doit pas
    // arreter tout l'envoi : on la note et on continue.
    if (e && (e.statut === 409 || /duplicate key/i.test(String(e.message)))) {
      if (!ids.conflits) ids.conflits = [];
      ids.conflits.push(table + ' : deja sur le serveur (' + cle + ')');
      return null;
    }
    throw e;
  }
}

const MOMENT_DE = function (seance) {
  const s = String(seance || '').toLowerCase();
  return (s.indexOf('apres') >= 0 || s.indexOf('après') >= 0 || s.indexOf('soir') >= 0) ? 'apres-midi' : 'matin';
};

// L'heure d'un signalement est OBLIGATOIRE dans la base ; le telephone ne l'a pas toujours.
const HEURE_DE = function (a) {
  const h = String(a.heure || '').trim();
  if (/^\d{1,2}:\d{2}/.test(h)) return h.length === 4 ? '0' + h : h;
  return MOMENT_DE(a.seance) === 'matin' ? '08:00' : '14:00';
};

// « justifie_s » (par un surveillant) et « justifie_d » (par le directeur) ne sont pas
// des absences : la base exige alors QUI a decide et QUAND.
const STATUT_DE = function (a) {
  const s = String(a.statut || '');
  if (s === 'justifie_s' || s === 'justifie_d' || a.justifie) return s === 'justifie_s' ? 'justifie_s' : 'justifie_d';
  return 'absent';
};
const HORODATAGE = function (v) {
  const s = String(v || '').trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.length === 16 ? s + ':00' : s;
  return new Date().toISOString();
};

// ============================================================
// ENVOYER MES DONNEES AU SERVEUR (puis verifier)
// ============================================================
async function envoyerMesDonnees() {
  const moi = await atQuiSuisJe();
  if (!moi || !moi.fiche) { afficherToast('Connectez-vous au serveur d abord', 'error'); return null; }
  const etab = moi.fiche.etablissement_id;
  const jeton = await atJeton();
  const ids = idsEcole();
  const estDirecteur = String(moi.fiche.role || '') === 'directeur';
  const fait = { classes: 0, eleves: 0, seances: 0, signalements: 0, annulations: 0, fermetures: 0, absences_personnel: 0 };
  const nonEnvoyes = [];
  const noter = function (famille, raison) { nonEnvoyes.push(famille + ' : ' + raison); };

  afficherToast('Envoi des donnees...', 'info');
  try {
    // 0. les fiches du personnel : on relie un professeur par son code, son adresse ou son NOM
    //    (les emplois du temps et les absences du telephone le nomment par son nom).
    const fiches = await atFichesPersonnel();
    const fichePar = {};
    const cle = function (v) { return String(v || '').toLowerCase().trim(); };
    fiches.forEach(function (f) {
      if (f.code) fichePar[cle(f.code)] = f.id;
      if (f.email) fichePar[cle(f.email)] = f.id;
      if (f.email) fichePar[cle(String(f.email).split('@')[0])] = f.id;
      if (f.nom) fichePar[cle(f.nom)] = f.id;
    });
    const profId = function (v) {
      const c = cle(v);
      if (!c) return null;
      return fichePar[c] || fichePar[c.split('@')[0]] || null;
    };
    const classeId = function (nom) { return ids.classes[String(nom)] || null; };

    // 0 bis. On reprend ce qui est DEJA sur le serveur : si un autre telephone a envoye
    // les memes classes et les memes eleves, on ne les recree pas (aucun doublon).
    ids.classes = ids.classes || {};
    ids.eleves = ids.eleves || {};
    ids.elevesParId = ids.elevesParId || {};
    (await atLire('classes', jeton, 'id,nom')).forEach(function (c) { ids.classes[String(c.nom)] = c.id; });
    const classeParId = {};
    Object.keys(ids.classes).forEach(function (nom) { classeParId['' + ids.classes[nom]] = nom; });
    (await atLire('eleves', jeton, 'id,classe_id,code_massar,nom,prenom')).forEach(function (e) {
      const nom = classeParId['' + e.classe_id];
      if (!nom) return;
      ids.eleves[nom + '|' + (e.code_massar || ('nom:' + (e.nom || '') + ' ' + (e.prenom || '')))] = e.id;
    });

    // 1. les classes (le directeur seulement : un surveillant ou un enseignant
    //    n'a pas a creer de classes ni d'eleves — la base le lui refuse d'ailleurs)
    try {
      for (const c of (estDirecteur ? classes : [])) {
        const id = await envoyerLigne(ids, 'classes', String(c.nom), { etablissement_id: etab, nom: c.nom }, jeton);
        ids.classes[String(c.nom)] = id;
        fait.classes++;
      }
    } catch (e) { noter('classes', (e && e.message) || e); }

    // 2. les eleves. Un eleve sans code MASSAR est frequent (nouvelle inscription) :
    //    la base accepte plusieurs eleves sans code, a condition d'envoyer « vide » (null).
    try {
      for (const c of (estDirecteur ? classes : [])) {
        for (const e of (c.eleves || [])) {
          const massar = String(e.massar || '').trim();
          const cleLigne = String(c.nom) + '|' + (massar || ('nom:' + (e.nom || '') + ' ' + (e.prenom || '')));
          const idBase = await envoyerLigne(ids, 'eleves', cleLigne, {
            classe_id: ids.classes[String(c.nom)], code_massar: massar ? massar : null,
            nom: e.nom || '', prenom: e.prenom || '', actif: e.actif !== false
          }, jeton);
          if (!ids.elevesParId) ids.elevesParId = {};
          ids.elevesParId['' + e.id] = idBase;
          fait.eleves++;
        }
      }
    } catch (e) { noter('eleves', (e && e.message) || e); }

    // 3. les emplois du temps (seances) — EN ATTENDANT chaque ligne (defaut v4.07 corrige)
    try {
      for (const code of (estDirecteur ? Object.keys(tableauxService || {}) : [])) {
        for (const c of (tableauxService[code] || [])) {
          const cl = code + '|' + c.jour + '|' + c.debut + '|' + c.classe;
          const pid = profId(code);
          const cid = classeId(c.classe);
          if (!pid || !cid) { noter('emploi du temps', (c.classe || '?') + ' ' + (c.jour || '?') + ' ' + (c.debut || '?') + (pid ? '' : ' (professeur inconnu)')); continue; }
          await envoyerLigne(ids, 'seances', cl, {
            etablissement_id: etab, prof_id: pid, classe_id: cid,
            jour: c.jour, debut: c.debut, fin: c.fin || c.debut, salle: c.salle || '', matiere: c.matiere || ''
          }, jeton);
          fait.seances++;
        }
      }
    } catch (e) { noter('emplois du temps', (e && e.message) || e); }

    // 4. les signalements (absences et retards)
    try {
      for (const a of absences) {
        const eleve = (ids.elevesParId || {})['' + a.eleveId] || null;
        const pid = profId(a.enseignant);
        const cid = classeId(a.classe);
        if (!eleve || !pid || !cid) {
          noter('absences / retards', (a.nom || '?') + ' ' + (a.date || '?') + (eleve ? '' : ' (eleve absent de la base)') + (pid ? '' : ' (professeur inconnu)'));
          continue;
        }
        const cl = eleve + '|' + a.dateISO + '|' + MOMENT_DE(a.seance);
        const statut = STATUT_DE(a);
        const corps = {
          etablissement_id: etab, eleve_id: eleve, classe_id: cid, prof_id: pid,
          date_abs: a.dateISO, moment: MOMENT_DE(a.seance), heure: HEURE_DE(a),
          type: (a.type === 'retard' ? 'retard' : 'absence'),
          retard_minutes: (a.type === 'retard' ? (parseInt(String(a.duree || '0'), 10) || 5) : null),
          statut: statut, motif: a.motif || null,
          // La base n'accepte un signalement que s'il est signe par la personne connectee
          // (regle d'integrite : on ne signale pas a la place d'un collegue). Ici, c'est le
          // directeur qui fait la montee : c'est donc lui qui signe ; le professeur concerne
          // reste porte par « prof_id ».
          signale_par: moi.fiche.id
        };
        if (statut !== 'absent') {
          corps.decide_par = profId(a.justifiePar) || moi.fiche.id;
          corps.decide_le = HORODATAGE(a.justifieLe);
        }
        await envoyerLigne(ids, 'signalements', cl, corps, jeton);
        fait.signalements++;
      }
    } catch (e) { noter('absences / retards', (e && e.message) || e); }

    // 5. les annulations de seances
    try {
      for (const sn of (estDirecteur ? seancesAnnulees : [])) {
        const cid = classeId(sn.classe);
        if (!cid) { noter('annulations de seance', String(sn.classe || '?') + ' ' + String(sn.dateISO || '?')); continue; }
        await envoyerLigne(ids, 'annulations_seances', sn.dateISO + '|' + sn.classe + '|' + sn.debut, {
          etablissement_id: etab, date_seance: sn.dateISO, classe_id: cid,
          debut: sn.debut, fin: sn.fin || sn.debut, motif: sn.motif || '', cree_par: moi.fiche.id
        }, jeton);
        fait.annulations++;
      }
    } catch (e) { noter('annulations de seance', (e && e.message) || e); }

    // 6. les fermetures
    try {
      for (const f of (estDirecteur ? fermeturesEtab : [])) {
        await envoyerLigne(ids, 'fermetures', f.debut + '|' + (f.fin || f.debut) + '|' + (f.libelle || f.type || ''), {
          etablissement_id: etab, type: f.type || 'Fermeture', libelle: f.libelle || '',
          debut: f.debut, fin: f.fin || f.debut, portee: f.portee || 'journee', cree_par: moi.fiche.id
        }, jeton);
        fait.fermetures++;
      }
    } catch (e) { noter('fermetures', (e && e.message) || e); }

    // 7. les absences du personnel
    try {
      for (const i of (estDirecteur ? indispoProfs : [])) {
        const pid = profId(i.profCode);
        if (!pid) { noter('absences du personnel', String(i.profCode || '?') + ' (professeur inconnu)'); continue; }
        await envoyerLigne(ids, 'absences_personnel', i.profCode + '|' + i.debut + '|' + (i.fin || i.debut), {
          etablissement_id: etab, prof_id: pid,
          role_absent: (roleAbsence(i) === 'enseignant' ? 'enseignant' : 'surveillant'),
          debut: i.debut, fin: i.fin || i.debut, portee: i.portee || 'journee',
          motif: i.motif || '', cree_par: moi.fiche.id
        }, jeton);
        fait.absences_personnel++;
      }
    } catch (e) { noter('absences du personnel', (e && e.message) || e); }

    sauverIdsEcole(ids);
    // Les donnees du telephone appartiennent desormais a CETTE ecole : une autre ecole
    // ouverte sur le meme telephone ne les montrera jamais (voir 20-ecole.js).
    if (typeof poserEtiquetteEcole === 'function') poserEtiquetteEcole(etab);

    // ---- CE QUI EST SUR LE SERVEUR (on relit, on ne suppose pas) ----
    const sur = {
      classes: (await atLire('classes', jeton, 'id')).length,
      eleves: (await atLire('eleves', jeton, 'id')).length,
      seances: (await atLire('seances', jeton, 'id')).length,
      signalements: (await atLire('signalements', jeton, 'id')).length,
      annulations: (await atLire('annulations_seances', jeton, 'id')).length,
      fermetures: (await atLire('fermetures', jeton, 'id')).length,
      absences_personnel: (await atLire('absences_personnel', jeton, 'id')).length
    };
    const attendu = {
      classes: fait.classes,
      eleves: fait.eleves,
      seances: fait.seances, signalements: fait.signalements,
      annulations: fait.annulations, fermetures: fait.fermetures, absences_personnel: fait.absences_personnel
    };
    const tousNoms = { classes: 'classes', eleves: 'eleves', seances: 'seances (emplois du temps)',
                   signalements: 'absences / retards', annulations: 'annulations de seance',
                   fermetures: 'fermetures', absences_personnel: 'absences du personnel' };
    const noms = estDirecteur ? tousNoms : { signalements: tousNoms.signalements };
    let rapport = 'DONNEES ENVOYEES AU SERVEUR\n\n';
    let tout = true;
    Object.keys(noms).forEach(function (k) {
      const ok = sur[k] >= attendu[k];
      if (!ok) tout = false;
      const deja = attendu[k] === 0 && sur[k] > 0;
      rapport += (ok ? 'OK  ' : 'ATTENTION ') + noms[k] + ' : ' +
                 (deja ? 'deja sur le serveur (' + sur[k] + ')' : 'telephone ' + attendu[k] + ' / serveur ' + sur[k]) + '\n';
    });
    const rienAEnvoyer = Object.keys(attendu).every(function (k) { return !attendu[k]; });
    if (rienAEnvoyer) {
      rapport = 'RIEN A ENVOYER\n\nCe telephone ne porte aucune donnee de travail pour cette ecole.\n' +
                'Si vos listes sont sur ce telephone, c\'est qu\'elles appartiennent a une autre ecole :\n' +
                'ouvrez le compte de cette ecole pour les envoyer (chaque ecole ne voit que ses listes).';
      tout = false;
    }
    if (nonEnvoyes.length) {
      rapport += '\nNON ENVOYE (' + nonEnvoyes.length + ') :\n- ' + nonEnvoyes.slice(0, 8).join('\n- ');
      if (nonEnvoyes.length > 8) rapport += '\n- ... et ' + (nonEnvoyes.length - 8) + ' autre(s)';
    }
    rapport += '\n' + (tout && !nonEnvoyes.length ? 'TOUT EST SUR LE SERVEUR.' : 'Envoi termine avec des lignes a revoir (voir ci-dessus).');
    if (typeof window !== 'undefined') window.atDonneesPretes = true;        // la base a recu les donnees
    if (typeof atSynchroNoterTout === 'function') atSynchroNoterTout();      // rien a renvoyer : tout est parti
    if (typeof chargerDonneesDuServeur === 'function' && !rienAEnvoyer) { try { await chargerDonneesDuServeur(true); } catch (e) {} }
    afficherToast(rienAEnvoyer ? 'Rien a envoyer pour cette ecole'
                  : (tout ? 'Donnees envoyees et verifiees' : 'Envoi partiel : voir le detail'),
                  rienAEnvoyer ? 'warning' : (tout ? 'success' : 'warning'));
    window.alert(rapport);
    return { sur: sur, attendu: attendu, nonEnvoyes: nonEnvoyes };
  } catch (e) {
    sauverIdsEcole(ids);
    afficherToast('Envoi interrompu : ' + (e && e.message ? e.message : e), 'error');
    return null;
  }
}

// ============================================================
// ECRIRE TOUT DE SUITE DANS LA BASE
// Annuler une seance ou enregistrer une absence du personnel ne doit PAS attendre le
// prochain « Envoyer mes donnees » : la ligne part immediatement (et disparait aussi de
// la base si on la retire). Sur un telephone non relie, rien ne part : tout reste local.
// ============================================================
async function atPretPourEcriture() {
  if (typeof estModeEcole !== 'function' || !estModeEcole()) return null;
  const moi = await atQuiSuisJe();
  if (!moi || !moi.fiche) return null;
  return { moi: moi, jeton: await atJeton() };
}

async function atClasseIdParNom(nom, jeton) {
  const ids = idsEcole();
  ids.classes = ids.classes || {};
  if (!ids.classes[String(nom)]) {
    (await atLire('classes', jeton, 'id,nom')).forEach(function (c) { ids.classes[String(c.nom)] = c.id; });
    sauverIdsEcole(ids);
  }
  return ids.classes[String(nom)] || null;
}

async function atProfilIdDe(code) {
  const f = String(code || '').toLowerCase().trim();
  if (!f) return null;
  const fiches = await atFichesPersonnel();
  const cle = function (v) { return String(v || '').toLowerCase().trim(); };
  const trouve = fiches.find(function (x) {
    return cle(x.code) === f || cle(x.email) === f || cle(String(x.email || '').split('@')[0]) === f;
  });
  return trouve ? trouve.id : null;
}

async function atSupprimer(table, id, jeton) {
  if (!id) return;
  const rep = await fetch(AT_BASE + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'DELETE', headers: atEntetes(jeton, true)
  });
  return atReponse(rep);
}

// ---- une seance annulee ----
async function atEnvoyerAnnulationSeance(sn) {
  const pret = await atPretPourEcriture();
  if (!pret || !sn) return null;
  try {
    const cid = await atClasseIdParNom(sn.classe, pret.jeton);
    if (!cid) return null;                       // classe inconnue de la base : reste sur le telephone
    const ids = idsEcole();
    const cle = sn.dateISO + '|' + sn.classe + '|' + sn.debut;
    await envoyerLigne(ids, 'annulations_seances', cle, {
      etablissement_id: pret.moi.fiche.etablissement_id, date_seance: sn.dateISO, classe_id: cid,
      debut: sn.debut, fin: sn.fin || sn.debut, motif: sn.motif || '', cree_par: pret.moi.fiche.id
    }, pret.jeton);
    sauverIdsEcole(ids);
    return ids.annulations_seances[cle];
  } catch (e) {
    afficherToast('Annulation gardee sur le telephone (base injoignable)', 'warning');
    return null;
  }
}
async function atRetirerAnnulationSeance(sn) {
  const pret = await atPretPourEcriture();
  if (!pret || !sn) return;
  const ids = idsEcole();
  const cle = sn.dateISO + '|' + sn.classe + '|' + sn.debut;
  const id = (ids.annulations_seances || {})[cle];
  try { await atSupprimer('annulations_seances', id, pret.jeton); delete ids.annulations_seances[cle]; sauverIdsEcole(ids); } catch (e) {}
}

// ---- une absence du personnel (enseignant ou surveillant) ----
async function atEnvoyerAbsencePersonnel(i) {
  const pret = await atPretPourEcriture();
  if (!pret || !i) return null;
  try {
    const pid = await atProfilIdDe(i.profCode);
    if (!pid) return null;                       // personne inconnue de la base : reste sur le telephone
    const ids = idsEcole();
    const cle = i.profCode + '|' + i.debut + '|' + (i.fin || i.debut);
    await envoyerLigne(ids, 'absences_personnel', cle, {
      etablissement_id: pret.moi.fiche.etablissement_id, prof_id: pid,
      role_absent: (roleAbsence(i) === 'enseignant' ? 'enseignant' : 'surveillant'),
      debut: i.debut, fin: i.fin || i.debut, portee: i.portee || 'journee',
      motif: i.motif || '', cree_par: pret.moi.fiche.id
    }, pret.jeton);
    sauverIdsEcole(ids);
    return ids.absences_personnel[cle];
  } catch (e) {
    afficherToast('Absence gardee sur le telephone (base injoignable)', 'warning');
    return null;
  }
}
async function atRetirerAbsencePersonnel(i) {
  const pret = await atPretPourEcriture();
  if (!pret || !i) return;
  const ids = idsEcole();
  const cle = i.profCode + '|' + i.debut + '|' + (i.fin || i.debut);
  const id = (ids.absences_personnel || {})[cle];
  try { await atSupprimer('absences_personnel', id, pret.jeton); delete ids.absences_personnel[cle]; sauverIdsEcole(ids); } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.envoyerMesDonnees = envoyerMesDonnees;
  window.idsEcole = idsEcole;
}
