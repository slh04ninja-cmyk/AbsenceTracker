# -*- coding: utf-8 -*-
"""patch_v5q.py -> v3.78

Réinitialisation d'un mot de passe oublié, dans la fenêtre « Modifier » de chaque personne :
  - « Générer » (le dé) reste pour la CRÉATION (premier mot de passe, ou mot de passe choisi à la main)
  - « Réinitialiser le mot de passe » (nouveau) = dépannage : 1 clic -> confirmation ->
    nouveau mot de passe de 8 caractères, AFFICHÉ EN GRAND avec bouton Copier, la date du
    dernier changement, et une FICHE PDF individuelle à remettre (sans re-télécharger la
    liste complète).
"""
import io, re, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
ok = True

def sub(ancien, nouveau, label, attendu=1):
    global html, ok
    n = html.count(ancien)
    if n != attendu:
        print('!! %s : %d occurrence(s) (attendu %d)' % (label, n, attendu)); ok = False; return
    html = html.replace(ancien, nouveau)
    print('OK %s' % label)

# ============================================================================
# 1. HTML — bouton « Réinitialiser » + bloc d'affichage, dans la fenêtre Modifier
# ============================================================================
ancre = """      <ul class="text-xs text-gray-600 space-y-1 mb-3">
        <li><i class="fas fa-check-circle text-green-500 mr-2"></i>8 caractères, lettres et chiffres (sans caractères spéciaux)</li>
      </ul>"""
bloc = """      <button type="button" class="w-full mb-3 btn-fermer" style="border: 2px solid var(--primary); color: var(--primary); background: transparent;" onclick="reinitialiserMotDePasse()">
        <i class="fas fa-rotate-right"></i> Réinitialiser le mot de passe
      </button>
      <div id="renommer-reset" class="hidden mb-3" style="border: 2px solid #16a34a; border-radius: 12px; padding: 10px; background: #f0fdf4;">
        <p class="text-xs font-bold" style="color: #166534;">Nouveau mot de passe — à remettre à cette personne</p>
        <div class="flex items-center gap-2 mt-2">
          <input type="text" id="reset-mdp" readonly style="flex: 1; min-width: 0; font-size: 20px; font-weight: 800; text-align: center; letter-spacing: 2px; font-family: monospace; padding: 8px; border: 1px solid #16a34a; border-radius: 8px; background: #ffffff;">
          <button type="button" class="btn-mini-profil" style="border-color: #16a34a; color: #16a34a;" onclick="copierTexte('reset-mdp')"><i class="fas fa-copy"></i> Copier</button>
        </div>
        <p class="text-xs mt-2" style="color: #166534;">Connexion : <span id="reset-email"></span></p>
        <p class="text-xs mt-1" id="reset-date" style="color: #64748b;"></p>
        <button type="button" class="btn-primary w-full btn-ripple mt-2" onclick="ficheIdentifiantPersonne()"><i class="fas fa-file-pdf"></i> Télécharger sa fiche</button>
      </div>
""" + ancre
sub(ancre, bloc, 'bouton Réinitialiser + bloc d affichage')

# ============================================================================
# 2. JS — réinitialisation, copie, fiche individuelle
# ============================================================================
code = r'''
// ========== RÉINITIALISATION D'UN MOT DE PASSE (oubli) ==========
// « Générer » (dans la même fenêtre) sert à CHOISIR un mot de passe, notamment à la
// création. « Réinitialiser » sert à DÉPANNER quelqu'un qui a oublié le sien : le
// nouveau s'affiche en grand, avec la date du changement et une fiche PDF à remettre.
// Aucun envoi d'email n'est possible : les adresses @taalim.ma sont des identifiants
// internes, pas des boîtes mail — c'est donc le directeur qui rétablit l'accès.
let dernierReset = null;      // {cle, nom, email, mdp, role} — pour la fiche PDF

function chargerDatesMdp() {
  try {
    const brut = localStorage.getItem('datesMdp');
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
function sauvegarderDatesMdp(d) { localStorage.setItem('datesMdp', JSON.stringify(d)); }

function reinitialiserMotDePasse() {
  const cle = profARenommer;
  if (!cle) return;
  const prof = comptes.find(c => c.code === cle || c.email === cle);
  if (!prof) return;
  demanderConfirmation('Réinitialiser le mot de passe de « ' + (prof.nom || '') + ' » ? Le nouveau s\'affichera ici, à lui remettre.',
    function () {
      const mdp = genererMotDePasse(8);
      prof.password = mdp;
      if (prof.email) { motsDePasse[prof.email] = mdp; sauvegarderMotsDePasse(); }
      const dates = chargerDatesMdp();
      dates[cle] = jourCourant();
      sauvegarderDatesMdp(dates);
      dernierReset = { cle: cle, nom: prof.nom, email: prof.email || '', mdp: mdp, role: prof.role };

      // affichage en grand (la fenêtre de modification est restée ouverte)
      const champ = document.getElementById('reset-mdp'); if (champ) champ.value = mdp;
      const mail = document.getElementById('reset-email');
      if (mail) mail.textContent = prof.email || '(compte non encore créé)';
      const dt = document.getElementById('reset-date');
      if (dt) dt.textContent = 'Modifié le ' + dateAffichage(dates[cle]);
      const mdpSaisi = document.getElementById('renommer-mdp'); if (mdpSaisi) mdpSaisi.value = '';
      const bloc = document.getElementById('renommer-reset'); if (bloc) bloc.classList.remove('hidden');
      afficherListeProfs();
      afficherToast('Mot de passe réinitialisé', 'success');
    });
}

// Copie dans le presse-papiers (navigator.clipboard n'existe pas partout, notamment
// quand la page est ouverte depuis un fichier : on prévoit le repli par sélection)
function copierTexte(idChamp) {
  const el = document.getElementById(idChamp);
  if (!el) return;
  const texte = String(el.value || '');
  if (!texte) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(
        function () { afficherToast('Mot de passe copié', 'success'); },
        function () { copierParSelection(el); });
      return;
    }
  } catch (e) {}
  copierParSelection(el);
}
function copierParSelection(el) {
  try {
    const etait = el.readOnly;
    el.readOnly = false;
    el.select();
    el.setSelectionRange(0, 999);
    document.execCommand('copy');
    el.readOnly = etait;
    afficherToast('Mot de passe copié', 'success');
  } catch (e) {
    afficherToast('Copie impossible : notez le mot de passe', 'error');
  }
}

// Fiche PDF individuelle : un seul tableau, pour la personne concernée
async function ficheIdentifiantPersonne() {
  if (!dernierReset) { afficherToast('Réinitialisez d\'abord le mot de passe', 'error'); return; }
  if (!(await pdfPret())) return;
  try {
    const lib = window.PDFLib;
    const sections = [{
      titre: dernierReset.role === 'surveillant' ? 'Surveillant' : 'Enseignant',
      lignes: [{ nom: dernierReset.nom, email: dernierReset.email, password: dernierReset.mdp }]
    }];
    const doc = await construirePdfIdentifiants(lib, lib.PDFDocument, window.fontkit,
      base64VersOctets(POLICE_ARABE_B64), sections, {
        etablissement: (etablissement && etablissement.nom) || '',
        annee: (anneeScolaire && anneeScolaire.libelle) || '',
        date: dateAffichage(jourCourant())
      });
    const octets = await doc.save();
    const nomFichier = 'identifiant-' + String(dernierReset.cle).replace(/[^A-Za-z0-9-]/g, '') + '.pdf';
    telechargerFichier(octets, nomFichier);
    afficherToast('Fiche téléchargée', 'success');
  } catch (e) {
    afficherToast('Génération du PDF impossible : ' + (e && e.message ? e.message : e), 'error');
  }
}
'''
sub("""// ========== SURVEILLANTS : ajout, modification, suppression ==========""",
    "// ========== SURVEILLANTS : ajout, modification, suppression ==========" + code,
    'section JS réinitialisation')

# ============================================================================
# 3. Remettre le bloc à zéro quand on ouvre la fenêtre
# ============================================================================
sub("""  creationProfil = false;
  profARenommer = c.code || c.email;
  const btnSup = document.getElementById('renommer-supprimer');""",
"""  creationProfil = false;
  profARenommer = c.code || c.email;
  // on repart d'un affichage vierge : pas de mot de passe réinitialisé de la fois d'avant
  dernierReset = null;
  const blocReset = document.getElementById('renommer-reset');
  if (blocReset) blocReset.classList.add('hidden');
  const btnSup = document.getElementById('renommer-supprimer');""",
    'réinitialisation de l affichage à l ouverture')

sub("""  const b = document.getElementById('renommer-supprimer');if (b) b.classList.add('hidden');""",
"""  const b = document.getElementById('renommer-supprimer');if (b) b.classList.add('hidden');
  const rb = document.getElementById('renommer-reset');  if (rb) rb.classList.add('hidden');""",
    'ajout : bloc de réinitialisation masqué')

# ============================================================================
# 4. label
# ============================================================================
sub('AbsenceTrack v3.77', 'AbsenceTrack v3.78', 'label v3.78')

if not ok:
    print('=== PATCH ANNULE ==='); sys.exit(1)

shutil.copyfile(F, 'AbsenceTrack-v3.77-backup.html')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)  backup AbsenceTrack-v3.77-backup.html' % (F, len(html.encode('utf-8'))))
