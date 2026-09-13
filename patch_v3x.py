# -*- coding: utf-8 -*-
"""AbsenceTrack v3.35

1. Page Stats du directeur : permutation des cartes 2 et 3 (Taux de presence <-> compteurs)
   et suppression de la carte 4 « Repartition Ab / Rd » (le cercle).
2. Fiche historique (popup, tous roles) : la marque redevient Ab / Rd tout court ; une seconde
   ligne affiche la datetime d'approbation a gauche et le code S{x} / D a droite.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-42s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

def coupe(label, debut, fin, apres=None):
    """supprime le bloc [debut, fin) ; apres = ancre pour ne viser qu'une occurrence"""
    global s
    c = s.count(debut)
    ok = (c == 1) if not apres else (c >= 1)
    print(('OK   ' if ok else 'ECHEC') + ' %-42s =%d%s' % (label, c, ' (cible avec ancre)' if apres else ''))
    if not ok:
        return False
    depart = s.index(apres) if apres else 0
    i = s.index(debut, depart)
    j = s.index(fin, i)
    s = s[:i] + s[j:]
    return True

# ================= 1. Stats directeur : permuter 2 & 3, supprimer la carte du cercle =================
CARTE_TAUX = """      <div class="stat-card">
        <div class="stat-label">Taux de présence</div>
        <div class="stat-value" id="dir-stat-presence">—</div>
        <div class="progress-bar"><div class="progress-fill" id="dir-progress-presence" style="width: 0%"></div></div>
        <p class="text-xs text-gray-500 mt-2" id="dir-stat-presence-detail"></p>
      </div>
      <div class="stat-card">
        <div class="grid grid-cols-3 gap-2" id="dir-stats-totaux"></div>
      </div>
"""
CARTE_TAUX_INVERSE = """      <div class="stat-card">
        <div class="grid grid-cols-3 gap-2" id="dir-stats-totaux"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Taux de présence</div>
        <div class="stat-value" id="dir-stat-presence">—</div>
        <div class="progress-bar"><div class="progress-fill" id="dir-progress-presence" style="width: 0%"></div></div>
        <p class="text-xs text-gray-500 mt-2" id="dir-stat-presence-detail"></p>
      </div>
"""
allok &= remplace('permutation cartes 2 et 3', CARTE_TAUX, CARTE_TAUX_INVERSE)

CARTE_DONUT = """      <div class="stat-card">
        <div class="stat-label mb-4">Répartition Ab / Rd</div>
        <div id="dir-chart-repartition" class="flex items-center gap-4"></div>
      </div>
"""
allok &= remplace('suppression carte du cercle', CARTE_DONUT, '')

allok &= coupe('suppression du bloc JS du cercle',
               '  // --- Repartition Ab / Rd ---',
               '  // --- Par classe ---',
               apres='function afficherStatistiquesDir')

# ================= 2. Fiche historique : ligne d'approbation =================
HELPER_ANCIEN = """function libelleStatutAbs(a) {"""
HELPER_NOUVEAU = """// Datetime d'approbation lisible : 'yyyy-mm-dd HH:MM' -> 'dd/mm/yyyy · HH:MM'
function dateHeureApprobation(valeur) {
  const t = String(valeur || '').trim();
  const m = t.match(/^(\\d{4})-(\\d{2})-(\\d{2})[ T](\\d{2}):(\\d{2})/);
  if (!m) return t;
  return m[3] + '/' + m[2] + '/' + m[1] + ' · ' + m[4] + ':' + m[5];
}

function libelleStatutAbs(a) {"""
allok &= remplace('helper dateHeureApprobation', HELPER_ANCIEN, HELPER_NOUVEAU)

LIGNE_ANCIENNE = """      const marque = (retard ? 'Rd' : 'Ab') + (code ? ' - ' + code : '');"""
LIGNE_NOUVELLE = """      const marque = retard ? 'Rd' : 'Ab';"""
allok &= remplace('marque sans le code', LIGNE_ANCIENNE, LIGNE_NOUVELLE)

RENDU_ANCIEN = """      const info = abrevMatiere(a.matiere) + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      return '<div class="py-2 border-b border-gray-200"><div class="flex justify-between items-center"><span class="text-sm font-semibold text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + styleMarque + '">' + marque + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';"""
RENDU_NOUVEAU = """      const info = abrevMatiere(a.matiere) + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      const ligneApprobation = (code && a.justifieLe)
        ? '<div class="flex justify-between items-center mt-1"><span class="text-xs text-gray-500"><i class="fas fa-check-circle mr-1"></i>Approuvé le ' + dateHeureApprobation(a.justifieLe) + '</span><span style="' + styleMarque + '; font-size: 12px;">' + code + '</span></div>'
        : '';
      return '<div class="py-2 border-b border-gray-200"><div class="flex justify-between items-center"><span class="text-sm font-semibold text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + styleMarque + '">' + marque + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p>' + ligneApprobation + '</div>';"""
allok &= remplace('ligne d approbation', RENDU_ANCIEN, RENDU_NOUVEAU)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.34', 'AbsenceTrack v3.35', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.35 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ================= verifications =================
for cle, attendu in [('id="dir-chart-repartition"', 0), ('dir-chart-repartition', 0),
                     ('// --- Repartition Ab / Rd ---', 0), ('function dateHeureApprobation', 1),
                     ("const marque = retard ? 'Rd' : 'Ab';", 1), ('ligneApprobation', 2),
                     ('id="dir-stat-presence"', 1), ('id="dir-stats-totaux"', 1),
                     ('id="page-profil"', 1), ('id="page-dir-historique"', 1),
                     ('id="chart-repartition"', 1), ('function afficherStatistiquesDir', 1),
                     ('Approuvé le ', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-38s = %d' % (cle, n))
    allok &= (n == attendu)

# ordre des cartes de la page stats directeur
i = s.index('id="page-dir-stats"')
bloc = s[i:s.index('id="page-profil"')]
ordre = re.findall(r'<div class="stat-label[^"]*">([^<]+)</div>|<div class="grid grid-cols-3 gap-2" id="dir-stats-totaux">', bloc)
cartes = [x for x in ordre if x]
print('carte filtres (per_iode) puis, dans l ordre :', cartes)
attendu = ['Taux de présence', 'Par classe', 'Élèves les plus signalés']
allok_ordre = cartes == attendu
print(('OK   ' if allok_ordre else 'ECHEC') + ' ordre des cartes = %s' % cartes)
allok &= allok_ordre
pos_totaux = bloc.index('id="dir-stats-totaux"')
pos_taux = bloc.index('id="dir-stat-presence"')
print(('OK   ' if pos_totaux < pos_taux else 'ECHEC') + ' compteurs AVANT taux de presence')
allok &= (pos_totaux < pos_taux)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
