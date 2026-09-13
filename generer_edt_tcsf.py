# -*- coding: utf-8 -*-
"""Genere les emplois du temps des classes TCSF-1, TCSF-2, TCSF-3 + les tableaux de service par prof.

Contraintes demandees :
  a. Maths 5h, PC 4h, SVT 4h, Français 4h, Anglais 3h, Arabe 2h, EPS 2h, Informatique 2h,
     Philo 2h, Educ. islamique 2h, Hist-Geo 2h  (32 h / semaine / classe)
  b. maximum 2 h de la meme matiere par jour ; PC et SVT : seances de 2 h minimum
  c. samedi = repos (5 jours : lundi -> vendredi)
  d. un prof ne travaille que le matin OU l'apres-midi dans une meme journee
  e. 8 creneaux/jour : 08-09, 09-10, 10-11, 11-12 / 14-15, 15-16, 16-17, 17-18
  f. un prof ne peut pas etre dans deux classes au meme creneau
Sortie : _edt_classes.json + _edt_profs.json
"""
import io, json, random, sys

CLASSES = ['TCSF-1', 'TCSF-2', 'TCSF-3']
JOURS = [1, 2, 3, 4, 5]
CRENEAUX = ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
            '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00']
MATIN = [0, 1, 2, 3]
APREM = [4, 5, 6, 7]
# matiere : (heures/semaine, forme des seances, nom du prof, code)
MATIERES = {
    'Maths':      (5, [2, 2, 1], 'أيوب الكمرة',      'math-prof1'),
    'PC':         (4, [2, 2],    'غزالي صالح',       'pc-prof1'),
    'SVT':        (4, [2, 2],    'كمال الوردي',      'svt-prof1'),
    'Français':   (4, [2, 2],    'سامية الحاضي',     'fr-prof1'),
    'Anglais':    (3, [2, 1],    'هشام أجامي',       'ang-prof1'),
    'Arabe':      (2, [2],       'المهدي الصلحي',    'ar-prof1'),
    'EPS':        (2, [2],       'يسرى البوسعيدي',   'eps-prof1'),
    'Informatique': (2, [2],     'سكينة الرازي',     'info-prof1'),
    'Philo':      (2, [2],       'زكية المندريلي',   'philo-prof1'),
    'Educ. islamique': (2, [2],  'محمد خليفي',       'ei-prof1'),
    'Hist-Géo':   (2, [2],       'ياسين القامة',     'hg-prof1'),
}
DEBUTS_2H = [0, 1, 2, 4, 5, 6]     # debuts possibles d'une seance de 2 h (paire dans la demi-journee)

def seances_de(matiere):
    return [(matiere, d) for d in MATIERES[matiere][1]]

def creneau(jour, i):
    return (jour, i)

def demi(i):
    return 0 if i in MATIN else 1

def resoudre(essais=4000):
    base = []
    for cl in CLASSES:
        for mat in MATIERES:
            for (m, d) in seances_de(mat):
                base.append([cl, mat, d])
    for essai in range(essais):
        random.seed(1000 + essai)
        seances = [s[:] for s in base]
        random.shuffle(seances)
        # occupation : classe -> set de (jour, slot) ; prof -> set de (jour, slot) ; prof par jour -> demi
        occ_classe = {cl: set() for cl in CLASSES}
        occ_prof = {mat: set() for mat in MATIERES}
        demi_prof = {}          # (mat, jour) -> 0/1
        matiere_jour = {cl: {} for cl in CLASSES}   # classe -> jour -> {matiere: heures}
        place = []
        ok = True
        for (cl, mat, duree) in seances:
            options = []
            for jour in JOURS:
                if matiere_jour[cl].get(jour, {}).get(mat, 0) + duree > 2:
                    continue
                for i in (DEBUTS_2H if duree == 2 else range(8)):
                    slots = [i] if duree == 1 else [i, i + 1]
                    if any(s not in range(8) for s in slots):
                        continue
                    if demi(i) != demi(slots[-1]):
                        continue
                    if any((jour, s) in occ_classe[cl] for s in slots):
                        continue
                    if any((jour, s) in occ_prof[mat] for s in slots):
                        continue
                    if (mat, jour) in demi_prof and demi_prof[(mat, jour)] != demi(i):
                        continue
                    options.append((jour, i))
            if not options:
                ok = False
                break
            # equilibrage : on privilegie les journees les moins chargees (classe puis prof)
            charge = {}
            for (j, i2) in options:
                duree_cl = sum(c['duree'] for c in place if c['classe'] == cl and c['jour'] == j)
                duree_pr = sum(c['duree'] for c in place if c['matiere'] == mat and c['jour'] == j)
                charge[(j, i2)] = duree_cl * 2 + duree_pr + random.random() * 1.5
            options.sort(key=lambda o: charge[o])
            jour, i = options[0] if random.random() < 0.8 else random.choice(options)
            slots = [i] if duree == 1 else [i, i + 1]
            for s in slots:
                occ_classe[cl].add((jour, s))
                occ_prof[mat].add((jour, s))
            demi_prof[(mat, jour)] = demi(i)
            matiere_jour[cl].setdefault(jour, {})
            matiere_jour[cl][jour][mat] = matiere_jour[cl].get(jour, {}).get(mat, 0) + duree
            place.append({'classe': cl, 'matiere': mat, 'jour': jour, 'debut': i, 'duree': duree})
        if ok:
            return place, essai
    return None, essais

def verifier(place):
    err = []
    # heures par matiere et par classe
    for cl in CLASSES:
        for mat, (h, forme, prof, code) in MATIERES.items():
            total = sum(s['duree'] for s in place if s['classe'] == cl and s['matiere'] == mat)
            if total != h:
                err.append('%s / %s : %s h au lieu de %s' % (cl, mat, total, h))
    # max 2 h de la meme matiere par jour et par classe
    for cl in CLASSES:
        for jour in JOURS:
            par_mat = {}
            for s in place:
                if s['classe'] == cl and s['jour'] == jour:
                    par_mat[s['matiere']] = par_mat.get(s['matiere'], 0) + s['duree']
            for mat, h in par_mat.items():
                if h > 2:
                    err.append('%s %s jour %d : %s h de %s' % (cl, JOURS, jour, h, mat))
    # PC / SVT : seances de 2 h minimum
    for s in place:
        if s['matiere'] in ('PC', 'SVT') and s['duree'] < 2:
            err.append('%s : seance de %s h en %s (2 h minimum)' % (s['classe'], s['duree'], s['matiere']))
    # pas de chevauchement par classe ni par prof + demi-journee unique par prof et par jour
    for cl in CLASSES:
        vus = set()
        for s in place:
            if s['classe'] != cl:
                continue
            for k in range(s['duree']):
                cle = (s['jour'], s['debut'] + k)
                if cle in vus:
                    err.append('%s : chevauchement %s' % (cl, cle))
                vus.add(cle)
    for mat in MATIERES:
        vus = set()
        demi_par_jour = {}
        for s in place:
            if s['matiere'] != mat:
                continue
            for k in range(s['duree']):
                cle = (s['jour'], s['debut'] + k)
                if cle in vus:
                    err.append('%s : prof en double au creneau %s' % (mat, cle))
                vus.add(cle)
            d = demi(s['debut'])
            if s['jour'] in demi_par_jour and demi_par_jour[s['jour']] != d:
                err.append('%s : matin + apres-midi le jour %s' % (mat, s['jour']))
            demi_par_jour[s['jour']] = d
    # samedi vide
    if any(s['jour'] == 6 for s in place):
        err.append('samedi non vide')
    # service <= 20 h par prof
    for mat in MATIERES:
        h = sum(s['duree'] for s in place if s['matiere'] == mat)
        if h > 20:
            err.append('%s : %s h de service (> 20 h)' % (mat, h))
    return err

place, essai = resoudre()
if not place:
    print('AUCUNE SOLUTION trouvee'); sys.exit(1)
err = verifier(place)
print('solution trouvee a l essai', essai + 1, '| erreurs :', len(err))
for e in err[:10]:
    print('   -', e)
if err:
    sys.exit(1)

# ---- sorties ----
edt = {cl: {str(j): [] for j in JOURS} for cl in CLASSES}
for s in sorted(place, key=lambda x: (x['classe'], x['jour'], x['debut'])):
    prof, code = MATIERES[s['matiere']][2], MATIERES[s['matiere']][3]
    for k in range(s['duree']):
        pass
    edt[s['classe']][str(s['jour'])].append({
        'debut': s['debut'], 'fin': s['debut'] + s['duree'] - 1,
        'horaire': CRENEAUX[s['debut']].split('-')[0] + '-' + CRENEAUX[s['debut'] + s['duree'] - 1].split('-')[1],
        'matiere': s['matiere'], 'prof': prof, 'code': code, 'duree': s['duree']})

profs = {}
for mat, (h, forme, prof, code) in MATIERES.items():
    liste = []
    for s in place:
        if s['matiere'] != mat:
            continue
        liste.append({'jour': s['jour'], 'debut': CRENEAUX[s['debut']].split('-')[0],
                      'fin': CRENEAUX[s['debut'] + s['duree'] - 1].split('-')[1],
                      'classe': s['classe'], 'matiere': mat, 'code': code})
    liste.sort(key=lambda c: (c['jour'], c['debut']))
    profs[code] = {'matiere': mat, 'prof': prof, 'heures': sum(s['duree'] for s in place if s['matiere'] == mat), 'creneaux': liste}

io.open('_edt_classes.json', 'w', encoding='utf-8').write(json.dumps(edt, ensure_ascii=False, indent=1))
io.open('_edt_profs.json', 'w', encoding='utf-8').write(json.dumps(profs, ensure_ascii=False, indent=1))

print('\n=== heures par classe ===')
for cl in CLASSES:
    tot = sum(sum(c['duree'] for c in edt[cl][str(j)]) for j in JOURS)
    print('%-8s %s h | par jour : %s' % (cl, tot, [sum(c['duree'] for c in edt[cl][str(j)]) for j in JOURS]))
print('\n=== service des profs ===')
for code, p in profs.items():
    print('%-11s %-16s %-18s %s h' % (code, p['prof'], p['matiere'], p['heures']))
print('\n=== emploi du temps TCSF-1 (apercu) ===')
for j in JOURS:
    print('jour', j, ':', ' | '.join('%s %s' % (c['horaire'], c['matiere']) for c in edt['TCSF-1'][str(j)]))
