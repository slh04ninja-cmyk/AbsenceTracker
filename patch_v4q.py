# -*- coding: utf-8 -*-
# patch_v4q.py -> v3.55
# Popup "Details du signalement" (surveillant/directeur) :
#  - titre = nom complet de l'eleve, centre (a la place de "Details du signalement")
#  - la ligne "Eleve" devient "Numero {n}" (rang de l'eleve dans la liste de sa classe)
#  - le div "Motif de justification" perd son icone
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

# ---------- 1. titre du popup = nom de l'eleve, centre ----------
rep("""    <div class="flex justify-between items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <h2 class="text-lg font-bold text-gray-800">Détails du signalement</h2>
      <button onclick="fermerDetailAbsence()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
    </div>""",
"""    <div class="flex items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <span style="width: 28px; flex-shrink: 0;"></span>
      <h2 class="text-lg font-bold text-gray-800 flex-1 text-center" id="detail-titre" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Élève</h2>
      <button onclick="fermerDetailAbsence()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" style="width: 28px; flex-shrink: 0; text-align: right;">&times;</button>
    </div>""",
    1, 'titre : nom de l eleve, centre')

# ---------- 2. ligne "Eleve" -> "Numero" ----------
rep("""          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Élève</span><span class="text-sm font-semibold text-gray-800" id="detail-nom">-</span></div>""",
"""          <div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Numéro</span><span class="text-sm font-semibold text-gray-800" id="detail-numero">-</span></div>""",
    1, 'ligne : Numero dans la liste')

# ---------- 3. icone du bloc "Motif de justification" ----------
rep("""            <span class="motif-icone"><i class="fas fa-clipboard-check"></i></span>\n""",
    "", 1, 'motif : icone supprimee')
rep("""    .motif-icone { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #fff; background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); box-shadow: 0 4px 12px rgba(59,130,246,0.35); flex-shrink: 0; }\n""",
    "", 1, 'motif : CSS .motif-icone supprime')
rep("""    body:not(.theme-sombre).role-enseignant .motif-icone, body:not(.theme-sombre).role-surveillant .motif-icone, body:not(.theme-sombre).role-directeur .motif-icone { background: linear-gradient(135deg, var(--lot-primaire) 0%, var(--lot-fonce) 100%); }\n""",
    "", 1, 'motif : CSS role .motif-icone supprime')

# ---------- 4. JS : titre + numero ----------
rep("""  document.getElementById('detail-nom').textContent = abs.nom;""",
"""  // Titre du popup = nom complet de l'eleve ; la ligne "Élève" devient son numero dans la liste
  const elTitre = document.getElementById('detail-titre');
  if (elTitre) elTitre.textContent = abs.nom;
  const elNum = document.getElementById('detail-numero');
  if (elNum) {
    const cl = classes.find(c => c.nom === abs.classe);
    const idx = cl ? cl.eleves.findIndex(e => e.id === abs.eleveId) : -1;
    elNum.textContent = idx >= 0 ? String(idx + 1) : '—';
  }""", 1, 'JS : titre + numero')

# ---------- 5. version ----------
rep('AbsenceTrack v3.54', 'AbsenceTrack v3.55', 1, 'label v3.55')

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
