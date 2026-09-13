# -*- coding: utf-8 -*-
# patch_v5f.py -> v3.68
# 1. La liste "Seances annulees" des Dashboards (dir + surveillant) vient de 2 sources :
#    les saisies directes (Gestion > Fermeture > vue Seance) ET les seances calculees depuis
#    l'absence prevue des enseignants (tableaux de service), sans doublon.
# 2. Gestion : la liste des fermetures s'affiche en cartes (comme les absences des profs)
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
# 1. JS : seances calculees depuis les absences des enseignants + fusion des 2 sources
# ══════════════════════════════════════════════════════════════════
rep("""// Ordre : de la plus proche a la plus lointaine (les seances a venir d'abord, puis les passees recentes)
function trierSeancesAnnulees() {
  const auj = fmtDateISO(new Date());
  return seancesAnnulees.slice().sort((a, b) => {""",
"""// Seances annulees PARCE QU'UN ENSEIGNANT EST ABSENT : calculees depuis son tableau de service.
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
    const parJour = {};
    Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
      if (c.prof !== code) return;
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
          motif: ind.motif || 'Absence', par: ind.par || ''
        });
      });
    }
  });
  return resultat;
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

// Ordre : de la plus proche a la plus lointaine (les seances a venir d'abord, puis les passees recentes)
function trierSeancesAnnulees(liste) {
  const auj = fmtDateISO(new Date());
  return (liste || seancesAnnulees).slice().sort((a, b) => {""",
    1, 'JS : seances calculees + fusion')

# le tri : a la fin, departager par heure (inchange) ; on adapte le nom du parametre dans le corps
rep("""  const conteneurs = document.querySelectorAll('.js-seances-annulees');
  const auj = fmtDateISO(new Date());
  const liste = trierSeancesAnnulees();""",
"""  const conteneurs = document.querySelectorAll('.js-seances-annulees');
  const auj = fmtDateISO(new Date());
  const liste = trierSeancesAnnulees(listeSeancesAnnulees());""",
    1, 'afficherSeancesAnnulees : 2 sources')

rep("""    liste.forEach(sn => {
      const jour = String(sn.dateISO || '');
      const titre = dateAffichage(jour) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
        (jour > auj ? ' <span class="tag-avenir">À venir</span>' : '');
      const sous = (sn.motif || '') + (sn.par ? ' · par ' + sn.par : '');
      cont.appendChild(carteLigne(titre, sous, { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
    });""",
"""    liste.forEach(sn => {
      const jour = String(sn.dateISO || '');
      const parAbsence = sn.origine === 'absence';
      const titre = dateAffichage(jour) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
        (parAbsence ? ' <span class="tag-avenir">Absence prof</span>' : '') +
        (jour > auj ? ' <span class="tag-avenir">À venir</span>' : '');
      const sous = parAbsence
        ? 'Absence de ' + nomProfCode(sn.profCode) + (sn.motif ? ' · ' + sn.motif : '')
        : ((sn.motif || '') + (sn.par ? ' · par ' + sn.par : ''));
      // une seance annulee par une absence se retire depuis la rubrique RH, pas ici
      cont.appendChild(carteLigne(titre, sous, parAbsence ? null : { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
    });""",
    1, 'afficherSeancesAnnulees : cartes des 2 origines')

# ══════════════════════════════════════════════════════════════════
# 2. JS : liste des fermetures en cartes (meme rendu)
# ══════════════════════════════════════════════════════════════════
i1 = s.index('function afficherFermetures() {')
i2 = s.index('// ========== INDISPONIBILITE D\'UN ENSEIGNANT (directeur) ==========')
nouvelle = '''function afficherFermetures() {
  const cont = document.getElementById('ferm-liste');
  if (!cont) return;
  cont.innerHTML = '';
  if (fermeturesEtab.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune fermeture enregistrée.</p>';
    return;
  }
  fermeturesEtab.slice().sort((a, b) => String(a.debut).localeCompare(String(b.debut))).forEach(f => {
    const titre = (f.libelle || f.type || 'Fermeture') + ' · ' + dateAffichage(f.debut) +
      (f.fin && f.fin !== f.debut ? ' → ' + dateAffichage(f.fin) : '');
    const sous = (f.type || '') + ' · ' + libellePortee(f.portee) + (f.par ? ' · par ' + f.par : '');
    cont.appendChild(carteLigne(titre, sous, {
      icone: '<i class="fas fa-trash"></i>', couleur: '#dc2626', onclick: () => supprimerFermeture(f.id)
    }));
  });
}

'''
s = s[:i1] + nouvelle + s[i2:]
print('%-52s OK' % 'JS : fermetures en cartes')

# ══════════════════════════════════════════════════════════════════
# 3. HTML + CSS : la liste des fermetures devient une liste de cartes
# ══════════════════════════════════════════════════════════════════
rep("""          <div id="ferm-liste" class="space-y-2 mt-3 liste-reglages"></div>""",
"""          <div class="stat-label" style="margin-bottom: 4px;">Fermetures enregistrées</div>
          <div id="ferm-liste" class="js-fermetures"></div>""",
    1, 'HTML : ferm-liste en cartes')

rep("""    .js-seances-annulees, .js-absences-personnel {""",
"""    .js-seances-annulees, .js-absences-personnel, .js-fermetures {""",
    1, 'CSS : classe js-fermetures (1/3)')
rep("""    body.theme-sombre .js-seances-annulees, body.theme-sombre .js-absences-personnel { background: #0f172a; border-color: #334155; }""",
"""    body.theme-sombre .js-seances-annulees, body.theme-sombre .js-absences-personnel, body.theme-sombre .js-fermetures { background: #0f172a; border-color: #334155; }""",
    1, 'CSS : classe js-fermetures (2/3)')
rep("""    .js-seances-annulees > div, .js-absences-personnel > div {""",
"""    .js-seances-annulees > div, .js-absences-personnel > div, .js-fermetures > div {""",
    1, 'CSS : classe js-fermetures (3/3)')

# ══════════════════════════════════════════════════════════════════
# 4. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.67', 'AbsenceTrack v3.68', 1, 'label v3.68')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
