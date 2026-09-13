# -*- coding: utf-8 -*-
# patch_v5u.py — v3.82 : deux finitions autour de l'identite de l'eleve
#   1. cleNomEleve() s'appuie sur le libelle affiche (comparable au champ "nom" des
#      signalements) -> permet de retrouver l'historique d'un eleve reimporte
#   2. a l'import, les signalements ORPHELINS (eleve supprime puis remis dans le
#      fichier) sont rattaches a sa nouvelle fiche au lieu de rester accroches a un
#      identifiant disparu
import io, re, sys, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
rapport = []


def rem(nom, ancien, nouveau, n=1):
    global s
    c = s.count(ancien)
    if c != n:
        print('ECHEC %s : %d occurrence(s) au lieu de %d' % (nom, c, n))
        sys.exit(1)
    s = s.replace(ancien, nouveau)
    rapport.append('%s : %d remplacement(s)' % (nom, c))


CLE_OLD = r'''function cleNomEleve(e) {
  const base = libelleEleve(e) + ' ' + (e.nomFr || '') + ' ' + (e.nomArabe || '');
  let txt = base.toLowerCase();
  if (txt.normalize) txt = txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return txt.replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
}'''
CLE_NEW = r'''function cleNomEleve(e) {
  let txt = libelleEleve(e) || e.nomFr || e.nomArabe || '';
  txt = String(txt).toLowerCase();
  if (txt.normalize) txt = txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return txt.replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
}'''
rem('cleNomEleve', CLE_OLD, CLE_NEW)

rem('compteur rattaches',
    "  let nouvelles = 0, ajoutes = 0, dejaLa = 0, corriges = 0;",
    "  let nouvelles = 0, ajoutes = 0, dejaLa = 0, corriges = 0, rattaches = 0;")

PUSH_OLD = """      const nouveau = { id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomFr || e.nomArabe || '', prenom: e.prenom || '', actif: true };
      existante.eleves.push(nouveau);"""
PUSH_NEW = """      const nouveau = { id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomFr || e.nomArabe || '', prenom: e.prenom || '', actif: true };
      // Signalements orphelins (eleve supprime puis remis dans le fichier) : on les
      // rattache a sa nouvelle fiche au lieu de les laisser accroches a un id disparu.
      const knNouveau = cleNomEleve(nouveau) || cleNomEleve({ nom: e.nom || '', prenom: '', nomFr: '', nomArabe: '' });
      if (knNouveau) {
        absences.forEach(a => {
          if (a.classe !== existante.nom) return;
          if (!a.eleveId || existante.eleves.some(x => x.id === a.eleveId)) return;
          if (cleNomEleve({ nom: a.nom, prenom: '', nomFr: '', nomArabe: '' }) !== knNouveau) return;
          a.eleveId = nouveau.id;
          rattaches++;
        });
      }
      existante.eleves.push(nouveau);"""
rem('rattachement des orphelins', PUSH_OLD, PUSH_NEW)

rem('sauvegarde des absences apres rattachement',
    """  sauvegarderClasses();
  const total = importData.classes.reduce((s, c) => s + c.eleves.length, 0);""",
    """  sauvegarderClasses();
  if (rattaches) localStorage.setItem('absences', JSON.stringify(absences));
  const total = importData.classes.reduce((s, c) => s + c.eleves.length, 0);""")

rem('resume avec rattachements',
    """  const resume = nouvelles + ' classe(s) importée(s) · ' + ajoutes + ' élève(s) ajouté(s)' +
    (dejaLa ? ' · ' + dejaLa + ' déjà présent(s)' : '') +
    (corriges ? ' · ' + corriges + ' nom(s) corrigé(s)' : '') + ' — ' + total + ' au total';""",
    """  const resume = nouvelles + ' classe(s) importée(s) · ' + ajoutes + ' élève(s) ajouté(s)' +
    (dejaLa ? ' · ' + dejaLa + ' déjà présent(s)' : '') +
    (corriges ? ' · ' + corriges + ' nom(s) corrigé(s)' : '') +
    (rattaches ? ' · ' + rattaches + ' signalement(s) rattaché(s)' : '') + ' — ' + total + ' au total';""")

rem('label version', 'AbsenceTrack v3.81 — Prototype', 'AbsenceTrack v3.82 — Prototype')

io.open(F, 'w', encoding='utf-8').write(s)

sc = re.findall(r'<script>(.*?)</script>', s, re.S)
bloc = max(sc, key=len)
tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check_v5u.js'
io.open(tmp, 'w', encoding='utf-8').write(bloc)
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('node --check :', 'OK' if r.returncode == 0 else r.stderr[:400])
o, n = s.count('<div'), s.count('</div>')
print('divs : %d / %d %s' % (o, n, 'OK' if o == n else 'DESEQUILIBRE'))
print('taille : %d' % len(s))
for x in rapport:
    print(' -', x)
