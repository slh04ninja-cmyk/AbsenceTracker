# -*- coding: utf-8 -*-
# patch_v4t.py -> v3.58
# Carte "Etablissement & annee scolaire" : compacte, sans la phrase de recap ni les champs Libelle S1/S2
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
# 1. Semestres : noms par defaut 1 / 2 (+ migration des anciennes valeurs S1 / S2)
# ══════════════════════════════════════════════════════════════════
rep("""    { nom: 'S1', debut: '2026-09-01', fin: '2027-01-15' },
    { nom: 'S2', debut: '2027-02-01', fin: '2027-05-15' }""",
"""    { nom: '1', debut: '2026-09-01', fin: '2027-01-15' },
    { nom: '2', debut: '2027-02-01', fin: '2027-05-15' }""",
    1, 'semestres : noms par defaut 1 / 2')

rep("""if (!Array.isArray(anneeScolaire.semestres) || anneeScolaire.semestres.length < 2) {
  anneeScolaire.semestres = JSON.parse(JSON.stringify(ANNEE_SCOLAIRE_DEFAUT.semestres));
}""",
"""if (!Array.isArray(anneeScolaire.semestres) || anneeScolaire.semestres.length < 2) {
  anneeScolaire.semestres = JSON.parse(JSON.stringify(ANNEE_SCOLAIRE_DEFAUT.semestres));
}
// Les libelles ne sont plus saisis : "S1"/"S2" (anciens enregistrements) -> "1"/"2"
anneeScolaire.semestres.forEach((sem, i) => {
  const n = String(sem.nom || '').replace(/^s(?:emestre)?\\s*/i, '').trim();
  sem.nom = (n === '1' || n === '2') ? n : String(i + 1);
});""",
    1, 'migration des libelles de semestre')

# ══════════════════════════════════════════════════════════════════
# 2. afficherParametres / enregistrerParametres : plus de champ libelle
# ══════════════════════════════════════════════════════════════════
rep("""  anneeScolaire.semestres.forEach((sem, i) => {
    set('sem' + (i + 1) + '-nom', sem.nom);
    set('sem' + (i + 1) + '-debut', sem.debut);
    set('sem' + (i + 1) + '-fin', sem.fin);
  });""",
"""  anneeScolaire.semestres.forEach((sem, i) => {
    set('sem' + (i + 1) + '-debut', sem.debut);
    set('sem' + (i + 1) + '-fin', sem.fin);
  });""",
    1, 'afficherParametres : libelles retires')

rep("""    semestres: [
      { nom: val('sem1-nom') || 'S1', debut: val('sem1-debut'), fin: val('sem1-fin') },
      { nom: val('sem2-nom') || 'S2', debut: val('sem2-debut'), fin: val('sem2-fin') }
    ]""",
"""    semestres: [
      { nom: (anneeScolaire.semestres[0] || {}).nom || '1', debut: val('sem1-debut'), fin: val('sem1-fin') },
      { nom: (anneeScolaire.semestres[1] || {}).nom || '2', debut: val('sem2-debut'), fin: val('sem2-fin') }
    ]""",
    1, 'enregistrerParametres : libelles conserves')

# ══════════════════════════════════════════════════════════════════
# 3. majEtiquetteAnnee : plus de phrase de recap dans la carte
# ══════════════════════════════════════════════════════════════════
rep("""function majEtiquetteAnnee() {
  const elLogin = document.getElementById('login-annee');
  if (elLogin) elLogin.textContent = libelleEtablissement() + ' — ' + libelleAnneeScolaire();
  const recap = document.getElementById('etab-recap');
  if (recap) recap.textContent = libelleEtablissement() + ' — ' + libelleAnneeScolaire();
}""",
"""function majEtiquetteAnnee() {
  const elLogin = document.getElementById('login-annee');
  if (elLogin) elLogin.textContent = libelleEtablissement() + ' — ' + libelleAnneeScolaire();
}""",
    1, 'majEtiquetteAnnee : recap supprime')

# ══════════════════════════════════════════════════════════════════
# 4. CSS : carte compacte (moins de defilement)
# ══════════════════════════════════════════════════════════════════
rep("""    .fab { position: fixed;""",
"""    /* Carte Etablissement : compacte pour limiter le defilement */
    #etab-card { padding: 12px 14px; }
    #etab-card h3 { margin-bottom: 8px; }
    #etab-card .form-group { margin-bottom: 8px; }
    #etab-card .form-group label { font-size: 11.5px; margin-bottom: 3px; }
    #etab-card .form-group input, #etab-card .form-group select { padding: 9px 12px; font-size: 14px; border-radius: 10px; }
    #etab-card .sd-trigger { min-height: 38px; padding: 8px 12px; font-size: 14px; }
    #etab-card .grid { gap: 8px; }
    #etab-card hr { margin: 10px 0; }
    #etab-card .sep-titre { margin: 8px 0 4px; }
    .fab { position: fixed;""",
    1, 'CSS : carte etablissement compacte')

# ══════════════════════════════════════════════════════════════════
# 5. HTML : id de carte, recap supprime, libelles supprimes, titres compacts
# ══════════════════════════════════════════════════════════════════
rep("""      <!-- Etablissement & annee scolaire -->
      <div class="stat-card mb-4">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-school text-blue-900 mr-2"></i>Établissement & année scolaire</h3>
        <p class="text-sm text-gray-500 mb-3" id="etab-recap"></p>
        <div class="form-group">
          <label>Code établissement (unique)</label>""",
"""      <!-- Etablissement & annee scolaire -->
      <div class="stat-card mb-4" id="etab-card">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-school text-blue-900 mr-2"></i>Établissement & année scolaire</h3>
        <div class="form-group">
          <label>Code établissement (unique)</label>""",
    1, 'HTML : recap supprime + id carte')

rep("""        <p class="text-sm font-bold text-gray-700 mb-2">Semestre 1</p>
        <div class="form-group"><label>Libellé</label><input type="text" id="sem1-nom" placeholder="S1"></div>
        <div class="grid grid-cols-2 gap-3">""",
"""        <p class="text-sm font-bold text-gray-700 sep-titre">Semestre 1</p>
        <div class="grid grid-cols-2 gap-3">""",
    1, 'HTML : libelle S1 supprime')

rep("""        <p class="text-sm font-bold text-gray-700 mb-2">Semestre 2</p>
        <div class="form-group"><label>Libellé</label><input type="text" id="sem2-nom" placeholder="S2"></div>
        <div class="grid grid-cols-2 gap-3">""",
"""        <p class="text-sm font-bold text-gray-700 sep-titre">Semestre 2</p>
        <div class="grid grid-cols-2 gap-3">""",
    1, 'HTML : libelle S2 supprime')

# ══════════════════════════════════════════════════════════════════
# 6. Version
# ══════════════════════════════════════════════════════════════════
rep('AbsenceTrack v3.57', 'AbsenceTrack v3.58', 1, 'label v3.58')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
