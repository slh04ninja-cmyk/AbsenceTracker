# -*- coding: utf-8 -*-
"""_rapport.py — lit la sortie brute de verif_schema.sql et rend un verdict clair.
Usage : python supabase/_rapport.py <fichier_de_sortie>   (ou sans argument : lit l'entree standard)
"""
import io, re, sys

# les cas qui DOIVENT être refusés par la base (le reste doit passer)
ATTENDUS_ECHEC = {'1b', '1d', '1g', '1i', '1j', '1l', '1n', '1o', '1r',
                  '2e', '2h', '2l', '2n', '2p', '2q'}

chemin = sys.argv[1] if len(sys.argv) > 1 else None
texte = io.open(chemin, encoding='utf-8').read() if chemin else sys.stdin.read()
lignes = texte.split('\n')

idx = [i for i, l in enumerate(lignes) if re.match(r'--- \d+[a-z]\.', l)]
inattendus, refuses, acceptes = [], 0, 0

print('%-5s %-9s %-74s %s' % ('cas', 'verdict', 'vérification', 'réaction de la base'))
print('-' * 128)
for k, i in enumerate(idx):
    fin = idx[k + 1] if k + 1 < len(idx) else len(lignes)
    err = [l for l in lignes[i:fin] if 'ERROR:' in l]
    n, lib = re.match(r'--- (\d+[a-z])\.(.+)', lignes[i]).groups()
    attendu = n in ATTENDUS_ECHEC
    if bool(err) == attendu:
        verdict = 'ok'
    else:
        verdict = 'INATTENDU'
        inattendus.append(n)
    if err:
        refuses += 1
        detail = err[0].split('ERROR:  ')[1].strip()[:58]
    else:
        acceptes += 1
        detail = 'accepté'
    print('%-5s %-9s %-74s %s' % (n, verdict, lib.strip()[:74], detail))

print()
print('%d vérifications · %d acceptées · %d refusées (voulues) · %d inattendue(s)'
      % (len(idx), acceptes, refuses, len(inattendus)))
if inattendus:
    print('ATTENTION — cas inattendus : %s' % ', '.join(inattendus))
    sys.exit(1)
print('RESULTAT : le schéma garantit bien ce qu\'il annonce.')
