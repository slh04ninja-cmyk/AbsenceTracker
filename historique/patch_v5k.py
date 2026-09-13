# -*- coding: utf-8 -*-
"""patch_v5k.py -> v3.73
Vue Liste (RH) des surveillants et des enseignants : meme affichage que les listes
d'absences (fond teinte + bordure + 4 cartes avant defilement, cartes blanches bordees).

- les 2 conteneurs passent de .liste-reglages a .js-personnel (liste partagee)
- .js-personnel rejoint toutes les regles CSS des listes de cartes
- les anciennes regles .liste-reglages / max-height 286px sont supprimees (code mort)
- carteCompte() reutilise le renderer partage carteLigne() (titre + sous-titre 13/11.5px)
  -> plus de markup duplique, rendu identique aux absences
- label v3.73
"""
import io, re, sys, shutil

F = 'AbsenceTrack-v2.html'
html = io.open(F, encoding='utf-8').read()
orig = html
ok = True

def sub_once(pattern, repl, label, count=1, flags=0):
    global html, ok
    n = len(re.findall(pattern, html, flags))
    if n != count:
        print('!! %s : %d occurrence(s) (attendu %d)' % (label, n, count)); ok = False; return
    html = re.sub(pattern, repl, html, count=count, flags=flags)
    print('OK %s : %d' % (label, n))

# ---------- 1. les 2 listes deviennent .js-personnel ----------
sub_once(r'<div id="dir-surveillants-list" class="liste-reglages"></div>',
         '<div id="dir-surveillants-list" class="js-personnel"></div>',
         'conteneur surveillants -> js-personnel')
sub_once(r'<div id="dir-profs-list" class="liste-reglages"></div>',
         '<div id="dir-profs-list" class="js-personnel"></div>',
         'conteneur enseignants -> js-personnel')

# ---------- 2. CSS de base : suppression de la regle 286px, ajout de .js-personnel ----------
old = """    /* Liste des annulations (carte Fermeture de l'etablissement) : zone a defilement */
    /* 6 cartes visibles avant defilement (6 x (44 + 4) = 288 -> 286 pour couper juste apres la 6e) */
    #dir-profs-list, #dir-surveillants-list { max-height: 286px; }
    /* Listes de cartes facon \"Seances annulees\" : 4 cartes visibles avant defilement */
    .js-seances-annulees, .js-absences-personnel, .js-fermetures, .js-annulations {"""
new = """    /* Listes de cartes (seances annulees, absences, fermetures, annulations, personnel) : meme rendu */
    /* 4 cartes visibles avant defilement */
    .js-seances-annulees, .js-absences-personnel, .js-fermetures, .js-annulations, .js-personnel {"""
sub_once(re.escape(old), lambda m: new, 'CSS : regle 286px remplacee par la liste partagee')

sub_once(re.escape('body.theme-sombre .js-seances-annulees, body.theme-sombre .js-absences-personnel, body.theme-sombre .js-fermetures, body.theme-sombre .js-annulations { background: #0f172a; border-color: #334155; }'),
         lambda m: 'body.theme-sombre .js-seances-annulees, body.theme-sombre .js-absences-personnel, body.theme-sombre .js-fermetures, body.theme-sombre .js-annulations, body.theme-sombre .js-personnel { background: #0f172a; border-color: #334155; }',
         'CSS sombre : js-personnel')

sub_once(re.escape('.js-seances-annulees > div, .js-absences-personnel > div, .js-fermetures > div, .js-annulations > div {'),
         lambda m: '.js-seances-annulees > div, .js-absences-personnel > div, .js-fermetures > div, .js-annulations > div, .js-personnel > div {',
         'CSS : cartes 44px pour js-personnel')

sub_once(re.escape('.js-seances-annulees > div:last-child, .js-absences-personnel > div:last-child { margin-bottom: 0; }'),
         lambda m: '.js-seances-annulees > div:last-child, .js-absences-personnel > div:last-child, .js-personnel > div:last-child { margin-bottom: 0; }',
         'CSS : derniere carte js-personnel')

# ---------- 3. CSS : plus de hauteur specifique aux listes de reglages (code mort) ----------
old2 = """    .carte-settings .liste-reglages { max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
    .carte-settings .liste-reglages > div { padding: 6px 10px; margin-bottom: 4px; }
    .carte-settings .liste-reglages > div:last-child { margin-bottom: 0; }
"""
sub_once(re.escape(old2), lambda m: '', 'CSS : regles .liste-reglages supprimees')

# ---------- 4. CSS theme clair : js-personnel rejoint le rendu commun ----------
sub_once(re.escape('body.role-surveillant:not(.theme-sombre) .js-annulations, body.role-directeur:not(.theme-sombre) .js-annulations {\n      background: var(--lot-clair);'),
         lambda m: 'body.role-surveillant:not(.theme-sombre) .js-annulations, body.role-directeur:not(.theme-sombre) .js-annulations,\n    body.role-enseignant:not(.theme-sombre) .js-personnel, body.role-surveillant:not(.theme-sombre) .js-personnel,\n    body.role-directeur:not(.theme-sombre) .js-personnel {\n      background: var(--lot-clair);',
         'CSS clair : fond des listes js-personnel')

sub_once(re.escape('body.role-surveillant:not(.theme-sombre) .js-annulations > div, body.role-directeur:not(.theme-sombre) .js-annulations > div {\n      background: #FFFFFF;'),
         lambda m: 'body.role-surveillant:not(.theme-sombre) .js-annulations > div, body.role-directeur:not(.theme-sombre) .js-annulations > div,\n    body.role-enseignant:not(.theme-sombre) .js-personnel > div, body.role-surveillant:not(.theme-sombre) .js-personnel > div,\n    body.role-directeur:not(.theme-sombre) .js-personnel > div {\n      background: #FFFFFF;',
         'CSS clair : cartes blanches js-personnel')

# ---------- 5. JS : carteCompte reutilise le renderer partage ----------
old3 = """function carteCompte(c) {
  const item = document.createElement('div');
  item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
  item.style = 'height: 44px; box-sizing: border-box; padding: 0 10px; gap: 8px;';
  const sousTitre = (c.matiere ? c.matiere + ' · ' : '') + (c.email || '');
  item.innerHTML = '<div style="min-width: 0; overflow: hidden;">' +
    '<p class="font-medium text-gray-700" style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (c.nom || '') + '</p>' +
    '<p class="text-xs text-gray-500" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + sousTitre + '</p></div>';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-inline flex-shrink-0';
  b.style = 'color: #1d4ed8;';
  b.innerHTML = '<i class="fas fa-pen mr-1"></i>Modifier';
  b.onclick = () => ouvrirRenommageProf(c.code || c.email);
  item.appendChild(b);
  return item;
}"""
new3 = """function carteCompte(c) {
  // Meme rendu que les listes d'absences / fermetures / annulations :
  // on reutilise le renderer partage (titre 13px + sous-titre 11.5px, hauteur 44px, carte blanche bordee).
  const sousTitre = (c.matiere ? c.matiere + ' · ' : '') + (c.email || '');
  return carteLigne(c.nom || '', sousTitre, {
    icone: '<i class="fas fa-pen mr-1"></i>Modifier',
    couleur: 'var(--primary)',
    onclick: () => ouvrirRenommageProf(c.code || c.email)
  });
}"""
sub_once(re.escape(old3), lambda m: new3, 'JS : carteCompte via carteLigne')

# ---------- 6. label de version ----------
sub_once(r'AbsenceTrack v3\.72', lambda m: 'AbsenceTrack v3.73', 'label v3.73')

if not ok:
    print('=== PATCH ANNULE (comptages non conformes) ==='); sys.exit(1)

shutil.copyfile(F, 'AbsenceTrack-v3.72-backup.html')
io.open(F, 'w', encoding='utf-8').write(html)
print('ecrit %s (%d octets)  backup AbsenceTrack-v3.72-backup.html' % (F, len(html.encode('utf-8'))))
