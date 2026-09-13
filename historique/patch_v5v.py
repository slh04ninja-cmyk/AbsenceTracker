# -*- coding: utf-8 -*-
# patch_v5v.py — v3.83 : notifications qui DESCENDENT du haut, couleur = nature de l'action
#   - #toast passe du bas (slideUp) au haut (slide down sous la barre de titre)
#   - 6 tons : succès (vert), modification (bleu), suppression (rouge), avertissement
#     (orange), information (ardoise), erreur (rouge profond) + icône Font Awesome
#   - les appels existants sont reclassés selon ce qu'ils font vraiment
#   - correctif : deux notifications coup sur coup -> l'ancienne minuterie ne coupe plus
#     la nouvelle (avant, le 2e message disparaissait tout de suite)
import io, re, sys, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
orig = s
rapport = []


def rem(nom, ancien, nouveau, n=1):
    global s
    c = s.count(ancien)
    if c != n:
        print('ECHEC %s : %d occurrence(s) au lieu de %d' % (nom, c, n))
        sys.exit(1)
    s = s.replace(ancien, nouveau)
    rapport.append('%s : %d' % (nom, c))


# ---------- 1. CSS ----------
CSS_OLD = """    .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #323232; color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out; max-width: calc(100% - 32px); z-index: 1000; }
    .toast.success { background: var(--success); }
    .toast.error { background: var(--danger); }
    .toast.info { background: var(--primary); }"""
CSS_NEW = """    /* Notification : elle DESCEND du haut, sa couleur dit la NATURE de l'action */
    #toast { position: fixed; top: calc(var(--appbar-h, 56px) + 10px); left: 50%; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 24px); padding: 11px 14px 11px 11px; border-radius: 14px; color: #fff; font-size: 13px; font-weight: 600; line-height: 1.32; text-align: left; background: linear-gradient(135deg, var(--t1, #334155), var(--t2, #64748b)); box-shadow: 0 12px 26px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16); transform: translate(-50%, -220%); opacity: 0; z-index: 1200; pointer-events: none; transition: transform 0.34s cubic-bezier(0.18, 0.89, 0.32, 1.15), opacity 0.26s ease; }
    #toast.affiche { transform: translate(-50%, 0); opacity: 1; }
    #toast.sortie { transform: translate(-50%, -220%); opacity: 0; }
    #toast.hidden { display: none !important; }
    #toast .toast-ic { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 9px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 14px; }
    #toast .toast-txt { flex: 1 1 auto; min-width: 0; }
    #toast.ton-succes { --t1: #047857; --t2: #10b981; }
    #toast.ton-modif { --t1: #1d4ed8; --t2: #3b82f6; }
    #toast.ton-suppr { --t1: #9f1239; --t2: #e11d48; }
    #toast.ton-avert { --t1: #b45309; --t2: #f59e0b; }
    #toast.ton-info { --t1: #334155; --t2: #64748b; }
    #toast.ton-erreur { --t1: #7f1d1d; --t2: #dc2626; }"""
rem('CSS #toast', CSS_OLD, CSS_NEW)

# ---------- 2. la fonction ----------
FN_OLD = """function afficherToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}"""
FN_NEW = """// Nature de l'action -> ton de la notification (couleur + icone)
const TONS_TOAST = {
  success: { ton: 'ton-succes', icone: 'fa-check-circle' },        // ajout, import, envoi reussi
  modif: { ton: 'ton-modif', icone: 'fa-edit' },                   // modification, enregistrement
  suppression: { ton: 'ton-suppr', icone: 'fa-trash' },            // suppression, retrait
  warning: { ton: 'ton-avert', icone: 'fa-exclamation-triangle' }, // avertissement, partiel
  info: { ton: 'ton-info', icone: 'fa-info-circle' },              // information neutre
  error: { ton: 'ton-erreur', icone: 'fa-times-circle' }           // erreur, refus
};
let toastMinuterie = null, toastMinuterieSortie = null;

function afficherToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const t = TONS_TOAST[type] || TONS_TOAST.info;
  toast.className = 'toast ' + t.ton;
  toast.innerHTML = '';
  const ic = document.createElement('span');
  ic.className = 'toast-ic';
  ic.innerHTML = '<i class="fas ' + t.icone + '"></i>';
  const tx = document.createElement('span');
  tx.className = 'toast-txt';
  tx.textContent = message;
  toast.appendChild(ic);
  toast.appendChild(tx);
  // une nouvelle notification remplace la precedente : sa minuterie ne doit pas la couper
  if (toastMinuterie) clearTimeout(toastMinuterie);
  if (toastMinuterieSortie) clearTimeout(toastMinuterieSortie);
  void toast.offsetWidth;                       // force le navigateur a jouer la transition
  toast.classList.add('affiche');
  toastMinuterie = setTimeout(function () {
    toast.classList.remove('affiche');
    toast.classList.add('sortie');
    toastMinuterieSortie = setTimeout(function () { toast.className = 'toast hidden'; }, 340);
  }, 3000);
}"""
rem('afficherToast', FN_OLD, FN_NEW)

# ---------- 3. reclassement des appels : la couleur suit la NATURE de l'action ----------
# suppression (rouge)
for msg in ["'Fermeture supprimée'", "'Absence supprimée'", "'Surveillant supprime'",
            "'Eleve supprimé'", "'Classe supprimée'"]:
    rem('suppression ' + msg, msg + ", 'success'", msg + ", 'suppression'")

# modification / enregistrement (bleu)
for msg in ["'Paramètres enregistrés'", "'Séance annulée'", "'Séance rétablie'",
            "'Absence enregistrée'", "'Mot de passe réinitialisé'", "'Mot de passe défini'",
            "'Mot de passe modifié'", "'Profil enregistré'"]:
    rem('modif ' + msg, msg + ", 'success'", msg + ", 'modif'")

rem('modif eleve sorti/retabli',
    "'Élève marqué sorti (historique conservé)' : 'Élève rétabli', 'success'",
    "'Élève marqué sorti (historique conservé)' : 'Élève rétabli', 'modif'")
rem('modif eleves sortis a l import',
    "aSortir.length + ' élève(s) marqué(s) sorti(s)', 'success'",
    "aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif'", 2)
rem('modif approbation signalement',
    "libelleStatutAbs(abs) + ' · ' + abs.motif, 'success'",
    "libelleStatutAbs(abs) + ' · ' + abs.motif, 'modif'")
rem('modif fusion doublons',
    "(ecartes ? ' · ' + ecartes + ' en double écarté(s)' : ''), 'success'",
    "(ecartes ? ' · ' + ecartes + ' en double écarté(s)' : ''), 'modif'")
rem('modif renommage prof',
    "quoi + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'success'",
    "quoi + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'modif'")

# information neutre (ardoise) : rien n'a change
rem('info aucun doublon', "'Aucun doublon d\\'élève détecté', 'success'",
    "'Aucun doublon d\\'élève détecté', 'info'")
rem('info import eleves sans changement',
    """  if (!aSortir.length) {
    afficherToast(resume, 'success');
    return;
  }""",
    """  if (!aSortir.length) {
    afficherToast(resume, (ajoutes || nouvelles) ? 'success' : 'info');
    return;
  }""")
rem('info import eleves sans changement (fin 1)',
    """      afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
    });
  afficherToast(resume, 'success');""",
    """      afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
    });
  afficherToast(resume, (ajoutes || nouvelles) ? 'success' : 'info');""")
rem('info import MASSAR sans changement',
    """        afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
      });
  }
  afficherToast(resume, 'success');""",
    """        afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
      });
  }
  afficherToast(resume, (ajoutes || nouvelles || corriges || rattaches) ? 'success' : 'info');""")

rem('label version', 'AbsenceTrack v3.82 — Prototype', 'AbsenceTrack v3.83 — Prototype')

io.open(F, 'w', encoding='utf-8').write(s)

sc = re.findall(r'<script>(.*?)</script>', s, re.S)
bloc = max(sc, key=len)
tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check_v5v.js'
io.open(tmp, 'w', encoding='utf-8').write(bloc)
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('node --check :', 'OK' if r.returncode == 0 else r.stderr[:400])
o, n = s.count('<div'), s.count('</div>')
print('divs : %d / %d %s' % (o, n, 'OK' if o == n else 'DESEQUILIBRE'))
print('taille : %d -> %d' % (len(orig), len(s)))
print('reste des anciens tons .toast.success :', s.count('.toast.success'))
for x in rapport:
    print(' -', x)
