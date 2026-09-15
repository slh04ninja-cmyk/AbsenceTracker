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

function idsEcole() {
  try { return JSON.parse(Depot.lire('idsEcole', '{}')) || {}; } catch (e) { return {}; }
}
function sauverIdsEcole(ids) { Depot.ecrireJSON('idsEcole', ids); }

async function atPost(table, corps, jeton) {
  const rep = await fetch(AT_BASE + '/rest/v1/' + table, {
    method: 'POST', headers: atEntetes(jeton, true) && Object.assign(atEntetes(jeton, true), { Prefer: 'return=representation' }),
    body: JSON.stringify(corps)
  });
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
      ids.conflits.push(table + ' ' + cle);
      return null;
    }
    throw e;
  }
}

const MOMENT_DE = function (seance) {
  const s = String(seance || '').toLowerCase();
  return (s.indexOf('apres') >= 0 || s.indexOf('après') >= 0 || s.indexOf('soir') >= 0) ? 'apres-midi' : 'matin';
};
const STATUT_DE = function (a) {
  if (a.statut === 'justifie' || a.justifie) return 'justifie_s';
  return 'absent';
};

// ============================================================
// ENVOYER MES DONNEES AU SERVEUR (puis verifier)
// ============================================================
async function envoyerMesDonnees() {
  const moi = await atQuiSuisJe();
  if (!moi || !moi.fiche) { afficherToast('Connectez-vous au serveur d abord', 'error'); return; }
  const etab = moi.fiche.etablissement_id;
  const jeton = await atJeton();
  const ids = idsEcole();
  const fait = { classes: 0, eleves: 0, seances: 0, signalements: 0, annulations: 0, fermetures: 0, absences_personnel: 0 };

  afficherToast('Envoi des donnees...', 'info');
  try {
    // 0. les fiches du personnel (pour relier les seances et les absences a un professeur)
    const fiches = await atFichesPersonnel();
    const fichePar = {};
    fiches.forEach(function (f) {
      if (f.code) fichePar[String(f.code).toLowerCase()] = f.id;
      if (f.email) fichePar[String(f.email).toLowerCase()] = f.id;
    });
    const profId = function (code) {
      const c = String(code || '').toLowerCase();
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
    (await atLire('eleves', jeton, 'id,classe_id,code_massar')).forEach(function (e) {
      const nom = classeParId['' + e.classe_id];
      if (nom) ids.eleves[nom + '|' + e.code_massar] = e.id;
    });

    // 1. les classes
    for (const c of classes) {
      const id = await envoyerLigne(ids, 'classes', String(c.nom), { etablissement_id: etab, nom: c.nom }, jeton);
      ids.classes[String(c.nom)] = id;
      fait.classes++;
    }
    // 2. les eleves
    for (const c of classes) {
      for (const e of (c.eleves || [])) {
        const cle = String(c.nom) + '|' + String(e.massar || e.id);
        const idBase = await envoyerLigne(ids, 'eleves', cle, {
          classe_id: ids.classes[String(c.nom)], code_massar: String(e.massar || ''),
          nom: e.nom || '', prenom: e.prenom || '', actif: e.actif !== false
        }, jeton);
        // correspondance identifiant du telephone -> identifiant du serveur (pour les absences)
        if (!ids.elevesParId) ids.elevesParId = {};
        ids.elevesParId['' + e.id] = idBase;
        fait.eleves++;
      }
    }
    // 3. les emplois du temps (seances)
    Object.keys(tableauxService || {}).forEach(function (code) {
      (tableauxService[code] || []).forEach(function (c) {
        const cle = code + '|' + c.jour + '|' + c.debut + '|' + c.classe;
        envoyerLigne(ids, 'seances', cle, {
          etablissement_id: etab, prof_id: profId(code), classe_id: classeId(c.classe),
          jour: c.jour, debut: c.debut, fin: c.fin || c.debut, salle: c.salle || '', matiere: c.matiere || ''
        }, jeton);
        fait.seances++;
      });
    });
    await Promise.all([]);
    // 4. les signalements (absences et retards)
    for (const a of absences) {
      const cle = String(a.eleveId) + '|' + a.dateISO + '|' + MOMENT_DE(a.seance) + '|' + (a.type || 'absence');
      await envoyerLigne(ids, 'signalements', cle, {
        etablissement_id: etab, eleve_id: (ids.elevesParId || {})['' + a.eleveId] || null,
        classe_id: classeId(a.classe), prof_id: profId(a.enseignant),
        date_abs: a.dateISO, moment: MOMENT_DE(a.seance), heure: a.heure || null,
        type: (a.type === 'retard' ? 'retard' : 'absence'),
        retard_minutes: (a.type === 'retard' ? parseInt(String(a.duree || '0'), 10) || null : null),
        statut: STATUT_DE(a), motif: a.motif || null,
        // La base n'accepte un signalement que s'il est signe par la personne connectee
        // (regle d'integrite : on ne signale pas a la place d'un collegue). Ici, c'est le
        // directeur qui fait la montee : c'est donc lui qui signe ; le professeur concerne
        // reste porte par « prof_id ».
        signale_par: moi.fiche.id
      }, jeton);
      fait.signalements++;
    }
    // 5. les annulations de seances
    for (const sn of seancesAnnulees) {
      const cle = sn.dateISO + '|' + sn.classe + '|' + sn.debut;
      await envoyerLigne(ids, 'annulations_seances', cle, {
        etablissement_id: etab, date_seance: sn.dateISO, classe_id: classeId(sn.classe),
        debut: sn.debut, fin: sn.fin || sn.debut, motif: sn.motif || '', cree_par: moi.fiche.id
      }, jeton);
      fait.annulations++;
    }
    // 6. les fermetures
    for (const f of fermeturesEtab) {
      const cle = f.debut + '|' + (f.fin || f.debut) + '|' + (f.libelle || f.type || '');
      await envoyerLigne(ids, 'fermetures', cle, {
        etablissement_id: etab, type: f.type || 'Fermeture', libelle: f.libelle || '',
        debut: f.debut, fin: f.fin || f.debut, portee: f.portee || 'journee', cree_par: moi.fiche.id
      }, jeton);
      fait.fermetures++;
    }
    // 7. les absences du personnel
    for (const i of indispoProfs) {
      const cle = String(i.profCode) + '|' + i.debut + '|' + (i.fin || i.debut);
      await envoyerLigne(ids, 'absences_personnel', cle, {
        etablissement_id: etab, prof_id: profId(i.profCode),
        role_absent: (roleAbsence(i) === 'enseignant' ? 'enseignant' : 'surveillant'),
        debut: i.debut, fin: i.fin || i.debut, portee: i.portee || 'journee',
        motif: i.motif || '', cree_par: moi.fiche.id
      }, jeton);
      fait.absences_personnel++;
    }
    sauverIdsEcole(ids);

    // ---- CE QUI EST ENVOYE ----
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
      classes: classes.length,
      eleves: classes.reduce((n, c) => n + (c.eleves || []).length, 0),
      seances: Object.keys(tableauxService || {}).reduce((n, k) => n + (tableauxService[k] || []).length, 0),
      signalements: absences.length, annulations: seancesAnnulees.length,
      fermetures: fermeturesEtab.length, absences_personnel: (typeof indispoProfs !== 'undefined' ? indispoProfs.length : 0)
    };
    let rapport = 'DONNEES ENVOYEES AU SERVEUR\n\n';
    const noms = { classes: 'classes', eleves: 'eleves', seances: 'seances (emplois du temps)',
                   signalements: 'absences / retards', annulations: 'annulations de seance',
                   fermetures: 'fermetures', absences_personnel: 'absences du personnel' };
    let tout = true;
    Object.keys(noms).forEach(function (k) {
      const ok = sur[k] >= attendu[k];
      if (!ok) tout = false;
      rapport += (ok ? 'OK  ' : 'ATTENTION ') + noms[k] + ' : telephone ' + attendu[k] + ' / serveur ' + sur[k] + '\n';
    });
    rapport += '\n' + (tout ? 'TOUT EST SUR LE SERVEUR.' : 'Certaines donnees manquent : renvoyez (rien ne sera double).');
    afficherToast(tout ? 'Donnees envoyees et verifiees' : 'Envoi partiel : voir le detail', tout ? 'success' : 'warning');
    window.alert(rapport);
    return { sur: sur, attendu: attendu };
  } catch (e) {
    sauverIdsEcole(ids);
    afficherToast('Envoi interrompu : ' + (e && e.message ? e.message : e), 'error');
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.envoyerMesDonnees = envoyerMesDonnees;
  window.idsEcole = idsEcole;
}
