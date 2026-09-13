# -*- coding: utf-8 -*-
# patch_v4v.py -> v3.60 (partie 1/2)
# 1. Regles d'annulation en plus des seances annulees :
#    - fermetures de l'etablissement (vacances, examens, fetes, reunion...) avec portee
#    - indisponibilites d'un enseignant sur une ou plusieurs journees
# 2. Points 1-4 : dates encadrees (annee scolaire + jours ouvres), libelle "Séances annulées le {date}",
#    pastille "À venir", prochain cours annule affiche au professeur
import io, sys

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-52s occurrences=%d (attendu %d) %s' % (nom or old[:46], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok: sys.exit(1)
    s = s.replace(old, new)

# ══════════════════════════════════════════════════════════════════
# 1. Chargeurs + regles d'annulation
# ══════════════════════════════════════════════════════════════════
rep("""// ========== ANNULATION DE SEANCE (directeur + surveillant) ==========""",
"""// ========== FERMETURES DE L'ETABLISSEMENT & INDISPONIBILITES DES PROFS ==========
function chargerListe(cle) {
  try {
    const brut = localStorage.getItem(cle);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) { return []; }
}
// Fermeture : { id, dateISO, libelle, type, debut, fin, portee, par, le, profCode }
let fermeturesEtab = chargerListe('fermeturesEtab');
let indispoProfs = chargerListe('indispoProfs');
function sauvegarderFermetures() { localStorage.setItem('fermeturesEtab', JSON.stringify(fermeturesEtab)); }
function sauvegarderIndispo() { localStorage.setItem('indispoProfs', JSON.stringify(indispoProfs)); }
function bornesAnneeScolaire() {
  const s1 = anneeScolaire.semestres[0] || {};
  const s2 = anneeScolaire.semestres[1] || {};
  return { debut: s1.debut || '2000-01-01', fin: s2.fin || '2100-12-31' };
}
// Bornes de l'annee scolaire sur tous les champs de date concernes
function bornerDatesAnnee() {
  const b = bornesAnneeScolaire();
  ['annul-date', 'indispo-debut', 'indispo-fin', 'ferm-debut', 'ferm-fin'].forEach(id => {
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
  const c = comptes.find(x => x.code === code);
  return c ? c.nom : (code || '');
}
// Creneau reel d'une classe qui couvre une heure donnee
function creneauDeHeure(classe, jour, heure) {
  const m = hhmmEnMinutes(heure);
  return creneauxClasseJour(classe, jour).find(c => m >= hhmmEnMinutes(c.debut) && m < hhmmEnMinutes(c.fin)) || null;
}

// ========== ANNULATION DE SEANCE (directeur + surveillant) ==========""",
    1, 'JS : fermetures + indisponibilites')

# 2. raisonAnnulation remplace l'ancienne seanceAnnulee
rep("""// Seance annulee qui couvre une heure donnee (meme date + meme classe)
function seanceAnnulee(dateISO, classe, heure) {
  const m = hhmmEnMinutes(heure);
  return seancesAnnulees.find(s => s.dateISO === dateISO && s.classe === classe &&
    m >= hhmmEnMinutes(s.debut) && m < hhmmEnMinutes(s.fin || s.debut)) || null;
}""",
"""// Pourquoi une seance n'a pas lieu : annulation explicite, fermeture de l'etablissement
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
function seanceAnnulee(dateISO, classe, heure) { return raisonAnnulation(dateISO, classe, heure); }""",
    1, 'JS : raisonAnnulation')

# ══════════════════════════════════════════════════════════════════
# 3. Modale : bornes de dates, libelle dynamique, pastille "a venir", regles du jour
# ══════════════════════════════════════════════════════════════════
rep("""function ouvrirModalAnnulation() {
  if (!estRoleVieScolaire()) return;
  const dateEl = document.getElementById('annul-date');
  if (dateEl && !dateEl.value) dateEl.value = fmtDateISO(new Date());""",
"""function ouvrirModalAnnulation() {
  if (!estRoleVieScolaire()) return;
  bornerDatesAnnee();
  const dateEl = document.getElementById('annul-date');
  if (dateEl && !dateEl.value) dateEl.value = fmtDateISO(new Date());""",
    1, 'ouvrirModalAnnulation : bornes')

rep("""function afficherAnnulationsDuJour(dateISO) {
  const cont = document.getElementById('annul-liste');
  if (!cont) return;
  const liste = seancesAnnulees.filter(s => s.dateISO === dateISO)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune séance annulée ce jour.</p>';
    return;
  }
  cont.innerHTML = '';
  liste.forEach(sn => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg';
    item.innerHTML = '<div><p class="font-medium text-gray-700">' + sn.classe + ' · ' + sn.debut + '–' + sn.fin + '</p>' +
      '<p class="text-xs text-gray-500">' + (sn.motif || '') + (sn.par ? ' · par ' + sn.par : '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.textContent = 'Rétablir';
    b.onclick = () => retablirSeance(sn.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
}""",
"""function afficherAnnulationsDuJour(dateISO) {
  const cont = document.getElementById('annul-liste');
  if (!cont) return;
  const titre = document.getElementById('annul-liste-titre');
  if (titre) titre.textContent = 'Séances annulées le ' + dateAffichage(dateISO);
  const avenir = dateISO > fmtDateISO(new Date());
  const liste = seancesAnnulees.filter(s => s.dateISO === dateISO)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  // Regles du jour : fermetures de l'etablissement + indisponibilites des enseignants
  const regles = [];
  fermeturesEtab.forEach(f => {
    if (!dansPeriode(f, dateISO)) return;
    regles.push({ source: 'Fermeture', nom: f.libelle || f.type || 'Établissement fermé',
      detail: (f.type || '') + ' · ' + libellePortee(f.portee), par: f.par });
  });
  indispoProfs.forEach(i => {
    if (!dansPeriode(i, dateISO)) return;
    regles.push({ source: 'Indisponibilité', nom: nomProfCode(i.profCode),
      detail: (i.motif || 'Absence') + ' · ' + libellePortee(i.portee), par: i.par });
  });
  cont.innerHTML = '';
  if (liste.length === 0 && regles.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune séance annulée à cette date.</p>';
    return;
  }
  liste.forEach(sn => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
    item.innerHTML = '<div><p class="font-medium text-gray-700">' + sn.classe + ' · ' + sn.debut + '–' + sn.fin +
      (avenir ? ' <span class="tag-avenir">À venir</span>' : '') + '</p>' +
      '<p class="text-xs text-gray-500">' + (sn.motif || '') + (sn.par ? ' · par ' + sn.par : '') + '</p></div>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-xs font-bold flex-shrink-0';
    b.style = 'color: #1d4ed8;';
    b.textContent = 'Rétablir';
    b.onclick = () => retablirSeance(sn.id);
    item.appendChild(b);
    cont.appendChild(item);
  });
  regles.forEach(r => {
    const item = document.createElement('div');
    item.className = 'bg-gray-50 rounded-lg';
    item.innerHTML = '<p class="font-medium text-gray-700">' + r.nom + ' <span class="tag-avenir">' + r.source + '</span></p>' +
      '<p class="text-xs text-gray-500">' + (r.detail || '') + (r.par ? ' · par ' + r.par : '') + '</p>';
    cont.appendChild(item);
  });
}""",
    1, 'afficherAnnulationsDuJour : libelle + regles + a venir')

rep("""  if (!classe || !parties[0]) { afficherToast('Choisissez une classe et une séance', 'error'); return; }
  if (seancesAnnulees.some(sn => sn.dateISO === dateISO && sn.classe === classe && sn.debut === parties[0])) {""",
"""  if (!classe || !parties[0]) { afficherToast('Choisissez une classe et une séance', 'error'); return; }
  const jourSem = new Date(dateISO + 'T12:00:00').getDay();
  if (jourSem === 0 || jourSem === 6) { afficherToast('Pas de cours le week-end', 'error'); return; }
  const bornes = bornesAnneeScolaire();
  if (dateISO < bornes.debut || dateISO > bornes.fin) { afficherToast("Date en dehors de l'année scolaire", 'error'); return; }
  if (seancesAnnulees.some(sn => sn.dateISO === dateISO && sn.classe === classe && sn.debut === parties[0])) {""",
    1, 'confirmerAnnulationSeance : garde-fous week-end + annee')

# ══════════════════════════════════════════════════════════════════
# 4. Enseignant : seance en cours + prochain cours annule
# ══════════════════════════════════════════════════════════════════
rep("""  const annulee = enCours.length > 0 ? seanceAnnulee(fmtDateISO(new Date()), enCours[0].classe, enCours[0].debut) : null;
  if (annulee) {""",
"""  const raison = enCours.length > 0 ? raisonAnnulation(fmtDateISO(new Date()), enCours[0].classe, enCours[0].debut) : null;
  if (raison) {""",
    1, 'appliquerTableauService : raison')

rep("""      const det = document.getElementById('ens-annulee-detail');
      if (det) det.textContent = annulee.classe + ' · ' + annulee.debut + '–' + annulee.fin +
        (annulee.motif ? ' — ' + annulee.motif : '') + (annulee.par ? ' (par ' + annulee.par + ')' : '');""",
"""      const det = document.getElementById('ens-annulee-detail');
      if (det) det.textContent = enCours[0].classe + ' · ' + enCours[0].debut + '–' + enCours[0].fin +
        ' — ' + raison.motif + (raison.par ? ' (par ' + raison.par + ')' : '');""",
    1, 'appliquerTableauService : detail')

rep("""function prochainCreneau(email) {""",
"""// Date du prochain creneau d'un enseignant (aujourd'hui si possible, sinon les jours suivants)
function dateProchainCreneau(email) {
  const jour = jourSemaineCourant();
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  if (creneauxDuJour(email, jour).some(c => hhmmEnMinutes(c.debut) > m)) return fmtDateISO(new Date());
  for (let i = 1; i <= 7; i++) {
    const j = ((jour - 1 + i) % 7) + 1;
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (creneauxDuJour(email, j).length > 0) return fmtDateISO(d);
  }
  return fmtDateISO(new Date());
}

function prochainCreneau(email) {""",
    1, 'dateProchainCreneau')

rep("""  const prochain = prochainCreneau(emailUtilisateur());
  const elProchain = document.getElementById('ens-repos-prochain');
  if (elProchain) {
    elProchain.textContent = prochain
      ? 'Prochain cours : ' + prochain.quand + ' à ' + prochain.creneau.debut + ' · ' + prochain.creneau.classe
      : 'Aucun cours programmé';
  }""",
"""  const email = emailUtilisateur();
  const prochain = prochainCreneau(email);
  const elProchain = document.getElementById('ens-repos-prochain');
  if (elProchain) {
    if (!prochain) {
      elProchain.textContent = 'Aucun cours programmé';
    } else {
      const raison = raisonAnnulation(dateProchainCreneau(email), prochain.creneau.classe, prochain.creneau.debut);
      elProchain.textContent = (raison ? 'Prochain cours annulé : ' : 'Prochain cours : ') +
        prochain.quand + ' à ' + prochain.creneau.debut + ' · ' + prochain.creneau.classe +
        (raison ? ' — ' + raison.motif : '');
    }
  }""",
    1, 'afficherReposEnseignant : prochain cours annule')

# ══════════════════════════════════════════════════════════════════
# 5. HTML : libelle dynamique + CSS pastille
# ══════════════════════════════════════════════════════════════════
rep("""        <div class="stat-label" style="margin-bottom: 4px;">Séances annulées ce jour</div>""",
"""        <div class="stat-label" style="margin-bottom: 4px;" id="annul-liste-titre">Séances annulées</div>""",
    1, 'HTML : libelle dynamique')

rep("""    /* Modale Annuler une seance : compacte + liste des annulations a defilement */""",
"""    .tag-avenir { display: inline-block; font-size: 10px; font-weight: 700; color: #1d4ed8; background: rgba(29,78,216,0.12); border-radius: 999px; padding: 1px 7px; vertical-align: middle; }
    body.theme-sombre .tag-avenir { color: #93c5fd; background: rgba(147,197,253,0.18); }

    /* Modale Annuler une seance : compacte + liste des annulations a defilement */""",
    1, 'CSS : pastille a venir')

# ══════════════════════════════════════════════════════════════════
# 6. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.59', 'AbsenceTrack v3.60', 1, 'label v3.60')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
