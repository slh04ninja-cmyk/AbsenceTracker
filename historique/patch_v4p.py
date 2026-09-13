# -*- coding: utf-8 -*-
# patch_v4p.py -> v3.54
# 1. Historique enseignant : cartes eleves a la hauteur de celles du surveillant/directeur
# 2. Fiche eleve (popup des 3 roles) : suppression de la ligne "Nom arabe"
# 3. Dashboard enseignant : un retard converti en absence prend le style rouge + la coche A (plus R)
# 4. Popup "Details du signalement" : plus de ligne Duree pour un retard, Heure fusionnee avec Date
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

# ---------- 1. hauteur des cartes de l'Historique enseignant ----------
rep("""    body.role-directeur .carte-eleve,
    body.role-surveillant .carte-eleve { height: 44px; padding: 4px 14px; }""",
"""    body.role-directeur .carte-eleve,
    body.role-surveillant .carte-eleve,
    body.role-enseignant .carte-eleve { height: 44px; padding: 4px 14px; }""",
    1, 'historique enseignant : 44px')

# ---------- 2. fiche eleve : plus de "Nom arabe" ----------
rep("""    ligneFiche('Nom arabe', el.nomArabe || el.nom || '—') +\n""", "", 1, 'fiche : Nom arabe supprime')

# ---------- 3. dashboard enseignant : type effectif (retard converti = absence) ----------
rep("= a.type || 'absence';", "= typeEffectif(a);", 3, 'coches A/R : type effectif')

# ---------- 4. popup : Heure fusionnee avec Date, pas de Duree pour un retard ----------
rep("""          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Heure</span><span class="text-sm font-semibold text-gray-800" id="detail-heure">-</span></div>\n""",
    "", 1, 'popup : ligne Heure supprimee')

rep("""  document.getElementById('detail-date').textContent = abs.date;
  document.getElementById('detail-heure').textContent = abs.heure || '-';""",
"""  // Date et heure sur une seule ligne : {Date} . {Time}
  document.getElementById('detail-date').textContent = abs.date + (abs.heure ? ' . ' + abs.heure : '');""",
    1, 'popup : Date . Heure fusionnes')

rep("""  const rowDuree = document.getElementById('row-duree');
  if (abs.duree) { document.getElementById('detail-duree').textContent = abs.duree; rowDuree.style.display = 'flex'; }
  else rowDuree.style.display = 'none';""",
"""  // Pas de duree pour un retard (regle v3.54)
  const rowDuree = document.getElementById('row-duree');
  if (abs.duree && abs.type !== 'retard') { document.getElementById('detail-duree').textContent = abs.duree; rowDuree.style.display = 'flex'; }
  else rowDuree.style.display = 'none';""",
    1, 'popup : duree masquee pour un retard')

# ---------- 5. version ----------
rep('AbsenceTrack v3.53', 'AbsenceTrack v3.54', 1, 'label v3.54')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
