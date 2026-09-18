// fichier: app/js/12-imports.js
// ========== LECTURE DES FICHIERS FET (emploi du temps XML) ==========
function normaliserTexte(t) {
  return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const JOURS_FET = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function numeroJourFET(nom, position) {
  const i = JOURS_FET.indexOf(normaliserTexte(nom));
  if (i > 0) return i;                       // 1 = lundi ... 6 = samedi
  return (position >= 0 ? position + 1 : 0); // repli : ordre du fichier
}
function heureFET(txt) {
  const m = String(txt || '').match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!m) return '';
  return String(parseInt(m[1], 10)).padStart(2, '0') + ':' + String(parseInt(m[2] || '0', 10)).padStart(2, '0');
}
function parserFET(texte) {
  let xml;
  try { xml = new DOMParser().parseFromString(String(texte || ''), 'text/xml'); } catch (e) { return null; }
  if (!xml || xml.querySelector('parsererror') || !xml.querySelector('FET')) return null;
  const txt = el => (el && el.textContent ? el.textContent.trim() : '');
  const jours = Array.from(xml.querySelectorAll('Days_List > Day')).map(txt);
  const heures = Array.from(xml.querySelectorAll('Hours_List > Hour')).map(txt);
  const profs = Array.from(xml.querySelectorAll('Teachers_List > Teacher > Name')).map(txt).filter(Boolean);
  const listeClasses = Array.from(xml.querySelectorAll('Students_List > Students > Name')).map(txt).filter(Boolean);
  const seances = [];
  Array.from(xml.querySelectorAll('Activities_List > Activity')).forEach(act => {
    const prof = txt(act.querySelector('Teacher'));
    const classe = txt(act.querySelector('Students'));
    const matiere = txt(act.querySelector('Subject'));
    const h = parseFloat(txt(act.querySelector('Duration'))) || 0;
    const demi = parseFloat(txt(act.querySelector('Duration_Half_Hours'))) || 0;
    const duree = h || (demi / 2) || 1;
    Array.from(act.querySelectorAll('Activity_Group')).forEach(g => {
      const jourEl = g.querySelector('Day');
      const heureEl = g.querySelector('Hour');
      if (!jourEl || !heureEl) return;
      const nomJour = txt(jourEl);
      const jour = numeroJourFET(nomJour, jours.indexOf(nomJour));
      const debut = heureFET(txt(heureEl));
      if (!jour || !debut) return;
      const finMin = hhmmEnMinutes(debut) + Math.round(duree * 60);
      const fin = String(Math.floor(finMin / 60)).padStart(2, '0') + ':' + String(finMin % 60).padStart(2, '0');
      seances.push({ jour: jour, debut: debut, fin: fin, classe: classe, matiere: matiere, prof: prof, salle: txt(g.querySelector('Room')) });
    });
  });
  return { institution: txt(xml.querySelector('Institution_Name')), jours: jours, heures: heures, profs: profs, classes: listeClasses, seances: seances };
}
function compteDuNomFET(nom) {
  const cible = normaliserTexte(nom);
  if (!cible) return null;
  return comptes.find(c => normaliserTexte(c.nom) === cible) || null;
}
function lireTexteFichier(file) {
  return new Promise(function (resoudre, rejeter) {
    const lecteur = new FileReader();
    lecteur.onload = function () { resoudre(String(lecteur.result || '')); };
    lecteur.onerror = function () { rejeter(new Error('lecture impossible')); };
    lecteur.readAsText(file);
  });
}
function estFichierFET(file) { return /\.fet$/i.test(String(file && file.name || '')); }

// Tableaux de service depuis un (ou plusieurs) fichier FET
async function importerServicesFET(fichiers) {
  let seances = 0;
  const profsVus = [];
  const inconnus = [];
  const classesCreees = [];
  for (const fichier of fichiers) {
    let parse = null;
    try { parse = parserFET(await lireTexteFichier(fichier)); } catch (e) { parse = null; }
    if (!parse) { afficherToast('Fichier FET illisible : ' + fichier.name, 'error'); continue; }
    const parProf = {};
    parse.seances.forEach(sn => {
      const compte = compteDuNomFET(sn.prof);
      if (!compte || !compte.email) {
        if (sn.prof && inconnus.indexOf(sn.prof) < 0) inconnus.push(sn.prof);
        return;
      }
      parProf[compte.email] = parProf[compte.email] || [];
      if (!parProf[compte.email].some(x => x.jour === sn.jour && x.debut === sn.debut && x.classe === sn.classe)) {
        parProf[compte.email].push({
          jour: sn.jour, debut: sn.debut, fin: sn.fin, classe: sn.classe,
          matiere: sn.matiere || compte.matiere || '', prof: compte.code || '', salle: sn.salle || ''
        });
      }
    });
    Object.keys(parProf).forEach(cle => {
      tableauxService[cle] = parProf[cle];
      if (profsVus.indexOf(cle) < 0) profsVus.push(cle);
      seances += parProf[cle].length;
    });
    parse.classes.forEach(nom => {
      if (!classes.some(c => c.nom === nom)) {
        classes.push({ id: nextClasseId++, nom: nom, eleves: [] });
        classesCreees.push(nom);
      }
    });
  }
  sauvegarderTableauxService();
  if (classesCreees.length) sauvegarderClasses();
  const apercu = document.getElementById('service-preview');
  if (apercu) {
    apercu.classList.remove('hidden');
    apercu.innerHTML = '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
      '<p class="font-bold text-green-800">Fichier FET importé</p>' +
      '<p class="text-sm text-green-700">' + seances + ' séance(s) · ' + profsVus.length + ' professeur(s)' +
      (classesCreees.length ? ' · ' + classesCreees.length + ' classe(s) créée(s)' : '') + '</p>' +
      (inconnus.length ? '<p class="text-xs text-orange-700 mt-2">Professeurs non reconnus (créez leur compte) : ' + inconnus.join(', ') + '</p>' : '') +
      '</div>';
  }
  afficherToast('Tableaux de service importés (FET)', 'success');
}
// Classes depuis un fichier FET (les codes MASSAR ne sont pas dans un FET)
async function importerElevesFET(fichiers) {
  const creees = [];
  for (const fichier of fichiers) {
    let parse = null;
    try { parse = parserFET(await lireTexteFichier(fichier)); } catch (e) { parse = null; }
    if (!parse) { afficherToast('Fichier FET illisible : ' + fichier.name, 'error'); continue; }
    parse.classes.forEach(nom => {
      if (!classes.some(c => c.nom === nom)) {
        classes.push({ id: nextClasseId++, nom: nom, eleves: [] });
        creees.push(nom);
      }
    });
  }
  if (creees.length) sauvegarderClasses();
  const apercu = document.getElementById('eleves-preview');
  if (apercu) {
    apercu.classList.remove('hidden');
    apercu.innerHTML = '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
      '<p class="font-bold text-green-800">Fichier FET importé</p>' +
      '<p class="text-sm text-green-700">' + creees.length + ' classe(s) créée(s)' + (creees.length ? ' : ' + creees.join(', ') : '') + '</p>' +
      '<p class="text-xs text-orange-700 mt-2">Un fichier FET ne contient pas les codes MASSAR ni les élèves : importez le fichier Excel MASSAR pour les noms et les codes.</p>' +
      '</div>';
  }
  afficherToast('Classes importées (FET)', 'success');
}

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
      const cle = (emailPourMatiere(c.matiere)) || nomProf || ('matiere:' + c.matiere);
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
async function importerTableauxService(input) {
  const fichiersChoisis = Array.from(input.files || []);
  const fichiersFET = fichiersChoisis.filter(estFichierFET);
  if (fichiersFET.length) {
    await importerServicesFET(fichiersFET);
    if (fichiersFET.length === fichiersChoisis.length) { input.value = ''; return; }
  }
  if (!(await xlsxPret())) return;
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
async function importerTableauxEleves(input) {
  const fichiersChoisis = Array.from(input.files || []);
  const fichiersFET = fichiersChoisis.filter(estFichierFET);
  if (fichiersFET.length) {
    await importerElevesFET(fichiersFET);
    if (fichiersFET.length === fichiersChoisis.length) { input.value = ''; return; }
  }
  if (!(await xlsxPret())) return;
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
    if (/رمز|الاسم|القسم|ملاحظ|مجموع|توقيع|professeur|matière|classe|total|^note/i.test(ligne.map(texteCellule).join(' '))) continue;
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
  const aSortir = [];
  importEleves.classes.forEach(c => {
    let cl = classes.find(x => x.nom === c.classe);
    if (!cl) { cl = { id: nextClasseId++, nom: c.classe, eleves: [] }; classes.push(cl); nouvelles++; }
    c.eleves.forEach(e => {
      const dejaLa = e.massar && cl.eleves.some(x => String(x.massar || '') === String(e.massar));
      if (dejaLa) { ignores++; return; }
      cl.eleves.push({ id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomArabe || '', prenom: '' });
      ajoutes++;
    });
    // Eleves inscrits qui NE FIGURENT PLUS dans le fichier de cette classe : ils ont
    // peut-etre quitte l'etablissement. On ne decide pas a leur place : on PROPOSE.
    // (Seules les classes presentes dans le fichier sont examinees : un import partiel
    //  ne touche donc jamais les eleves des autres classes.)
    const codesFichier = {};
    c.eleves.forEach(e => { if (e.massar) codesFichier[String(e.massar)] = true; });
    cl.eleves.forEach(e => {
      if (estSorti(e)) return;
      if (!e.massar) return;
      if (!codesFichier[String(e.massar)]) aSortir.push({ classeId: cl.id, eleveId: e.id, nom: libelleEleve(e), classe: cl.nom });
    });
  });
  sauvegarderClasses();
  importEleves = null;
  const zone = document.getElementById('eleves-preview');
  if (zone) { zone.classList.add('hidden'); zone.innerHTML = ''; }
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  const resume = ajoutes + ' élève(s) ajouté(s) · ' + nouvelles + ' classe(s) créée(s)' + (ignores ? ' · ' + ignores + ' déjà présent(s)' : '');
  if (!aSortir.length) {
    afficherToast(resume, (ajoutes || nouvelles) ? 'success' : 'info');
    return;
  }
  // jamais silencieux : le directeur voit la liste et decide
  const noms = aSortir.map(x => x.nom + ' (' + x.classe + ')').join(', ');
  demanderConfirmation(resume + ' · ' + aSortir.length + ' élève(s) ne figurent plus dans le fichier : ' + noms +
    '. Les marquer comme « sortis » ? Ils disparaîtront de l\'appel du jour mais garderont leur historique.',
    function () {
      aSortir.forEach(x => {
        const cl = classes.find(c => c.id === x.classeId);
        const el = cl ? cl.eleves.find(e => e.id === x.eleveId) : null;
        if (el) el.actif = false;
      });
      sauvegarderClasses();
      afficherGestionDir();
      mettreAJourDashboardDir();
      afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
    });
  afficherToast(resume, (ajoutes || nouvelles) ? 'success' : 'info');
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

// ========== DIRECTEUR — IMPORT MASSAR EXCEL ==========
let importData = null;
let importTableauxService = null;
let importEleves = null;

// Drag & drop
const dropZone = document.getElementById('drop-zone');
if (dropZone) {
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    const fichiers = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (fichiers.length) processMassarFiles(fichiers);
  });
}

async function importerMassar(input) {
  if (!(await xlsxPret())) return;
  const fichiers = Array.prototype.slice.call(input.files || []);
  input.value = '';
  processMassarFiles(fichiers);
}

// Lecture d'un fichier MASSAR -> Promise { fichier, classes, erreur }
function lireFichierMASSAR(file) {
  return new Promise(function (resolve) {
    if (!file.name.match(/\.xlsx?$/i)) {
      resolve({ fichier: file.name, classes: [], erreur: 'format non supporté (xlsx attendu)' });
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const classesTrouvees = [];
        workbook.SheetNames.forEach(nomFeuille => {
          const parsed = analyserFeuilleMASSAR(workbook.Sheets[nomFeuille]);
          if (parsed) classesTrouvees.push(parsed);
        });
        resolve({ fichier: file.name, classes: classesTrouvees, erreur: classesTrouvees.length ? '' : 'aucune classe détectée' });
      } catch (err) {
        resolve({ fichier: file.name, classes: [], erreur: err.message });
      }
    };
    reader.onerror = function () { resolve({ fichier: file.name, classes: [], erreur: 'lecture impossible' }); };
    reader.readAsArrayBuffer(file);
  });
}

// Un ou plusieurs fichiers : tous sont lus puis fusionnes en une seule preview
function processMassarFiles(fichiers) {
  const errorDiv = document.getElementById('import-error');
  const previewDiv = document.getElementById('import-preview');
  errorDiv.classList.add('hidden');
  previewDiv.classList.add('hidden');
  if (!fichiers || fichiers.length === 0) return;

  Promise.all(fichiers.map(lireFichierMASSAR)).then(function (resultats) {
    const classesTrouvees = [];
    const erreurs = [];
    resultats.forEach(function (r) {
      if (r.erreur) erreurs.push(r.fichier + ' : ' + r.erreur);
      r.classes.forEach(function (c) { classesTrouvees.push(c); });
    });
    if (classesTrouvees.length === 0) {
      errorDiv.textContent = 'Aucune classe détectée. Vérifiez le format MASSAR (nom de classe en I9, élèves à partir de la ligne 18, colonnes C = code, D = nom arabe, E = nom français).' + (erreurs.length ? ' Détail : ' + erreurs.join(' · ') : '');
      errorDiv.classList.remove('hidden');
      return;
    }
    importData = { classes: classesTrouvees };
    const total = classesTrouvees.reduce(function (acc, c) { return acc + c.eleves.length; }, 0);
    document.getElementById('preview-classe-nom').textContent = classesTrouvees.length + ' classe(s) détectée(s) dans ' + fichiers.length + ' fichier(s)';
    document.getElementById('preview-eleves-count').textContent = total + ' élève(s) au total';
    document.getElementById('preview-eleves-list').innerHTML = classesTrouvees.map(function (c) {
      return '<div class="flex justify-between py-1 border-b border-green-100"><span class="font-medium">' + c.nom + '</span><span class="text-xs text-gray-400">' + resumeImportClasse(c) + '</span></div>';
    }).join('') + (erreurs.length ? '<p class="text-xs text-red-600 pt-2">Ignoré : ' + erreurs.join(' · ') + '</p>' : '');
    previewDiv.classList.remove('hidden');
  });
}

function analyserFeuilleMASSAR(ws) {
  if (!ws || !ws['!ref']) return null;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cellI9 = ws['I9'];
  const nomClasse = cellI9 && cellI9.v ? String(cellI9.v).trim() : '';
  if (!nomClasse) return null;
  const eleves = [];
  for (let row = 17; row <= range.e.r; row++) {
    const cellB = ws[XLSX.utils.encode_cell({ r: row, c: 1 })];
    const cellC = ws[XLSX.utils.encode_cell({ r: row, c: 2 })];
    const cellD = ws[XLSX.utils.encode_cell({ r: row, c: 3 })];
    const cellE = ws[XLSX.utils.encode_cell({ r: row, c: 4 })];
    const nomArabe = cellD && cellD.v ? String(cellD.v).trim() : '';
    const nomFr = cellE && cellE.v ? String(cellE.v).trim() : '';
    const massar = cellC && cellC.v !== undefined ? String(cellC.v).trim() : '';
    if (cellB && cellB.v && (nomArabe || nomFr)) {
      eleves.push({ id: nextEleveId++, massar: massar, nomArabe: nomArabe, nomFr: nomFr, nom: (nomFr || nomArabe), prenom: '' });
    }
  }
  if (eleves.length === 0) return null;
  return { nom: nomClasse, eleves: eleves };
}

// Cle de comparaison d'un nom (insensible a la casse, aux accents et aux espaces)
function cleNomEleve(e) {
  let txt = libelleEleve(e) || e.nomFr || e.nomArabe || '';
  txt = String(txt).toLowerCase();
  if (txt.normalize) txt = txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return txt.replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
}

// Apercu d'un fichier MASSAR : ce que la classe va devenir (nouveaux / deja presents)
function resumeImportClasse(c) {
  const exist = classes.find(x => String(x.nom).toLowerCase() === String(c.nom).toLowerCase());
  if (!exist) return c.eleves.length + ' élèves · nouvelle classe';
  const vus = {};
  exist.eleves.forEach(e => { if (e.massar) vus['c' + String(e.massar).trim()] = true; });
  const nb = c.eleves.filter(e => !(e.massar && vus['c' + String(e.massar).trim()])).length;
  if (!nb) return c.eleves.length + ' élèves · tous déjà présents';
  return nb + ' à ajouter · ' + (c.eleves.length - nb) + ' déjà présent(s)';
}

function confirmerImport() {
  if (!importData || !importData.classes) return;
  let nouvelles = 0, ajoutes = 0, dejaLa = 0, corriges = 0, rattaches = 0;
  const aSortir = [];
  importData.classes.forEach(clImport => {
    let existante = classes.find(c => String(c.nom).toLowerCase() === String(clImport.nom).toLowerCase());
    if (!existante) {
      existante = { id: nextClasseId++, nom: clImport.nom, eleves: [] };
      classes.push(existante);
      nouvelles++;
    }
    // Identite d'un eleve = son CODE MASSAR (le nom peut etre corrige dans MASSAR : on le suit).
    // Sans code, on retombe sur le nom. C'est ce qui evite les doublons au reimport.
    const parCode = {}, parNom = {};
    existante.eleves.forEach(e => {
      if (e.massar) parCode['c' + String(e.massar).trim()] = e;
      const k = cleNomEleve(e);
      if (k && !parNom[k]) parNom[k] = e;
    });
    clImport.eleves.forEach(e => {
      const code = e.massar ? 'c' + String(e.massar).trim() : '';
      const deja = (code && parCode[code]) || (!code && parNom[cleNomEleve(e)]) || null;
      if (deja) {
        // deja inscrit : on ne le recree pas, on met seulement son nom a jour
        dejaLa++;
        if (!estSorti(deja)) {
          if (e.nom && e.nom !== deja.nom) { deja.nom = e.nom; corriges++; }
          if (e.nomFr && e.nomFr !== deja.nomFr) deja.nomFr = e.nomFr;
          if (e.nomArabe && e.nomArabe !== deja.nomArabe) deja.nomArabe = e.nomArabe;
        }
        return;
      }
      const nouveau = { id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomFr || e.nomArabe || '', prenom: e.prenom || '', actif: true };
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
      existante.eleves.push(nouveau);
      if (code) parCode[code] = nouveau;
      const kn = cleNomEleve(nouveau);
      if (kn) parNom[kn] = nouveau;
      ajoutes++;
    });
    // Eleves inscrits qui NE FIGURENT PLUS dans le fichier de cette classe : ils ont
    // peut-etre quitte l'etablissement. On ne decide pas a leur place : on PROPOSE.
    // (Seules les classes presentes dans le fichier sont examinees : un import partiel
    //  ne touche donc jamais les eleves des autres classes.)
    const codesFichier = {};
    clImport.eleves.forEach(e => { if (e.massar) codesFichier['c' + String(e.massar).trim()] = true; });
    existante.eleves.forEach(e => {
      if (estSorti(e) || !e.massar) return;
      if (!codesFichier['c' + String(e.massar).trim()]) aSortir.push({ classeId: existante.id, eleveId: e.id, nom: libelleEleve(e), classe: existante.nom });
    });
  });
  sauvegarderClasses();
  if (rattaches) Depot.ecrireJSON('absences', absences);
  const total = importData.classes.reduce((s, c) => s + c.eleves.length, 0);
  importData = null;
  document.getElementById('import-preview').classList.add('hidden');
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  const resume = nouvelles + ' classe(s) importée(s) · ' + ajoutes + ' élève(s) ajouté(s)' +
    (dejaLa ? ' · ' + dejaLa + ' déjà présent(s)' : '') +
    (corriges ? ' · ' + corriges + ' nom(s) corrigé(s)' : '') +
    (rattaches ? ' · ' + rattaches + ' signalement(s) rattaché(s)' : '') + ' — ' + total + ' au total';
  if (aSortir.length) {
    // jamais silencieux : le directeur voit les noms et decide
    const noms = aSortir.map(x => x.nom + ' (' + x.classe + ')').join(', ');
    demanderConfirmation(resume + ' · ' + aSortir.length + ' élève(s) ne figurent plus dans le fichier : ' + noms +
      '. Les marquer comme « sortis » ? Ils disparaîtront de l\'appel du jour mais garderont leur historique.',
      function () {
        aSortir.forEach(x => {
          const cl = classes.find(c => c.id === x.classeId);
          const el = cl ? cl.eleves.find(e => e.id === x.eleveId) : null;
          if (el) el.actif = false;
        });
        sauvegarderClasses();
        afficherGestionDir();
        mettreAJourDashboardDir();
        afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
      });
  }
  afficherToast(resume, (ajoutes || nouvelles || corriges || rattaches) ? 'success' : 'info');
}

// ========== DOUBLONS D'ELEVES (reparation) ==========
// Un ancien import a pu empiler deux fois la meme liste. On regroupe les eleves qui
// partagent le meme code MASSAR dans une classe, puis on FUSIONNE en gardant celui
// qui porte les signalements (l'historique suit).
function aDesSignalements(el, cl) {
  return absences.some(a => a.eleveId === el.id && a.classe === cl.nom);
}

function chercherDoublonsEleves() {
  const groupes = [];
  classes.forEach(cl => {
    const parCode = {}, parNom = {};
    cl.eleves.forEach(e => {
      if (e.massar) {
        const k = 'c' + String(e.massar).trim();
        (parCode[k] = parCode[k] || []).push(e);
      } else {
        const k = cleNomEleve(e);
        if (k) (parNom[k] = parNom[k] || []).push(e);
      }
    });
    Object.keys(parCode).forEach(k => {
      if (parCode[k].length > 1) groupes.push({ classe: cl, eleves: parCode[k], sur: 'code MASSAR' });
    });
    // Sans code MASSAR, on ne fusionne que si UN SEUL exemplaire porte des signalements
    // (sinon on pourrait confondre deux homonymes : on ne touche a rien).
    Object.keys(parNom).forEach(k => {
      const liste = parNom[k];
      if (liste.length < 2) return;
      const avec = liste.filter(e => aDesSignalements(e, cl));
      if (avec.length !== 1) return;
      groupes.push({ classe: cl, eleves: liste, sur: 'nom' });
    });
  });
  return groupes;
}

function verifierDoublonsEleves() {
  const groupes = chercherDoublonsEleves();
  if (!groupes.length) {
    afficherToast('Aucun doublon d\'élève détecté', 'info');
    return;
  }
  const nb = groupes.reduce(function (acc, g) { return acc + g.eleves.length - 1; }, 0);
  const detail = groupes.map(function (g) {
    return libelleEleve(g.eleves[0]) + ' (' + g.classe.nom + ' ×' + g.eleves.length + ')';
  }).join(', ');
  demanderConfirmation(nb + ' doublon(s) détecté(s) : ' + detail +
    '. Les fusionner ? Le signalement de chaque élève est conservé (une seule fiche par élève).',
    function () { fusionnerDoublonsEleves(groupes); });
}

function fusionnerDoublonsEleves(groupes) {
  let fusionnes = 0, rattaches = 0, ecartes = 0;
  groupes.forEach(function (g) {
    const cl = g.classe;
    const nbSig = function (e) { return absences.filter(a => a.eleveId === e.id && a.classe === cl.nom).length; };
    // on garde l'exemplaire qui porte le plus de signalements (a egalite : le plus ancien)
    const tries = g.eleves.slice().sort(function (a, b) { return nbSig(b) - nbSig(a) || a.id - b.id; });
    const garde = tries[0];
    tries.slice(1).forEach(function (doublon) {
      absences = absences.filter(function (a) {
        if (a.eleveId !== doublon.id || a.classe !== cl.nom) return true;
        // meme eleve + meme jour + meme seance deja present -> le doublon exact disparait
        const dejaLa = absences.some(function (b) {
          return b !== a && b.eleveId === garde.id && b.classe === cl.nom &&
            b.dateISO === a.dateISO && (b.seance || 'matin') === (a.seance || 'matin');
        });
        if (dejaLa) { ecartes++; return false; }
        a.eleveId = garde.id;
        rattaches++;
        return true;
      });
      cl.eleves = cl.eleves.filter(function (e) { return e.id !== doublon.id; });
      fusionnes++;
    });
    // le nom garde doit rester lisible meme s'il etait vide sur l'exemplaire conserve
    if (!garde.nom) garde.nom = garde.nomFr || garde.nomArabe || '';
  });
  sauvegarderClasses();
  Depot.ecrireJSON('absences', absences);
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  afficherToast(fusionnes + ' doublon(s) fusionné(s)' +
    (rattaches ? ' · ' + rattaches + ' signalement(s) rattaché(s)' : '') +
    (ecartes ? ' · ' + ecartes + ' en double écarté(s)' : ''), 'modif');
}

// ========== RECHERCHE ELEVE ==========
function chercherEleves(terme) {
  terme = (terme || '').trim().toLowerCase();
  if (terme.length < 2) return [];
  const res = [];
  classes.forEach(cl => cl.eleves.forEach(el => {
    const nom = (libelleEleve(el) + ' ' + (el.nomArabe || '')).toLowerCase();
    const massar = (el.massar || '').toLowerCase();
    if (nom.indexOf(terme) >= 0 || massar.indexOf(terme) >= 0) res.push({ eleve: el, classe: cl });
  }));
  return res.slice(0, 30);
}

function rechercherEleves(idInput, idResultats) {
  const champ = document.getElementById(idInput);
  const cont = document.getElementById(idResultats);
  if (!champ || !cont) return;
  const terme = champ.value;
  cont.innerHTML = '';
  if (!terme || terme.trim().length < 2) {
    cont.innerHTML = '<p class="text-xs text-gray-400 text-center">Saisissez au moins 2 caractères</p>';
    return;
  }
  const res = chercherEleves(terme);
  if (res.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-400 text-center">Aucun élève trouvé</p>';
    return;
  }
  // SEUL AJOUT : pour un ENSEIGNANT, les absences des autres professeurs ne comptent pas
  // (le directeur et le surveillant gardent la recherche complete de l'etablissement).
  const uEns = utilisateurConnecte || {};
  const netEns = function (v) { return String(v || '').toLowerCase().trim(); };
  const miensEns = [netEns(uEns.nom), netEns(uEns.code), netEns(uEns.email), netEns(String(uEns.email || '').split('@')[0])];
  const estMonAuteur = function (valeur) {
    const v = netEns(valeur);
    return miensEns.indexOf(v) >= 0 || miensEns.indexOf(v.split('@')[0]) >= 0;
  };
  const roleEnseignant = String(uEns.role || '') === 'enseignant';
  res.forEach(r => {
    const nb = absences.filter(a => a.eleveId === r.eleve.id && a.classe === r.classe.nom &&
      (!roleEnseignant || estMonAuteur(a.enseignant))).length;
    if (roleEnseignant && !nb) return;                 // rien de lui : l'eleve n'apparait pas
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
    item.style.cursor = 'pointer';
    item.onclick = () => ouvrirFicheEleve(r.eleve.id, r.classe.id);
    item.innerHTML = '<div><p class="font-medium text-gray-800">' + libelleEleve(r.eleve) + '</p><p class="text-xs text-gray-500">' + r.classe.nom + (r.eleve.massar ? ' · ' + r.eleve.massar : '') + '</p></div><span class="badge badge-danger">' + nb + '</span>';
    cont.appendChild(item);
  });
}



// ========== RECHERCHER LES ELEVES QUI N'ONT PAS DE CODE MASSAR (lecture seule) ==========
// Sans code MASSAR, un eleve ne peut etre ni reconnu lors d'un import, ni propose
// comme « sorti » : il resterait melange aux vrais eleves. Cet outil les RETROUVE
// et les LISTE, classe par classe. Il ne modifie rien (v3.96 : avant, il inventait
// un code temporaire — l'utilisateur a demande une simple recherche).
function elevesSansCode() {
  const liste = [];
  classes.forEach(c => c.eleves.forEach(e => {
    if (!String(e.massar || '').trim()) {
      liste.push({ classe: c.nom, classeId: c.id, eleveId: e.id, eleve: libelleEleve(e) });
    }
  }));
  return liste;
}

function rechercherElevesSansCode() {
  const cont = document.getElementById('massar-manquants-liste');
  if (!cont) return;
  const liste = elevesSansCode();
  cont.classList.remove('hidden');
  cont.innerHTML = '';
  if (!liste.length) {
    // meme comportement que « Rechercher les doublons d'élèves » : une notification le dit
    afficherToast('Aucun élève sans code MASSAR détecté', 'info');
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Tous les élèves ont un code MASSAR.</p>';
    return;
  }
  const total = document.createElement('p');
  total.className = 'text-sm font-bold text-gray-700 mb-2';
  total.textContent = liste.length + ' élève(s) sans code MASSAR';
  cont.appendChild(total);
  let classeCourante = '';
  liste.forEach(r => {
    if (r.classe !== classeCourante) {
      classeCourante = r.classe;
      const entete = document.createElement('p');
      entete.className = 'text-xs font-bold text-gray-500 mt-2 mb-1';
      entete.textContent = classeCourante + ' · ' + liste.filter(x => x.classe === classeCourante).length + ' élève(s)';
      cont.appendChild(entete);
    }
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-1';
    item.style.cursor = 'pointer';
    item.onclick = () => ouvrirFicheEleve(r.eleveId, r.classeId);
    item.innerHTML = '<p class="font-medium text-gray-800">' + r.eleve + '</p>' +
      '<span class="text-xs text-gray-500">sans code</span>';
    cont.appendChild(item);
  });
}
