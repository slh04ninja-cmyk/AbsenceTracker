# -*- coding: utf-8 -*-
"""AbsenceTrack v3.30 : sous la carte du Dashboard DIRECTEUR, on ajoute la meme div que
le surveillant (#surv-absences-list) : les cartes des absents du jour + le popup de detail.

- le rendu de la liste est extrait dans une fonction commune afficherCartesAbsentsJour(id)
- le popup (modal-absence-detail, global) est partage : clic sur une carte -> detail
- justification depuis le popup : source 'dir' pour le directeur (Justifiee D), motif lu
  dans les chips du popup, et le Dashboard directeur se rafraichit
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

# ---------- 1. HTML : la div de liste sous la carte ----------
ANCRE = """            <div class="absence-subtext">du jour</div>
          </div>
        </div>
      </div>
      <div class="stat-card mb-4">
        <div class="stat-label mb-4"><i class="fas fa-exclamation-triangle text-red-500 mr-1"></i> Alertes importantes</div>"""
NOUVEAU = """            <div class="absence-subtext">du jour</div>
          </div>
        </div>
      </div>
      <div id="dir-absences-list"></div>
      <div class="stat-card mb-4">
        <div class="stat-label mb-4"><i class="fas fa-exclamation-triangle text-red-500 mr-1"></i> Alertes importantes</div>"""
n = s.count(ANCRE)
print(('OK   ' if n == 1 else 'ECHEC') + ' ancre HTML directeur   =%d' % n)
allok &= (n == 1)
s = s.replace(ANCRE, NOUVEAU)

# ---------- 2. JS : extraire le rendu de liste dans une fonction commune ----------
deb = s.index("  const listContainer = document.getElementById('surv-absences-list');")
fin = s.index("  afficherAlertesSurv();", deb)
bloc_surv = s[deb:fin]                      # code d'origine, decale de 4 espaces (fonction)
corps = bloc_surv.replace('surv-absences-list', '__ID__').replace('absencesToday', 'absentsJour')
corps = corps.replace("document.getElementById('__ID__')", "document.getElementById('__ID__')")
# reindenter : la fonction commune n'est plus dans une autre fonction
corps = '\n'.join(l[2:] if l.startswith('  ') else l for l in corps.split('\n'))

COMMUNE = """function afficherCartesAbsentsJour(idConteneur) {
  const absentsJour = absences.filter(a => a.dateISO === fmtDateISO(new Date()) && a.statut === 'absent');
  const listContainer = document.getElementById(idConteneur);
  if (!listContainer) return;
  listContainer.innerHTML = '';
  if (absentsJour.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>Aucun \\u00e9l\\u00e8ve signal\\u00e9 aujourd\\'hui</p></div>';
  } else {
    absentsJour.forEach(abs => {
      const card = document.createElement('div');
      card.className = 'absence-card carte-eleve';
      card.onclick = () => afficherDetailAbsence(abs);
      card.innerHTML = '<div class="absence-card-ligne"><span class="absence-card-name">' + abs.nom + '</span><span class="absence-card-classe">' + abs.classe + '</span><i class="fas fa-chevron-right absence-card-icon"></i></div>';
      listContainer.appendChild(card);
    });
  }
}

"""
# on remplace le bloc d'origine par l'appel a la fonction commune
s = s[:deb] + "  afficherCartesAbsentsJour('surv-absences-list');\n" + s[fin:]
print('OK   rendu surveillant factorise')

# on insere la fonction commune avant mettreAJourDashboardSurv
i = s.index('function mettreAJourDashboardSurv()')
s = s[:i] + COMMUNE + s[i:]

# ---------- 3. le directeur appelle la meme fonction ----------
ANCRE_JS = "  document.getElementById('dir-total').textContent = absencesToday.length;"
AJOUT_JS = ANCRE_JS + "\n\n  // Memes cartes d'absents que le Dashboard surveillant\n  afficherCartesAbsentsJour('dir-absences-list');"
n = s.count(ANCRE_JS)
print(('OK   ' if n == 1 else 'ECHEC') + ' ancre JS directeur      =%d' % n)
allok &= (n == 1)
s = s.replace(ANCRE_JS, AJOUT_JS)

# ---------- 4. popup : justification selon le role + motif des chips ----------
AVANT = "    btnJustifier.onclick = () => { justifierAbsence(abs.id, 'surv'); fermerDetailAbsence(); };"
APRES = ("    const sourceJustif = (utilisateurConnecte && utilisateurConnecte.role === 'directeur') ? 'dir' : 'surv';\n"
         "    btnJustifier.onclick = () => { justifierAbsence(abs.id, sourceJustif); fermerDetailAbsence(); };")
n = s.count(AVANT)
print(('OK   ' if n == 1 else 'ECHEC') + ' source justification    =%d' % n)
allok &= (n == 1)
s = s.replace(AVANT, APRES)

AVANT2 = "  const sel = document.getElementById(source === 'surv' ? 'select-motif' : 'dir-motif');"
APRES2 = ("  const modalOuvert = !document.getElementById('modal-absence-detail').classList.contains('hidden');\n"
          "  const idMotif = (modalOuvert || source === 'surv') ? 'select-motif' : 'dir-motif';\n"
          "  const sel = document.getElementById(idMotif);")
n = s.count(AVANT2)
print(('OK   ' if n == 1 else 'ECHEC') + ' motif lu dans le popup  =%d' % n)
allok &= (n == 1)
s = s.replace(AVANT2, APRES2)

AVANT3 = "  if (source === 'dir') afficherAbsencesDir();"
APRES3 = "  if (source === 'dir') { afficherAbsencesDir(); mettreAJourDashboardDir(); }"
n = s.count(AVANT3)
print(('OK   ' if n == 1 else 'ECHEC') + ' rafraichissement dir    =%d' % n)
allok &= (n == 1)
s = s.replace(AVANT3, APRES3)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.29', 'AbsenceTrack v3.30', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.30        =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('id="dir-absences-list"', 1), ("'dir-absences-list'", 1),
                     ("'surv-absences-list'", 1), ("function afficherCartesAbsentsJour", 1),
                     ('afficherCartesAbsentsJour(', 3)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-32s = %d' % (cle, n))
    allok &= (n == attendu)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

i = s.index('function afficherCartesAbsentsJour')
print('--- fonction commune ---')
print(s[i:i + 520])
print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
