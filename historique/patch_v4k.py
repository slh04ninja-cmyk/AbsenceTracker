# -*- coding: utf-8 -*-
# patch_v4k.py -> v3.50
# Regle : un RETARD doit etre approuve dans les 30 min ; sinon il se transforme en ABSENCE.
#  - popup "Details du signalement" (surveillant/directeur) : type 'Retard -> Absence'
#  - apres approbation, l'historique (fiche eleve) affiche 'Ab' et non 'Rd'
#  - compteurs / stats / export : le retard hors delai compte comme une ABSENCE
import io, sys

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()

def rep(old, new, n=1, nom=''):
    global s
    c = s.count(old)
    ok = (c == n)
    print('%-46s occurrences=%d (attendu %d) %s' % (nom or old[:40], c, n, 'OK' if ok else '!!! ECHEC'))
    if not ok: sys.exit(1)
    s = s.replace(old, new)

# ---------- 1. helpers ----------
rep("""function libelleStatut(s) {""",
"""// ========== RETARD NON APPROUVE DANS LES 30 MIN -> ABSENCE ==========
// Un retard doit etre approuve dans les 30 min qui suivent le signalement ;
// passe ce delai il se transforme en absence (type effectif = 'absence').
const DELAI_RETARD_MIN = 30;

function datetimeSignalement(a) {
  if (!a) return null;
  const d = new Date(String(a.dateISO || '') + 'T' + String(a.heure || '00:00') + ':00');
  return isNaN(d.getTime()) ? null : d;
}

// Vrai si le retard est reste au-dela des 30 min (approbation trop tardive ou absente)
function retardHorsDelai(a) {
  if (!a || a.type !== 'retard') return false;
  const sig = datetimeSignalement(a);
  if (!sig) return false;
  let ref = new Date();
  if (a.justifieLe) {
    const p = String(a.justifieLe).replace(' ', 'T');
    const d = new Date(p.length === 16 ? p + ':00' : p);
    if (!isNaN(d.getTime())) ref = d;
  }
  return (ref.getTime() - sig.getTime()) > DELAI_RETARD_MIN * 60000;
}

// Type effectif : un retard hors delai compte comme une absence
function typeEffectif(a) {
  if (!a) return 'absence';
  if (a.type === 'retard' && retardHorsDelai(a)) return 'absence';
  return a.type || 'absence';
}

// Libelle du type dans le detail du signalement : 'Retard' -> 'Retard -> Absence'
function libelleTypeAffiche(a) {
  if (a && a.type === 'retard' && retardHorsDelai(a)) return 'Retard \\u2192 Absence';
  return libelleType(a && a.type);
}

function libelleStatut(s) {""", 1, 'helpers retard/30 min')

# ---------- 2. popup Details du signalement ----------
rep("""  const estRetard = abs.type === 'retard';
  const estExclusion = abs.type === 'exclusion';""",
"""  const estRetard = typeEffectif(abs) === 'retard';
  const estExclusion = abs.type === 'exclusion';""", 1, 'popup : type effectif')

rep("""+ libelleType(abs.type) + '</span>';""",
    """+ libelleTypeAffiche(abs) + '</span>';""", 1, 'popup : libelle Retard -> Absence')

# ---------- 3. compteurs / stats / fiche / export ----------
rep("(a.type || 'absence') !== 'retard'", "typeEffectif(a) !== 'retard'", 7, 'compteurs absences')
# (le motif global attraperait aussi les 2 occurrences internes aux helpers ci-dessus -> lieux precis)
rep("a => a.type === 'retard').length;", "a => typeEffectif(a) === 'retard').length;", 4, 'compteurs retards')
rep("const retard = a.type === 'retard';", "const retard = typeEffectif(a) === 'retard';", 1, 'fiche : marque Ab/Rd')
rep("    Type: libelleType(a.type),", "    Type: libelleType(typeEffectif(a)),", 1, 'export Excel')

# ---------- 4. donnees de test : retards approuves dans 30 min (et quelques hors delai) ----------
rep("""      justifieLe: justifie ? dateISO + ' ' + heurePlus(creneau.debut, 30) : '',""",
"""      justifieLe: justifie ? dateISO + ' ' + heurePlus(creneau.debut, estRetard ? (Math.random() < 0.75 ? 5 + Math.floor(Math.random() * 20) : 40 + Math.floor(Math.random() * 50)) : 30) : '',""",
    1, 'seed : delai d approbation des retards')

# ---------- 5. version ----------
rep('AbsenceTrack v3.49', 'AbsenceTrack v3.50', 1, 'label v3.50')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
