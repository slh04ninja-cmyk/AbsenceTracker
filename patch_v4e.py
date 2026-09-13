# -*- coding: utf-8 -*-
"""AbsenceTrack v3.43 : la ligne « Approuve le <datetime> » + code S{x}/D est TOUJOURS presente
pour un Ab/Rd regle, y compris pour les anciens enregistrements qui n'ont pas de justifieLe
(dans ce cas la datetime de l'absence sert de repli, et '—' si vraiment rien).
Concerne la liste des Ab/Rd de la fiche eleve, donc les popups ouverts depuis l'Historique
ET depuis le div « Eleves les plus signales » de la page Stats (meme fiche).
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

ANCIEN = """      const ligneApprobation = (code && a.justifieLe)
        ? '<div class="flex justify-between items-center mt-1"><span class="text-xs text-gray-500">Approuvé le ' + dateHeureApprobation(a.justifieLe) + '</span><span style="' + styleMarque + '; font-size: 12px;">' + code + '</span></div>'
        : '';"""
NOUVEAU = """      // Un Ab/Rd regle a toujours sa ligne d'approbation ; si l'enregistrement est ancien
      // (pas de justifieLe), on retombe sur la datetime de l'absence, puis sur '—'.
      const quandApprobation = a.justifieLe || (a.dateISO ? (String(a.dateISO) + (a.heure ? ' ' + a.heure : '')) : '');
      const ligneApprobation = code
        ? '<div class="flex justify-between items-center mt-1"><span class="text-xs text-gray-500">Approuvé le ' + (quandApprobation ? dateHeureApprobation(quandApprobation) : '—') + '</span><span style="' + styleMarque + '; font-size: 12px;">' + code + '</span></div>'
        : '';"""
c = s.count(ANCIEN)
print(('OK   ' if c == 1 else 'ECHEC') + ' %-44s =%d' % ('ligne d approbation toujours affichee', c))
allok &= (c == 1)
if c == 1:
    s = s.replace(ANCIEN, NOUVEAU)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.42', 'AbsenceTrack v3.43', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.43 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

for cle, attendu in [('const quandApprobation =', 1), ('const ligneApprobation = code', 1),
                     ('a.justifieLe ||', 1), ('Approuvé le ', 1), ('id="page-profil"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-34s = %d' % (cle, n))
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
