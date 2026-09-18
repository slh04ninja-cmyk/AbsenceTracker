// fichier: app/js/04-gestion.js
// ========== NOMS DES PROFESSEURS (corrigeables par le directeur) ==========
function chargerNomsProfs() {
  try {
    const brut = Depot.lire('nomsProfs', null);
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
let nomsProfs = chargerNomsProfs();
function sauvegarderNomsProfs() { Depot.ecrireJSON('nomsProfs', nomsProfs); }
function appliquerNomsProfs() {
  comptes.forEach(c => {
    const cle = c.code || c.email;
    if (cle && nomsProfs[cle]) c.nom = nomsProfs[cle];
  });
}
// Mots de passe modifies ou generes : persistes par email (avant, le changement etait perdu au rechargement)
function chargerMotsDePasse() {
  try {
    const brut = Depot.lire('motsDePasse', null);
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
let motsDePasse = chargerMotsDePasse();
function sauvegarderMotsDePasse() { Depot.ecrireJSON('motsDePasse', motsDePasse); }
function appliquerMotsDePasse() {
  comptes.forEach(c => { if (motsDePasse[c.email]) c.password = motsDePasse[c.email]; });
}
// Mot de passe aleatoire valide (lettres + chiffres, sans caracteres speciaux)
function genererMotDePasse(longueur) {
  const n = longueur || 8;
  const lettres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const chiffres = '23456789';
  const tous = lettres + chiffres;
  const tirer = t => t[Math.floor(Math.random() * t.length)];
  let mdp = tirer(lettres) + tirer(chiffres);
  while (mdp.length < n) mdp += tirer(tous);
  return mdp.split('').sort(() => Math.random() - 0.5).join('');
}
function genererMotDePasseProf() {
  const champ = document.getElementById('renommer-mdp');
  if (!champ) return;
  champ.value = genererMotDePasse(8);
  const suc = document.getElementById('renommer-success');
  if (suc) suc.classList.add('hidden');
}

// ========== FERMETURES DE L'ETABLISSEMENT & INDISPONIBILITES DES PROFS ==========
function chargerListe(cle) {
  try {
    const brut = Depot.lire(cle, null);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) { return []; }
}
// Fermeture : { id, dateISO, libelle, type, debut, fin, portee, par, le, profCode }
let fermeturesEtab = chargerListe('fermeturesEtab');
let indispoProfs = chargerListe('indispoProfs');
function sauvegarderFermetures() { Depot.ecrireJSON('fermeturesEtab', fermeturesEtab); }
function sauvegarderIndispo() {
  Depot.ecrireJSON('indispoProfs', indispoProfs);
  // AJOUT / MODIFICATION / SUPPRESSION d'une absence de personnel : les seances deduites
  // sont (re)calculees et la base est alignee (creation, mise a jour, retrait).
  if (typeof alignerAnnulationsDeduites === 'function') alignerAnnulationsDeduites().catch(function () {});
}
function bornesAnneeScolaire() {
  const s1 = anneeScolaire.semestres[0] || {};
  const s2 = anneeScolaire.semestres[1] || {};
  return { debut: s1.debut || '2000-01-01', fin: s2.fin || '2100-12-31' };
}
// Bornes de l'annee scolaire sur tous les champs de date concernes
function bornerDatesAnnee() {
  const b = bornesAnneeScolaire();
  ['annul-date', 'indispo-debut', 'indispo-fin', 'abs-surv-debut', 'abs-surv-fin', 'ferm-debut', 'ferm-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.min = b.debut;
    el.max = b.fin;
  });
}
// Portee : 'journee' (defaut) | 'matin' | 'apres-midi'
function porteeCorrespond(portee, heure) {
  if (!portee || portee === 'journee') return true;
  const matin = hhmmEnMinutes(heure) < 12 * 60;
  return portee === 'matin' ? matin : !matin;
}
function libellePortee(portee) {
  return portee === 'matin' ? 'matin' : (portee === 'apres-midi' ? 'après-midi' : 'toute la journée');
}
function dansPeriode(entree, dateISO) {
  if (!entree || !entree.debut || !dateISO) return false;
  return dateISO >= entree.debut && dateISO <= (entree.fin || entree.debut);
}
function nomProfCode(code) {
  // Une cle vide ne doit PAS etre comparee : `x.code === undefined` etait vrai pour le
  // premier compte sans code (Surveillant 1) et fabriquait « Absence de Surveillant 1 ».
  if (code === undefined || code === null || String(code).trim() === '') return '';
  const c = comptes.find(x => x.code === code);
  return c ? c.nom : (code || '');
}
// Creneau reel d'une classe qui couvre une heure donnee
function creneauDeHeure(classe, jour, heure) {
  const m = hhmmEnMinutes(heure);
  return creneauxClasseJour(classe, jour).find(c => m >= hhmmEnMinutes(c.debut) && m < hhmmEnMinutes(c.fin)) || null;
}

// ========== ANNULATION DE SEANCE (directeur + surveillant) ==========
function chargerSeancesAnnulees() {
  try {
    const brut = Depot.lire('seancesAnnulees', null);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) { return []; }
}
let seancesAnnulees = chargerSeancesAnnulees();
function sauvegarderSeancesAnnulees() { Depot.ecrireJSON('seancesAnnulees', seancesAnnulees); }
function estRoleVieScolaire() {
  return !!utilisateurConnecte && (utilisateurConnecte.role === 'directeur' || utilisateurConnecte.role === 'surveillant');
}
function nomApprobateur() {
  if (!utilisateurConnecte) return '';
  return utilisateurConnecte.role === 'directeur' ? 'Directeur' : (utilisateurConnecte.nom || 'Surveillant');
}
// Pourquoi une seance n'a pas lieu : annulation explicite, fermeture de l'etablissement
// ou indisponibilite de l'enseignant. Renvoie null si la seance a bien lieu.
function raisonAnnulation(dateISO, classe, heure) {
  if (!dateISO || !classe || !heure) return null;
  const m = hhmmEnMinutes(heure);
  // 1. seance annulee explicitement (directeur / surveillant)
  const sna = seancesAnnulees.find(s => s.dateISO === dateISO && s.classe === classe &&
    m >= hhmmEnMinutes(s.debut) && m < hhmmEnMinutes(s.fin || s.debut));
  if (sna) return { source: 'seance', motif: sna.motif || 'Séance annulée', par: sna.par || '', debut: sna.debut, fin: sna.fin };
  // 2. fermeture de l'etablissement (vacances, examens, fetes, reunion...)
  const ferm = fermeturesEtab.find(f => dansPeriode(f, dateISO) && porteeCorrespond(f.portee, heure));
  if (ferm) return { source: 'fermeture', motif: ferm.libelle || ferm.type || 'Établissement fermé', par: ferm.par || '', type: ferm.type || '' };
  // 3. indisponibilite de l'enseignant qui assure la seance
  const jour = new Date(dateISO + 'T12:00:00').getDay();
  const cr = creneauDeHeure(classe, jour, heure);
  if (cr && cr.prof) {
    const ind = indispoProfs.find(i => i.profCode === cr.prof && dansPeriode(i, dateISO) && porteeCorrespond(i.portee, heure));
    if (ind) return { source: 'indispo', motif: ind.motif || 'Absence du professeur', par: ind.par || '', profCode: cr.prof, debut: cr.debut, fin: cr.fin };
  }
  return null;
}
function seanceAnnulee(dateISO, classe, heure) { return raisonAnnulation(dateISO, classe, heure); }
// Une absence prise pendant une seance annulee ne compte pas
function absenceEnSeanceAnnulee(a) {
  return !!a && !!seanceAnnulee(a.dateISO, a.classe, a.heure);
}
// Creneaux reels d'une classe pour un jour (deduits des tableaux de service)
function creneauxClasseJour(classe, jour, avecDefaut) {
  const par = {};
  Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
    if (c.classe !== classe || c.jour !== jour) return;
    if (!par[c.debut]) par[c.debut] = { debut: c.debut, fin: c.fin, matiere: c.matiere, prof: c.prof };
  }));
  const liste = Object.keys(par).map(k => par[k]).sort((a, b) => hhmmEnMinutes(a.debut) - hhmmEnMinutes(b.debut));
  if (liste.length) return liste;
  if (avecDefaut === false) return [];      // pour compter les seances DUES : pas de repli
  const std = [];
  for (let h = 8; h < 12; h++) std.push({ debut: String(h).padStart(2, '0') + ':00', fin: String(h + 1).padStart(2, '0') + ':00', matiere: '', prof: '' });
  for (let h = 14; h < 18; h++) std.push({ debut: String(h).padStart(2, '0') + ':00', fin: String(h + 1).padStart(2, '0') + ':00', matiere: '', prof: '' });
  return std;
}
function heureMaintenant() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// Date affichee dans la liste des annulations (carte Fermeture de l'etablissement)
function rafraichirListeAnnulations() {
  const el = document.getElementById('annul-date-card');
  if (el && !el.value) el.value = fmtDateISO(new Date());
  afficherSeancesAnnulees();
}

// Formulaire "Annuler une séance" (carte Fermeture de l'etablissement, page Gestion)
function preparerFormulaireAnnulation() {
  bornerDatesAnnee();
  const dateEl = document.getElementById('annul-date');
  if (dateEl && !dateEl.value) dateEl.value = fmtDateISO(new Date());
  const selClasse = document.getElementById('annul-classe');
  if (selClasse) {
    const courant = selClasse.value;
    selClasse.innerHTML = '';
    classes.forEach(cl => {
      const o = document.createElement('option');
      o.value = cl.nom;
      o.textContent = cl.nom;
      selClasse.appendChild(o);
    });
    if (courant && classes.some(c => c.nom === courant)) selClasse.value = courant;
  }
  majCreneauxAnnulation();
}
function majCreneauxAnnulation() {
  const dateEl = document.getElementById('annul-date');
  const selClasse = document.getElementById('annul-classe');
  const selCr = document.getElementById('annul-creneau');
  const dateISO = (dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date());
  if (selCr && selClasse) {
    const jour = new Date(dateISO + 'T12:00:00').getDay();
    selCr.innerHTML = '';
    creneauxClasseJour(selClasse.value, jour).forEach(c => {
      const o = document.createElement('option');
      o.value = c.debut + '|' + c.fin;
      o.textContent = c.debut + '–' + c.fin + (c.matiere ? ' · ' + c.matiere : '');
      selCr.appendChild(o);
    });
  }
}
// Teinte d'un bouton d'action de carte : une CLASSE, jamais une couleur en dur dans le JS.
// Les regles existent en clair (00-base.css) et en sombre (02-theme-sombre.css).
function classeTeinteCarte(couleur) {
  if (couleur === '#dc2626') return 'carte-action-danger';
  if (couleur === 'var(--primary)') return 'carte-action-principale';
  return 'carte-action-lien';
}
// Carte de liste commune (meme rendu pour les seances annulees et les absences du personnel)
function carteLigne(titre, sousTitre, action) {
  const item = document.createElement('div');
  item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
  const bloc = document.createElement('div');
  bloc.style = 'min-width: 0; flex: 1;';
  const p1 = document.createElement('p');
  p1.className = 'carte-ligne-titre';
  p1.innerHTML = titre;
  const p2 = document.createElement('p');
  p2.className = 'carte-ligne-sous';
  p2.innerHTML = sousTitre;
  bloc.appendChild(p1);
  bloc.appendChild(p2);
  item.appendChild(bloc);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    // La teinte vient d'une CLASSE (feuille claire ET feuille sombre) : un bleu fonce ecrit
    // en dur devenait illisible sur la carte en mode sombre (defaut signale : « Modifier »,
    // « Rétablir »).
    b.className = 'btn-inline flex-shrink-0 ' + classeTeinteCarte(action.couleur);
    b.innerHTML = action.icone || false;
    if (action.texte) b.textContent = action.texte;
    b.onclick = action.onclick;
    item.appendChild(b);
  }
  return item;
}

// Seances annulees PARCE QU'UN ENSEIGNANT EST ABSENT : calculees depuis son tableau de service.
// (limite de securite : 60 jours par absence et 600 seances au total)
function seancesAnnuleesParAbsence() {
  const resultat = [];
  const MAX_JOURS = 60;
  const MAX_SEANCES = 600;
  indispoProfs.filter(i => roleAbsence(i) === 'enseignant').forEach(ind => {
    const code = ind.profCode;
    const debut = ind.debut;
    const fin = ind.fin || ind.debut;
    if (!code || !debut) return;
    // creneaux hebdomadaires du prof (jour de la semaine -> creneaux)
    // ATTENTION : dans les tableaux de service, « prof » porte tantot le CODE
    // (math-prof1), tantot le NOM AFFICHE (أيوب الكمرة). Comparer au seul code
    // faisait que les seances annulees par une absence n'apparaissaient JAMAIS
    // chez le directeur ni chez le surveillant (defaut reellement signale).
    const nomDuProf = (function () {
      try { return nomProfCode(code); } catch (e) { return ''; }
    })();
    const nomsPossibles = [code, nomDuProf];
    if (nomsProfs && nomsProfs[code]) nomsPossibles.push(nomsProfs[code]);
    const estCeProf = c => nomsPossibles.some(n => n && String(c.prof || '') === String(n));
    const parJour = {};
    // l'absence peut nommer le prof par son code, son adresse ou son nom : on accepte les trois
    const codeSansArobase = String(code || '').split('@')[0].toLowerCase();
    Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
      const cleCorrespond = String(mail || '').toLowerCase() === String(code || '').toLowerCase() ||
                            String(mail || '').split('@')[0].toLowerCase() === codeSansArobase;
      if (!estCeProf(c) && !cleCorrespond) return;
      parJour[c.jour] = parJour[c.jour] || [];
      if (!parJour[c.jour].some(x => x.classe === c.classe && x.debut === c.debut)) parJour[c.jour].push(c);
    }));
    const depart = new Date(debut + 'T12:00:00');
    let compte = 0;
    for (let d = new Date(depart); fmtDateISO(d) <= fin && compte < MAX_JOURS; d.setDate(d.getDate() + 1)) {
      compte++;
      const dateISO = fmtDateISO(d);
      const jour = d.getDay();
      if (jour === 0 || jour === 6) continue;                       // pas de cours le week-end
      (parJour[jour] || []).forEach(c => {
        if (resultat.length >= MAX_SEANCES) return;
        if (!porteeCorrespond(ind.portee, c.debut)) return;
        resultat.push({
          genere: true, origine: 'absence', idAbsence: ind.id, profCode: code,
          dateISO: dateISO, classe: c.classe, debut: c.debut, fin: c.fin,
          // le motif nomme LA PERSONNE absente (avant, la fiche du prof portait le motif
          // de saisie, ce qui affichait « Surveillant 1 absent » pour un enseignant).
          motif: ind.motif || 'Absence',
          par: ind.par || ''
        });
      });
    }
  });
  return resultat;
}

// MATERIALISER : les seances annulees parce qu'un enseignant est absent ne doivent plus
// rester un simple calcul d'ecran. On les ECRIT comme de vraies lignes d'annulation :
// elles partent alors dans la base (synchro), elles y restent, et tous les comptes les
// voient sans avoir a recalculer quoi que ce soit.
//   - appelee quand on enregistre une absence de personnel ;
//   - appelee apres une lecture de la base (un telephone neuf les pose une fois).
// PURGE : les seances deduites d'une absence ont ete enregistrees par erreur dans la
// liste des saisies directes par des versions precedentes (motifs « Absence de ... » ou
// « Absence du professeur », parfois avec un nom fabrique). On les retire : elles n'ont
// pas a etre stockees — elles se recalculent a l'affichage, et la synchronisation les
// aligne sur la base (y compris leur suppression).
function purgerAnnulationsDeduitesEnregistrees() {
  const estDeduite = function (sn) {
    if (!sn) return false;
    if (sn.origine === 'absence' || sn.genere === true) return true;
    return /^\s*absence\s+d/i.test(String(sn.motif || ''));
  };
  const avant = seancesAnnulees.length;
  seancesAnnulees = seancesAnnulees.filter(sn => !estDeduite(sn));
  const retirees = avant - seancesAnnulees.length;
  if (retirees) Depot.ecrireJSON('seancesAnnulees', seancesAnnulees);   // -> la base se met a jour
  return retirees;
}

function materialiserAnnulationsParAbsence() {
  if (typeof purgerAnnulationsDeduitesEnregistrees === 'function') purgerAnnulationsDeduitesEnregistrees();
  // MODELE DE LA v4.04 CONSERVE : les seances deduites d'une absence restent CALCULEES
  // (elles s'affichent dans le Dashboard) et ne sont PAS rangees dans la liste des
  // saisies directes — sinon les deux listes se melangeaient et les comptes devenaient
  // faux. C'est la SYNCHRONISATION (22-sync.js) qui les envoie dans la base.
  if (true) return 0;
  const calculees = seancesAnnuleesParAbsence();
  const cle = sn => String(sn.dateISO) + '|' + String(sn.classe) + '|' + String(sn.debut);
  const connues = {};
  seancesAnnulees.forEach(sn => { connues[cle(sn)] = true; });
  const absencesEncore = {};
  indispoProfs.forEach(i => { absencesEncore['' + i.id] = true; });
  let ajoutees = 0, retirees = 0;
  calculees.forEach(sn => {
    if (connues[cle(sn)]) return;                       // deja la (saisie directe ou deja materialisee)
    seancesAnnulees.push({
      id: Date.now() + Math.random(), genere: true, origine: 'absence', idAbsence: sn.idAbsence,
      dateISO: sn.dateISO, classe: sn.classe, debut: sn.debut, fin: sn.fin || '', motif: sn.motif,
      par: sn.par || '', le: sn.dateISO + ' ' + String(sn.debut || '').slice(0, 5)
    });
    connues[cle(sn)] = true; ajoutees++;
  });
  // PRUDENCE (defaut corrige) : on ne retire une seance « deduite d'une absence » QUE si
  // l'absence qui l'avait produite n'existe PLUS (lien garde dans « idAbsence »).
  // Ne JAMAIS retirer en comparant au calcul du moment : quand le calcul ne retrouve pas
  // les seances (emploi du temps pas encore charge), les bonnes lignes disparaissaient
  // du Dashboard — c'etait pire que le defaut d'origine.
  const avant = seancesAnnulees.length;
  seancesAnnulees = seancesAnnulees.filter(sn => {
    if (sn.origine !== 'absence') return true;                 // saisie directe : intouchable
    if (!sn.idAbsence) return true;                            // ligne ancienne sans lien : on garde
    return !!absencesEncore['' + sn.idAbsence];                // l'absence existe encore ?
  });
  retirees = avant - seancesAnnulees.length;
  if (ajoutees || retirees) Depot.ecrireJSON('seancesAnnulees', seancesAnnulees);   // -> part dans la base
  return ajoutees;
}

// Les 2 sources fusionnees, sans doublon (une saisie directe prime sur l'absence du prof)
function listeSeancesAnnulees() {
  const vues = {};
  const fusion = [];
  seancesAnnulees.forEach(sn => {
    const cle = sn.dateISO + '|' + sn.classe + '|' + sn.debut;
    if (vues[cle]) return;
    vues[cle] = true;
    fusion.push(Object.assign({ origine: 'saisie' }, sn));
  });
  seancesAnnuleesParAbsence().forEach(c => {
    const cle = c.dateISO + '|' + c.classe + '|' + c.debut;
    if (vues[cle]) return;
    vues[cle] = true;
    fusion.push(c);
  });
  return fusion;
}

// L'etablissement est-il ferme a cette date ? (et sur ce demi-jour, si la fermeture
// ne couvre qu'une demi-journee)
function fermetureCouvre(dateISO, estMatin) {
  return fermeturesEtab.some(f => {
    const d = String(dateISO || '');
    if (d < f.debut || d > f.fin) return false;
    if (!f.portee || f.portee === 'journee') return true;
    return (f.portee === 'matin') === !!estMatin;
  });
}

// Les SEANCES DUES d'une classe sur une periode : les creneaux du tableau de service,
// MOINS les fermetures de l'etablissement, les annulations et les absences de professeurs
// (ces deux dernieres sont deja fusionnees par listeSeancesAnnulees).
// C'est le denominateur juste du taux de presence : avant, l'application le deduisait des
// signalements eux-memes, donc plus il y avait d'absences... plus le taux montait.
function seancesDuesClasse(classe, debut, fin) {
  const annulees = {};
  listeSeancesAnnulees().forEach(sn => { annulees[sn.dateISO + '|' + sn.classe + '|' + sn.debut] = true; });
  let n = 0;
  const d = new Date(debut + 'T12:00:00');
  const dernier = new Date(fin + 'T12:00:00');
  while (d <= dernier) {
    const jour = d.getDay();                       // 0 = dimanche : aucune seance
    if (jour >= 1 && jour <= 6) {
      const dateISO = fmtDateISO(d);
      creneauxClasseJour(classe, jour, false).forEach(c => {
        if (fermetureCouvre(dateISO, hhmmEnMinutes(c.debut) < 12 * 60)) return;
        if (annulees[dateISO + '|' + classe + '|' + c.debut]) return;
        n++;
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// Les absences qui comptent vraiment sur une periode : les signalements dont le type
// EFFECTIF est « absence » (un retard de plus de 30 min en est une), hors fermeture de
// l'etablissement. `classe` est facultatif (sinon : tout l'etablissement).
function absencesCompteesPeriode(debut, fin, classe) {
  return absences.filter(a => {
    const d = String(a.dateISO || '');
    if (d < debut || d > fin) return false;
    if (classe && a.classe !== classe) return false;
    if (typeEffectif(a) === 'retard') return false;
    return !fermetureCouvre(d, (a.seance || 'matin') === 'matin');
  });
}

// Ordre : de la plus proche a la plus lointaine (les seances a venir d'abord, puis les passees recentes)
// Ordre d'affichage : la seance la PLUS PROCHE d'aujourd'hui vient en premier
// (hier ou demain d'abord, puis on s'eloigne). A egalite de distance, celle a venir
// passe avant celle passee. Remarque de l'utilisateur : « ordre decroissant de plus
// proche » — c'est-a-dire de la plus proche vers la plus lointaine.
function trierSeancesAnnulees(liste) {
  const auj = fmtDateISO(new Date());
  const distant = (d) => {
    const j = new Date(String(d || auj) + 'T12:00:00').getTime();
    const t = new Date(auj + 'T12:00:00').getTime();
    return Math.abs(j - t);
  };
  return (liste || seancesAnnulees).slice().sort((a, b) => {
    const da = String(a.dateISO || '');
    const db = String(b.dateISO || '');
    const ea = distant(da);
    const eb = distant(db);
    if (ea !== eb) return ea - eb;                 // la plus proche d'abord
    const fa = da > auj;
    const fb = db > auj;
    if (fa !== fb) return fa ? -1 : 1;             // meme distance : a venir d'abord
    if (da !== db) return fa ? da.localeCompare(db) : db.localeCompare(da);
    return String(a.debut || '').localeCompare(String(b.debut || ''));
  });
}
// Remplit TOUTES les cartes "Seances annulees" (Dashboard directeur + surveillant)
//
// AFFICHAGE SEULEMENT (demande de l'utilisateur, 18/09) : le Dashboard ne garde que les
// seances annulees d'AUJOURD'HUI — tant que leur heure n'est pas passee — et celles des
// jours a VENIR. Les jours passes disparaissent de l'ecran. RIEN n'est supprime : les
// lignes restent dans la base et dans listeSeancesAnnulees() (donc dans le taux de
// presence et les statistiques, qui doivent continuer de compter le passe).
function seanceAnnuleeEncoreALafficher(sn, auj, minutesMaintenant) {
  const jour = String(sn.dateISO || '');
  if (jour > auj) return true;                          // a venir
  if (jour < auj) return false;                         // jour passe
  return minutesMaintenant <= hhmmEnMinutes(sn.fin || sn.debut);   // aujourd'hui : en cours ou a venir
}
function afficherSeancesAnnulees() {
  const conteneurs = document.querySelectorAll('.js-seances-annulees');
  const auj = fmtDateISO(new Date());
  const minutesMaintenant = hhmmEnMinutes(heureMaintenant());
  const liste = trierSeancesAnnulees(listeSeancesAnnulees())
    .filter(function (sn) { return seanceAnnuleeEncoreALafficher(sn, auj, minutesMaintenant); });
  for (let i = 0; i < conteneurs.length; i++) {
    const cont = conteneurs[i];
    cont.innerHTML = '';
    if (liste.length === 0) {
      cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune séance annulée.</p>';
      continue;
    }
    liste.forEach(sn => {
      const jour = String(sn.dateISO || '');
      const parAbsence = sn.origine === 'absence';
      // Plus de pastille « Absence prof » (retiree le 15/09 : elle ne s'affichait pas en mode
      // clair). Une seance annulee par une absence reste reconnaissable a son sous-titre
      // « Absence de ... ».
      const titre = dateAffichage(jour) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
        (jour > auj ? ' <span class="tag-avenir">À venir</span>' : '');
      const sous = parAbsence
        ? 'Absence de ' + nomProfCode(sn.profCode) + (sn.motif ? ' · ' + sn.motif : '')
        : ((sn.motif || '') + (sn.par ? ' · par ' + sn.par : ''));
      // une seance annulee par une absence se retire depuis la rubrique RH, pas ici
      cont.appendChild(carteLigne(titre, sous, parAbsence ? null : { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
    });
  }
}
function rafraichirListeAnnulations() { afficherSeancesAnnulees(); }

// Annulations enregistrees (saisie directe) : liste de la carte "Annulation de seances" (Gestion)
function afficherAnnulationsEnregistrees() {
  const cont = document.getElementById('annulations-liste');
  if (!cont) return;
  cont.innerHTML = '';
  // Les seances annulees « deduites d'une absence de prof » ne figurent PAS ici : elles
  // appartiennent au Dashboard, ou elles suivent l'absence (elles disparaissent d'elles-memes
  // quand l'absence est supprimee). Les melanger ici faisait doublon (defaut signale).
  const liste = trierSeancesAnnulees(seancesAnnulees.filter(sn => sn.origine !== 'absence'));
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune annulation enregistrée.</p>';
    return;
  }
  const auj = fmtDateISO(new Date());
  liste.forEach(sn => {
    const titre = dateAffichage(sn.dateISO) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
      (String(sn.dateISO) > auj ? ' <span class="tag-avenir">À venir</span>' : '');
    cont.appendChild(carteLigne(titre, (sn.motif || '') + (sn.par ? ' · par ' + sn.par : ''),
      { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
  });
}

function confirmerAnnulationSeance() {
  if (!estRoleVieScolaire()) return;
  if (typeof verifierBlocageAbsence === 'function' && verifierBlocageAbsence()) {
    afficherToast('Vous etes declare(e) absent(e) aujourd hui : consultation seule.', 'error');
    return;
  }
  const dateEl = document.getElementById('annul-date');
  const classe = (document.getElementById('annul-classe') || {}).value || '';
  const parties = String((document.getElementById('annul-creneau') || {}).value || '').split('|');
  const motif = (document.getElementById('annul-motif') || {}).value || 'Séance non assurée';
  const dateISO = (dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date());
  if (!classe || !parties[0]) { afficherToast('Choisissez une classe et une séance', 'error'); return; }
  const jourSem = new Date(dateISO + 'T12:00:00').getDay();
  if (jourSem === 0 || jourSem === 6) { afficherToast('Pas de cours le week-end', 'error'); return; }
  const bornes = bornesAnneeScolaire();
  if (dateISO < bornes.debut || dateISO > bornes.fin) { afficherToast("Date en dehors de l'année scolaire", 'error'); return; }
  if (seancesAnnulees.some(sn => sn.dateISO === dateISO && sn.classe === classe && sn.debut === parties[0])) {
    afficherToast('Séance déjà annulée', 'error');
    return;
  }
  seancesAnnulees.push({
    id: Date.now() + Math.random(), dateISO: dateISO, classe: classe,
    debut: parties[0], fin: parties[1] || '', motif: motif, par: nomApprobateur(),
    le: dateISO + ' ' + heureMaintenant()
  });
  sauvegarderSeancesAnnulees();
  // la base est mise a jour tout de suite (si l'ecole est reliee)
  if (typeof atEnvoyerAnnulationSeance === 'function') atEnvoyerAnnulationSeance(seancesAnnulees[seancesAnnulees.length - 1]);
  afficherSeancesAnnulees();
  afficherAnnulationsEnregistrees();
  afficherToast('Séance annulée', 'modif');
  rafraichirApresAnnulation();
}
function retablirSeance(id) {
  const cible = seancesAnnulees.find(sn => String(sn.id) === String(id));
  if (!cible) return;
  confirmerSuppression('Rétablir la séance du ' + dateAffichage(cible.dateISO) + ' · ' + cible.classe + ' ' + cible.debut + ' ?',
    () => vraimentRetablirSeance(cible.id));
}
function vraimentRetablirSeance(id) {
  if (typeof verifierBlocageAbsence === 'function' && verifierBlocageAbsence()) {
    afficherToast('Vous etes declare(e) absent(e) aujourd hui : consultation seule.', 'error');
    return;
  }
  const retiree = seancesAnnulees.find(sn => sn.id === id);
  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);
  sauvegarderSeancesAnnulees();
  if (retiree && typeof atRetirerAnnulationSeance === 'function') atRetirerAnnulationSeance(retiree);
  rafraichirListeAnnulations();
  afficherAnnulationsEnregistrees();
  afficherToast('Séance rétablie', 'modif');
  rafraichirApresAnnulation();
}
function rafraichirApresAnnulation() {
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') appliquerTableauService();
  if (typeof mettreAJourDashboardSurv === 'function') mettreAJourDashboardSurv();
  if (typeof mettreAJourDashboardDir === 'function') mettreAJourDashboardDir();
}

