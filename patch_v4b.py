# -*- coding: utf-8 -*-
"""AbsenceTrack v3.40 : page Gestion (directeur), 4 ajustements demandes en un message.

1. Suppression d'un eleve dans le popup de classe : passe par la modale de confirmation
   (mecanisme generique demanderConfirmation/validerConfirmation, la modale remonte a z-index 400
   pour s'afficher au-dessus du popup de classe).
2. Carte de classe : nom + nombre d'eleves sur la MEME ligne (chevron a droite).
3. Hauteur des cartes minimisee (py-2 au lieu de p-4, ecart 8 px au lieu de 12).
4. Popup de classe centre a l'ecran (meme gabarit que la fiche eleve), liste des eleves defilante.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-44s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ---------- 1. popup de classe : centre, defilant, pied fixe ----------
POPUP_ANCIEN = """<div id="modal-classe-detail" class="hidden fixed inset-0 modal-overlay z-50 flex items-end" style="z-index: 200;">
  <div class="modal-content w-full bg-white p-6 rounded-t-3xl" style="max-height: 80vh; overflow-y: auto;">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-gray-800" id="detail-classe-titre"></h2>
      <button onclick="fermerDetailClasse()" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
    </div>
    <div id="detail-classe-eleves"></div>
    <button onclick="supprimerClasseCourante()" class="btn-danger w-full mt-4"><i class="fas fa-trash"></i> Supprimer cette classe</button>
  </div>
</div>"""
POPUP_NOUVEAU = """<div id="modal-classe-detail" class="hidden fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4" style="z-index: 200;">
  <div class="w-full max-w-md bg-white rounded-3xl scale-in shadow-2xl" style="max-height: 85vh; display: flex; flex-direction: column;">
    <div class="flex justify-between items-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
      <h2 class="text-lg font-bold text-gray-800" id="detail-classe-titre"></h2>
      <button onclick="fermerDetailClasse()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
    </div>
    <div class="px-4 pb-3" style="flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
      <div id="detail-classe-eleves"></div>
    </div>
    <div class="px-4 pb-5 pt-2" style="flex-shrink: 0;">
      <button onclick="supprimerClasseCourante()" class="btn-danger w-full"><i class="fas fa-trash"></i> Supprimer cette classe</button>
    </div>
  </div>
</div>"""
allok &= remplace('popup de classe centre', POPUP_ANCIEN, POPUP_NOUVEAU)

# ---------- 2. la modale de confirmation passe au-dessus de tout ----------
allok &= remplace('z-index de la confirmation',
                  '<div id="modal-confirmation" class="hidden fixed inset-0 modal-overlay z-50 flex items-end" style="z-index: 200;">',
                  '<div id="modal-confirmation" class="hidden fixed inset-0 modal-overlay z-50 flex items-end" style="z-index: 400;">')
allok &= remplace('bouton Confirmer generique',
                  '<button onclick="confirmerAbsences()" class="btn-success flex-1">Confirmer</button>',
                  '<button onclick="validerConfirmation()" class="btn-success flex-1">Confirmer</button>')

# ---------- 3. mecanisme de confirmation generique ----------
ANCIEN_CONF = """function annulerConfirmation() {
  document.getElementById('modal-confirmation').classList.add('hidden');
}"""
NOUVEAU_CONF = """// Confirmation generique : demanderConfirmation(message, action) puis validerConfirmation()
let actionConfirmation = null;

function demanderConfirmation(message, action) {
  actionConfirmation = action;
  document.getElementById('message-confirmation').textContent = message;
  document.getElementById('modal-confirmation').classList.remove('hidden');
}

function validerConfirmation() {
  const action = actionConfirmation;
  actionConfirmation = null;
  document.getElementById('modal-confirmation').classList.add('hidden');
  if (typeof action === 'function') action();
  else confirmerAbsences();
}

function annulerConfirmation() {
  actionConfirmation = null;
  document.getElementById('modal-confirmation').classList.add('hidden');
}"""
allok &= remplace('confirmations generiques', ANCIEN_CONF, NOUVEAU_CONF)

# ---------- 4. carte de classe : une seule ligne, plus basse ----------
CARTE_ANCIENNE = """    item.className = 'bg-gray-50 rounded-xl p-4 cursor-pointer';
    item.setAttribute('onclick', 'ouvrirDetailClasse(' + cl.id + ')');
    item.innerHTML =
      '<div class="flex justify-between items-center">' +
        '<div>' +
          '<p class="font-bold text-gray-800">' + cl.nom + '</p>' +
          '<p class="text-sm text-gray-500">' + cl.eleves.length + ' élèves</p>' +
        '</div>' +
        '<i class="fas fa-chevron-right text-gray-400"></i>' +
      '</div>';"""
CARTE_NOUVELLE = """    item.className = 'bg-gray-50 rounded-xl px-4 py-2 cursor-pointer';
    item.setAttribute('onclick', 'ouvrirDetailClasse(' + cl.id + ')');
    item.innerHTML =
      '<div class="flex justify-between items-center">' +
        '<span class="font-bold text-gray-800">' + cl.nom + '</span>' +
        '<span class="flex items-center gap-2">' +
          '<span class="text-sm text-gray-500">' + cl.eleves.length + ' élèves</span>' +
          '<i class="fas fa-chevron-right text-gray-400"></i>' +
        '</span>' +
      '</div>';"""
allok &= remplace('carte de classe sur une ligne', CARTE_ANCIENNE, CARTE_NOUVELLE)
allok &= remplace('ecart entre les cartes',
                  '<div id="dir-classes-list" class="space-y-3"></div>',
                  '<div id="dir-classes-list" class="space-y-2"></div>')

# ---------- 5. suppression d'un eleve : bouton -> confirmation ----------
allok &= remplace('bouton supprimer eleve',
                  '<button onclick="supprimerEleve(${cl.id}, ${e.id}); ouvrirDetailClasse(${cl.id});" class="text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button>',
                  '<button onclick="demanderSuppressionEleve(${cl.id}, ${e.id})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button>')

JS_SUPPR = """// Suppression d'un eleve : confirmation obligatoire avant d'appliquer
function demanderSuppressionEleve(classeId, eleveId) {
  const cl = classes.find(c => c.id === classeId);
  const el = cl ? cl.eleves.find(e => e.id === eleveId) : null;
  if (!cl || !el) return;
  demanderConfirmation('Supprimer ' + libelleEleve(el) + ' de la classe ' + cl.nom + ' ?', function () {
    supprimerEleve(classeId, eleveId);
    ouvrirDetailClasse(classeId);
  });
}

function supprimerEleve(classeId, eleveId) {"""
allok &= remplace('fonction demanderSuppressionEleve', 'function supprimerEleve(classeId, eleveId) {', JS_SUPPR)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.39', 'AbsenceTrack v3.40', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.40 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('onclick="validerConfirmation()"', 1), ('onclick="confirmerAbsences()"', 0),
                     ('function demanderConfirmation', 1), ('function validerConfirmation', 1),
                     ('function demanderSuppressionEleve', 1), ('actionConfirmation', 4),
                     ("demanderSuppressionEleve(${cl.id}, ${e.id})", 1),
                     ('supprimerEleve(${cl.id}, ${e.id}); ouvrirDetailClasse', 0),
                     ('id="modal-classe-detail" class="hidden fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4"', 1),
                     ('id="modal-confirmation" class="hidden fixed inset-0 modal-overlay z-50 flex items-end" style="z-index: 400;"', 1),
                     ("item.className = 'bg-gray-50 rounded-xl px-4 py-2 cursor-pointer'", 1),
                     ('id="dir-classes-list" class="space-y-2"', 1),
                     ('id="page-profil"', 1), ('id="page-dir-stats"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-58s = %d' % (cle, n))
    allok &= (n == attendu)

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
