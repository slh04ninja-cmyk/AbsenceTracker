# -*- coding: utf-8 -*-
"""AbsenceTrack v3.47 : import des tableaux xlsx dans la page Gestion (directeur).

1. Tableaux de service des professeurs (.xlsx) : grille jours x creneaux + liste matiere/prof
   -> conversion en tableauxService par professeur (via l'email du compte si la matiere correspond,
   sinon sous le nom du professeur), controle du service <= 20 h, apercu avant validation.
2. Tableaux des eleves (.xlsx) : feuille par classe ou colonne « classe » -> classes + eleves,
   dedoublonnes par code MASSAR (aucune donnee existante supprimee).
3. tableauxService devient persistant (localStorage) avec les donnees de demo comme valeur par defaut.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-46s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ================= 1. tableauxService persistant =================
allok &= remplace('tableauxService persistant',
                  "const tableauxService = {",
                  "const TABLEAUX_SERVICE_DEFAUT = {")
allok &= remplace('fin des donnees par defaut',
                  "};\n\nconst NOMS_JOURS = {",
                  """};

// Tableaux de service : persistants (import xlsx) avec les donnees de demo comme defaut
function chargerTableauxService() {
  try {
    const sauve = JSON.parse(localStorage.getItem('tableauxService') || 'null');
    if (sauve && typeof sauve === 'object' && !Array.isArray(sauve)) return sauve;
  } catch (e) {}
  return JSON.parse(JSON.stringify(TABLEAUX_SERVICE_DEFAUT));
}
function sauvegarderTableauxService() {
  localStorage.setItem('tableauxService', JSON.stringify(tableauxService));
}

const NOMS_JOURS = {""")
allok &= remplace('variable let tableauxService',
                  "const NOMS_JOURS = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 7: 'dimanche' };",
                  "const NOMS_JOURS = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 7: 'dimanche' };\nlet tableauxService = chargerTableauxService();")

# ================= 2. resolution email / nom / matiere =================
allok &= remplace('resolution des creneaux par utilisateur',
                  """function creneauxDuJour(email, jour) {
  const liste = tableauxService[email] || [];""",
                  """// Rapprochement des matieres (arabe / francais / abreviations)
function normaliserMatiere(m) {
  const t = String(m || '').toLowerCase();
  if (t.indexOf('رياض') >= 0 || t.indexOf('math') >= 0) return 'math';
  if (t.indexOf('عربية') >= 0 || t.indexOf('arabe') >= 0) return 'ar';
  if (t.indexOf('فرنس') >= 0 || t.indexOf('fran') >= 0) return 'fr';
  if (t.indexOf('انجليز') >= 0 || t.indexOf('anglais') >= 0 || t.indexOf('angl') >= 0) return 'en';
  if (t.indexOf('فيزي') >= 0 || t.indexOf('physique') >= 0 || t.indexOf('chimie') >= 0) return 'pc';
  if (t.indexOf('حياة') >= 0 || t.indexOf('svt') >= 0 || t.indexOf('science') >= 0) return 'svt';
  if (t.indexOf('فلسف') >= 0 || t.indexOf('philo') >= 0) return 'philo';
  if (t.indexOf('تاريخ') >= 0 || t.indexOf('جغراف') >= 0 || t.indexOf('histoire') >= 0) return 'hg';
  if (t.indexOf('اسلام') >= 0 || t.indexOf('إسلام') >= 0 || t.indexOf('islam') >= 0) return 'ei';
  if (t.indexOf('بدنية') >= 0 || t.indexOf('sport') >= 0 || t.indexOf('eps') >= 0) return 'eps';
  if (t.indexOf('معلوم') >= 0 || t.indexOf('inform') >= 0) return 'info';
  return t.slice(0, 14);
}
// Email du compte enseignant dont la matiere correspond (pour relier un tableau importe)
function emailPourMatiere(m) {
  const cle = normaliserMatiere(m);
  const c = comptes.find(x => x.role === 'enseignant' && normaliserMatiere(x.matiere) === cle);
  return c ? c.email : '';
}
// Creneaux d'un utilisateur : par email, sinon par son nom, sinon par sa matiere
function creneauxUtilisateur(email) {
  if (tableauxService[email]) return tableauxService[email];
  const c = comptes.find(x => x.email === email);
  if (c) {
    if (tableauxService[c.nom]) return tableauxService[c.nom];
    const em = emailPourMatiere(c.matiere);
    if (em && tableauxService[em]) return tableauxService[em];
  }
  return [];
}

function creneauxDuJour(email, jour) {
  const liste = creneauxUtilisateur(email);""")
allok &= remplace('heuresServiceMinutes via creneauxUtilisateur',
                  "  return (tableauxService[email] || []).reduce((som, c) => som + (hhmmEnMinutes(c.fin) - hhmmEnMinutes(c.debut)), 0);",
                  "  return creneauxUtilisateur(email).reduce((som, c) => som + (hhmmEnMinutes(c.fin) - hhmmEnMinutes(c.debut)), 0);")
allok &= remplace('appliquerTableauService via creneauxUtilisateur',
                  "  const aTableau = estProf && (tableauxService[emailUtilisateur()] || []).length > 0;",
                  "  const aTableau = estProf && creneauxUtilisateur(emailUtilisateur()).length > 0;")

if not allok:
    print('PATCH ANNULE (etape 1)')
    sys.exit(1)

# ================= 3. lecteurs xlsx =================
LECTEURS = r"""
// ========== IMPORT DES TABLEAUX XLSX (page Gestion) ==========
const JOURS_TABLEAU = {
  'الإثنين': 1, 'الاثنين': 1, 'lundi': 1,
  'الثلاثاء': 2, 'mardi': 2,
  'الأربعاء': 3, 'الاربعاء': 3, 'mercredi': 3,
  'الخميس': 4, 'jeudi': 4,
  'الجمعة': 5, 'vendredi': 5,
  'السبت': 6, 'samedi': 6
};

function numeroJour(txt) {
  const t = String(txt || '').trim();
  for (const cle in JOURS_TABLEAU) { if (t.indexOf(cle) >= 0) return JOURS_TABLEAU[cle]; }
  return 0;
}
function hhmmDepuisTexte(txt) {
  const m = String(txt || '').match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!m) return -1;
  return (parseInt(m[1], 10) || 0) * 60 + (parseInt(m[2] || '0', 10) || 0);
}
function texteCellule(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\r/g, '').trim();
}
function premiereLigne(v) {
  return texteCellule(v).split('\n')[0].trim();
}
// feuille -> { entetes: [minutes...], lignes: [[...]], fusions: [...] }
function aoaFeuille(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: false });
  const fusions = (ws['!merges'] || []).map(m => ({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c }));
  return { aoa: aoa, fusions: fusions };
}
// Detecte la ligne d'en-tete horaire : >= 3 cellules du type 08:30-09:30
function ligneEntetesHoraires(aoa) {
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    const ligne = aoa[r] || [];
    let nb = 0;
    ligne.forEach(c => { if (/\d{1,2}\s*[:hH]?\s*\d{0,2}\s*[–\-—]\s*\d{1,2}\s*[:hH]/.test(texteCellule(c))) nb++; });
    if (nb >= 3) return r;
  }
  return -1;
}
// feuille -> { classe, creneaux:[{jour,debut,fin,matiere,salle}], profs:{matiere:nom}, erreurs:[] }
function analyserTableauServiceFeuille(ws, nomFeuille) {
  const res = { classe: '', creneaux: [], profs: {}, erreurs: [] };
  if (!ws || typeof XLSX === 'undefined') { res.erreurs.push('lecteur xlsx indisponible'); return res; }
  const { aoa, fusions } = aoaFeuille(ws);

  // classe : cellule contenant 'القسم' ou 'classe'
  for (let r = 0; r < Math.min(aoa.length, 12) && !res.classe; r++) {
    const ligne = aoa[r] || [];
    for (let c = 0; c < ligne.length; c++) {
      const t = texteCellule(ligne[c]);
      if (/القسم|classe\s*:/i.test(t)) {
        const suite = t.split(/[:\u061A]/)[1];
        if (suite && suite.trim()) { res.classe = suite.replace(/^[\s\-–]+/, '').trim(); break; }
        const voisin = texteCellule(ligne[c + 1]) || texteCellule(ligne[c - 1]);
        if (voisin) { res.classe = voisin; break; }
      }
    }
  }
  if (!res.classe && /^[A-Z0-9\-]{3,}$/i.test(String(nomFeuille || '').trim())) res.classe = String(nomFeuille).trim();

  // grille
  const ligneEntete = ligneEntetesHoraires(aoa);
  if (ligneEntete < 0) { res.erreurs.push('grille horaire introuvable (aucune ligne 08:30-09:30)'); return res; }
  const entetes = aoa[ligneEntete] || [];
  const bornes = {};   // index de colonne -> {debut, fin}
  entetes.forEach((c, i) => {
    const t = texteCellule(c);
    const m = t.match(/(\d{1,2}\s*[:hH]?\s*\d{0,2})\s*[–\-—]\s*(\d{1,2}\s*[:hH]\s*\d{2})/);
    if (!m) return;
    const debut = hhmmDepuisTexte(m[1]);
    const fin = hhmmDepuisTexte(m[2]);
    if (debut >= 0 && fin > debut) bornes[i] = { debut: debut, fin: fin };
  });

  const colonnesHeure = Object.keys(bornes).map(k => parseInt(k, 10)).sort((a, b) => a - b);
  const dureeSuite = (r, c, cMax) => {   // seances de 2 h : detectees par les cellules fusionnees
    let fin = c;
    fusions.forEach(f => { if (f.r1 <= r && f.r2 >= r && f.c1 === c && f.c2 > fin) fin = f.c2; });
    return fin;
  };
  for (let r = ligneEntete + 1; r < aoa.length; r++) {
    const laLigne = aoa[r] || [];
    let jour = 0, colJour = -1;
    for (let c = 0; c < laLigne.length && !jour; c++) { jour = numeroJour(laLigne[c]); if (jour) colJour = c; }
    if (!jour) {
      // fin de la grille ? on continue, le bloc profs est analyse plus bas
      continue;
    }
    colonnesHeure.forEach(c => {
      if (c === colJour) return;
      const brut = texteCellule(laLigne[c]);
      if (!brut) return;
      if (estFusionne(r, c, fusions) && fusionNonDebut(r, c, fusions)) return;
      const finCol = dureeSuite(r, c, Math.max.apply(null, colonnesHeure));
      const debut = (bornes[c] || {}).debut;
      const finMin = (bornes[finCol] || bornes[c] || {}).fin;
      if (debut === undefined || finMin === undefined) return;
      const lignes = brut.split('\n');
      res.creneaux.push({
        jour: jour,
        debut: minutesVersHHMM(debut),
        fin: minutesVersHHMM(finMin),
        matiere: premiereLigne(lignes[0]),
        salle: lignes.length > 1 ? texteCellule(lignes.slice(1).join(' ')) : ''
      });
    });
  }

  // bloc « liste des professeurs » : après une ligne contenant الأساتذة ou (المادة + الأستاذ)
  let debutProfs = -1;
  for (let r = 0; r < aoa.length; r++) {
    const t = (aoa[r] || []).map(texteCellule).join(' | ');
    if (t.indexOf('الأساتذة') >= 0 || (t.indexOf('المادة') >= 0 && t.indexOf('الأستاذ') >= 0)) { debutProfs = r + 1; break; }
  }
  if (debutProfs > 0) {
    for (let r = debutProfs; r < aoa.length; r++) {
      const laLigne = (aoa[r] || []).map(texteCellule);
      for (let c = 0; c + 1 < laLigne.length; c++) {
        const mat = laLigne[c], prof = laLigne[c + 1];
        if (mat && prof && mat.length > 1 && prof.length > 1 && !numeroJour(mat)) res.profs[mat] = prof;
      }
    }
  }
  if (!res.creneaux.length) res.erreurs.push('aucune seance lue dans la grille');
  if (!Object.keys(res.profs).length) res.erreurs.push('liste des professeurs introuvable (matiere -> professeur)');
  return res;
}
function estFusionne(r, c, fusions) {
  return fusions.some(f => r >= f.r1 && r <= f.r2 && c >= f.c1 && c <= f.c2);
}
function fusionNonDebut(r, c, fusions) {
  return fusions.some(f => r >= f.r1 && r <= f.r2 && c > f.c1 && c <= f.c2);
}
function minutesVersHHMM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
// Tables [{classe, creneaux, profs}] -> { cle: [creneaux...] } (cle = email du compte ou nom du prof)
function repartirParProfesseur(tables) {
  const sortie = {};
  tables.forEach(t => {
    t.creneaux.forEach(c => {
      const nomProf = t.profs[c.matiere] || '';
      const cle = (nomProf && emailPourMatiere(t.profs[c.matiere])) || nomProf || ('matiere:' + c.matiere);
      if (!sortie[cle]) sortie[cle] = [];
      sortie[cle].push({ jour: c.jour, debut: c.debut, fin: c.fin, classe: t.classe, salle: c.salle || '', matiere: c.matiere });
    });
  });
  return sortie;
}
function heuresCreneaux(liste) {
  return liste.reduce((som, c) => som + (hhmmEnMinutes(c.fin) - hhmmEnMinutes(c.debut)), 0);
}

// ---- import des tableaux de service (multi-fichiers) ----
function importerTableauxService(input) {
  const fichiers = Array.prototype.slice.call(input.files || []);
  input.value = '';
  if (!fichiers.length) return;
  importerXLSX(fichiers).then(feuilles => {
    const tables = [];
    const erreurs = [];
    feuilles.forEach(f => {
      if (f.erreur) { erreurs.push(f.fichier + ' : ' + f.erreur); return; }
      const t = analyserTableauServiceFeuille(f.ws, f.feuille);
      t.fichier = f.fichier;
      if (t.erreurs.length) erreurs.push(f.fichier + ' / ' + f.feuille + ' : ' + t.erreurs.join(', '));
      if (t.creneaux.length) tables.push(t);
    });
    if (!tables.length) {
      afficherErreurTableaux('Aucun tableau de service lisible.' + (erreurs.length ? ' ' + erreurs.join(' · ') : ''));
      return;
    }
    importTableauxService = { tables: tables, erreurs: erreurs };
    afficherApercuTableauxService();
  });
}

function afficherApercuTableauxService() {
  const zone = document.getElementById('service-preview');
  if (!zone || !importTableauxService) return;
  const parProf = repartirParProfesseur(importTableauxService.tables);
  const lignes = Object.keys(parProf).sort().map(cle => {
    const liste = parProf[cle];
    const minutes = heuresCreneaux(liste);
    const compte = comptes.find(x => x.email === cle);
    const alerte = minutes > 20 * 60;
    const classes = Array.from(new Set(liste.map(c => c.classe))).join(', ');
    return '<div class="flex justify-between items-center px-3 py-1.5 rounded-lg mb-1 ' +
      (alerte ? 'bg-red-50' : 'bg-green-50') + '">' +
      '<span class="text-sm text-gray-700">' + (compte ? compte.nom + ' (' + compte.matiere + ')' : cle) + '</span>' +
      '<span class="text-xs text-gray-500">' + formatDureeService(minutes) + ' · ' + liste.length + ' séance(s)' + (classes ? ' · ' + classes : '') + '</span>' +
      '</div>';
  }).join('');
  const total = importTableauxService.tables.reduce((som, t) => som + t.creneaux.length, 0);
  zone.classList.remove('hidden');
  zone.innerHTML =
    '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
      '<p class="font-bold text-blue-900 mb-2"><i class="fas fa-check-circle"></i> ' + importTableauxService.tables.length +
        ' tableau(x) lisible(s) · ' + total + ' séance(s) · ' + Object.keys(parProf).length + ' professeur(s)</p>' +
      lignes +
      (importTableauxService.erreurs.length ? '<p class="text-xs text-red-600 mt-2">Ignoré : ' + importTableauxService.erreurs.join(' · ') + '</p>' : '') +
      '<p class="text-xs text-gray-500 mt-2">Les professeurs reconnus par leur matière sont reliés à leur compte ; les autres sont enregistrés sous leur nom. Une séance de plus de 20 h de service est signalée en rouge.</p>' +
      '<button onclick="confirmerImportTableauxService()" class="btn-primary w-full mt-3"><i class="fas fa-download"></i> Enregistrer les tableaux de service</button>' +
    '</div>';
}

function confirmerImportTableauxService() {
  if (!importTableauxService) return;
  const parProf = repartirParProfesseur(importTableauxService.tables);
  let profs = 0, totalMinutes = 0;
  Object.keys(parProf).forEach(cle => {
    tableauxService[cle] = parProf[cle].map(c => ({ jour: c.jour, debut: c.debut, fin: c.fin, classe: c.classe, salle: c.salle }));
    profs++;
    totalMinutes += heuresCreneaux(parProf[cle]);
  });
  sauvegarderTableauxService();
  importTableauxService = null;
  const zone = document.getElementById('service-preview');
  if (zone) { zone.classList.add('hidden'); zone.innerHTML = ''; }
  appliquerTableauService();
  afficherToast(profs + ' tableau(x) de service enregistré(s) · ' + formatDureeService(totalMinutes) + ' au total', 'success');
}

// ---- import des tableaux d'eleves (multi-fichiers) ----
function importerTableauxEleves(input) {
  const fichiers = Array.prototype.slice.call(input.files || []);
  input.value = '';
  if (!fichiers.length) return;
  importerXLSX(fichiers).then(feuilles => {
    const classesLues = [];
    const erreurs = [];
    feuilles.forEach(f => {
      if (f.erreur) { erreurs.push(f.fichier + ' : ' + f.erreur); return; }
      const c = analyserTableauElevesFeuille(f.ws, f.feuille);
      if (!c) { erreurs.push(f.fichier + ' / ' + f.feuille + ' : aucun eleve reconnu'); return; }
      classesLues.push(c);
    });
    if (!classesLues.length) {
      afficherErreurTableaux('Aucun eleve reconnu.' + (erreurs.length ? ' ' + erreurs.join(' · ') : ''));
      return;
    }
    importEleves = { classes: classesLues, erreurs: erreurs };
    afficherApercuEleves();
  });
}

function analyserTableauElevesFeuille(ws, nomFeuille) {
  if (!ws || typeof XLSX === 'undefined') return null;
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false });
  let classe = '';
  for (let r = 0; r < Math.min(aoa.length, 15) && !classe; r++) {
    (aoa[r] || []).forEach((v, c) => {
      const t = texteCellule(v);
      if (!classe && /القسم|classe/i.test(t)) {
        const suite = t.split(/[:\u061A]/)[1];
        classe = (suite && suite.trim()) || texteCellule((aoa[r] || {})[c + 1]);
      }
    });
  }
  if (!classe && /^[A-Z0-9\-]{3,}$/i.test(String(nomFeuille || '').trim())) classe = String(nomFeuille).trim();

  // ligne d'en-tete (code MASSAR / nom)
  let ligneEntete = -1;
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    const t = (aoa[r] || []).map(texteCellule).join(' | ');
    if (/رمز|رقم التلميذ|مسار|massar|code/i.test(t) && /الاسم|اسم|نسب|nom|prénom|prenom/i.test(t)) { ligneEntete = r; break; }
  }
  const indexCol = t => (aoa[ligneEntete] || []).findIndex(v => t.test(texteCellule(v)));
  let colCode = -1, colNomAr = -1, colNomFr = -1;
  if (ligneEntete >= 0) {
    colCode = indexCol(/رمز|رقم التلميذ|مسار|massar|code/i);
    colNomFr = indexCol(/nom|prénom|prenom|latin|français|francais/i);
    colNomAr = indexCol(/الاسم|اسم|نسب|arabe/i);
  }
  const eleves = [];
  const debut = ligneEntete >= 0 ? ligneEntete + 1 : 0;
  for (let r = debut; r < aoa.length; r++) {
    const ligne = aoa[r] || [];
    const codeCell = colCode >= 0 ? texteCellule(ligne[colCode]) : '';
    const ar = colNomAr >= 0 ? texteCellule(ligne[colNomAr]) : '';
    const fr = colNomFr >= 0 ? texteCellule(ligne[colNomFr]) : '';
    const noms = ligne.map(texteCellule).filter(t => t && t.length > 2 && !/^\d+([.,]\d+)?$/.test(t) && !numeroJour(t));
    const nomAr = ar || noms[0] || '';
    const nomFr = fr || (noms[1] || '');
    const code = codeCell || (ligne.map(texteCellule).find(t => /^[A-Z]{1,3}\d{4,}$/i.test(t)) || '');
    if (!nomAr && !nomFr) continue;
    if (/رمز|الاسم|القسم|professeur|matière|classe/i.test(nomAr + ' ' + nomFr)) continue;
    eleves.push({ massar: code, nomArabe: nomAr, nomFr: nomFr, nom: nomFr || nomAr });
  }
  if (!eleves.length) return null;
  if (!classe) classe = String(nomFeuille || 'Classe');
  return { classe: classe, eleves: eleves };
}

function afficherApercuEleves() {
  const zone = document.getElementById('eleves-preview');
  if (!zone || !importEleves) return;
  let nouveaux = 0, total = 0;
  const lignes = importEleves.classes.map(c => {
    const existante = classes.find(x => x.nom === c.classe);
    const codes = existante ? existante.eleves.map(e => String(e.massar || '')) : [];
    const nb = c.eleves.filter(e => !e.massar || codes.indexOf(e.massar) < 0).length;
    nouveaux += nb; total += c.eleves.length;
    return '<div class="flex justify-between items-center px-3 py-1.5 bg-green-50 rounded-lg mb-1">' +
      '<span class="text-sm text-gray-700">' + c.classe + (existante ? ' <span class="text-xs text-gray-400">(existante)</span>' : ' <span class="text-xs text-blue-600">(nouvelle classe)</span>') + '</span>' +
      '<span class="text-xs text-gray-500">' + c.eleves.length + ' élève(s) · ' + nb + ' nouveau(x)</span></div>';
  }).join('');
  zone.classList.remove('hidden');
  zone.innerHTML =
    '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
      '<p class="font-bold text-blue-900 mb-2"><i class="fas fa-check-circle"></i> ' + importEleves.classes.length + ' classe(s) · ' +
        total + ' élève(s) · ' + nouveaux + ' à ajouter</p>' + lignes +
      (importEleves.erreurs.length ? '<p class="text-xs text-red-600 mt-2">Ignoré : ' + importEleves.erreurs.join(' · ') + '</p>' : '') +
      '<button onclick="confirmerImportEleves()" class="btn-primary w-full mt-3"><i class="fas fa-download"></i> Importer les élèves</button>' +
    '</div>';
}

function confirmerImportEleves() {
  if (!importEleves) return;
  let ajoutes = 0, nouvelles = 0, ignores = 0;
  importEleves.classes.forEach(c => {
    let cl = classes.find(x => x.nom === c.classe);
    if (!cl) { cl = { id: nextClasseId++, nom: c.classe, eleves: [] }; classes.push(cl); nouvelles++; }
    c.eleves.forEach(e => {
      const dejaLa = e.massar && cl.eleves.some(x => String(x.massar || '') === String(e.massar));
      if (dejaLa) { ignores++; return; }
      cl.eleves.push({ id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomArabe || '', prenom: '' });
      ajoutes++;
    });
  });
  sauvegarderClasses();
  importEleves = null;
  const zone = document.getElementById('eleves-preview');
  if (zone) { zone.classList.add('hidden'); zone.innerHTML = ''; }
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  afficherToast(ajoutes + ' élève(s) ajouté(s) · ' + nouvelles + ' classe(s) créée(s)' + (ignores ? ' · ' + ignores + ' déjà présent(s)' : ''), 'success');
}

// ---- lecture xlsx generique (un ou plusieurs fichiers) ----
function importerXLSX(fichiers) {
  return Promise.all(fichiers.map(lireFichierXLSX)).then(liste => {
    const feuilles = [];
    liste.forEach(f => {
      if (f.erreur) { feuilles.push(f); return; }
      (f.wb.SheetNames || []).forEach(nom => feuilles.push({ fichier: f.fichier, feuille: nom, ws: f.wb.Sheets[nom] }));
    });
    return feuilles;
  });
}
function lireFichierXLSX(file) {
  return new Promise(resolve => {
    if (!file.name.match(/\.xlsx?$/i)) { resolve({ fichier: file.name, erreur: 'format non supporté (xlsx attendu)' }); return; }
    const lecteur = new FileReader();
    lecteur.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        resolve({ fichier: file.name, wb: wb });
      } catch (err) { resolve({ fichier: file.name, erreur: 'lecture impossible (' + err.message + ')' }); }
    };
    lecteur.onerror = () => resolve({ fichier: file.name, erreur: 'lecture impossible' });
    lecteur.readAsArrayBuffer(file);
  });
}
function afficherErreurTableaux(message) {
  const div = document.getElementById('tableaux-error');
  if (!div) return;
  div.textContent = message;
  div.classList.remove('hidden');
}

"""
ANCRE = "// ========== DIRECTEUR — IMPORT MASSAR EXCEL =========="
allok &= remplace('lecteurs xlsx inseres', ANCRE, LECTEURS.lstrip('\n') + ANCRE)

# ================= 4. variables d'etat =================
allok &= remplace('variables d import',
                  "let importData = null;",
                  "let importData = null;\nlet importTableauxService = null;\nlet importEleves = null;")

# ================= 5. HTML dans la page Gestion =================
HTML = """      <!-- Importer des tableaux xlsx (services + eleves) -->
      <div class="stat-card mb-4">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-table text-blue-700 mr-2"></i>Importer des tableaux xlsx</h3>

        <p class="text-sm font-bold text-gray-700 mb-1">Tableaux de service des professeurs</p>
        <p class="text-xs text-gray-500 mb-2">Un fichier par professeur (ou un fichier à plusieurs feuilles) : la grille des jours et des créneaux, puis la liste « matière / professeur ». Un professeur dont la matière correspond à un compte est relié automatiquement ; plus de 20 h de service est signalé.</p>
        <div id="drop-zone-service" class="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all" onclick="document.getElementById('file-service').click()">
          <i class="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-1"></i>
          <p class="text-gray-600 text-sm font-medium">Cliquez ou déposez les tableaux de service (.xlsx)</p>
        </div>
        <input type="file" id="file-service" accept=".xlsx,.xls" class="hidden" multiple onchange="importerTableauxService(this)">
        <div id="service-preview" class="hidden mt-3"></div>

        <hr class="my-4 border-gray-200">

        <p class="text-sm font-bold text-gray-700 mb-1">Tableaux des élèves</p>
        <p class="text-xs text-gray-500 mb-2">Fichiers des élèves par classe (une feuille par classe, ou une colonne « classe ») avec le code MASSAR et le nom. Un élève dont le code MASSAR est déjà présent n'est pas dupliqué.</p>
        <div id="drop-zone-eleves" class="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all" onclick="document.getElementById('file-eleves').click()">
          <i class="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-1"></i>
          <p class="text-gray-600 text-sm font-medium">Cliquez ou déposez les tableaux des élèves (.xlsx)</p>
        </div>
        <input type="file" id="file-eleves" accept=".xlsx,.xls" class="hidden" multiple onchange="importerTableauxEleves(this)">
        <div id="eleves-preview" class="hidden mt-3"></div>

        <div id="tableaux-error" class="hidden mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-center"></div>
      </div>

      <!-- Liste des classes -->"""
allok &= remplace('carte d import dans Gestion', '      <!-- Liste des classes -->', HTML)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.46', 'AbsenceTrack v3.47', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.47 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ================= verifications =================
for cle, attendu in [('const TABLEAUX_SERVICE_DEFAUT', 1), ('let tableauxService = chargerTableauxService();', 1),
                     ('function chargerTableauxService', 1), ('function sauvegarderTableauxService', 1),
                     ('function creneauxUtilisateur', 1), ('function emailPourMatiere', 1),
                     ('function analyserTableauServiceFeuille', 1), ('function analyserTableauElevesFeuille', 1),
                     ('function repartirParProfesseur', 1), ('function confirmerImportTableauxService', 1),
                     ('function confirmerImportEleves', 1), ('function importerXLSX', 1),
                     ('id="file-service"', 1), ('id="file-eleves"', 1),
                     ('id="service-preview"', 1), ('id="eleves-preview"', 1),
                     ('id="tableaux-error"', 1), ('id="page-profil"', 1),
                     ('id="file-massar"', 1), ('id="page-dir-stats"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-48s = %d' % (cle, n))
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
