#!/usr/bin/env node
/* essai_seances_annulees.js — POURQUOI les seances annulees par une absence
 * n'apparaissent pas dans la carte « Seances annulees » du dashboard.
 * On charge le livrable v3.86, on pose un tableau de service et une absence
 * d'enseignant, puis on demande a l'application ce qu'elle en deduit.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const FICHIER = process.argv[2] || path.join(__dirname, 'AbsenceTrack-v2.html');
const html = fs.readFileSync(FICHIER, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true });
const win = dom.window;

setTimeout(function () {
  // un tableau de service pour un professeur (comme apres un import de tableaux)
  win.eval("tableauxService = { 'math-prof1@taalim.ma': [" +
           "{ jour: 1, debut: '08:00', fin: '10:00', classe: 'TCSF-1', matiere: 'Maths', prof: 'math-prof1' }," +
           "{ jour: 3, debut: '10:00', fin: '12:00', classe: 'TCSF-2', matiere: 'Maths', prof: 'math-prof1' } ] };");
  // une absence saisie par le directeur dans RH (carte Enseignants)
  win.eval("indispoProfs = [{ id: 501, profCode: 'math-prof1', role: 'enseignant'," +
           " debut: '2026-09-14', fin: '2026-09-18', portee: 'journee', motif: 'Maladie', par: 'Directeur' }];");

  console.log("profCode de l'absence :", win.eval("indispoProfs[0].profCode"));
  console.log("prof des creneaux     :", win.eval("tableauxService['math-prof1@taalim.ma'][0].prof"));
  console.log("roleAbsence           :", win.eval("roleAbsence(indispoProfs[0])"));
  const deduites = win.eval("JSON.stringify(seancesAnnuleesParAbsence())");
  console.log("seances deduites      :", deduites);
  const fusion = win.eval("JSON.stringify(listeSeancesAnnulees())");
  console.log("liste de la carte     :", fusion);

  // et si le tableau est range par ADRESSE avec le prof en nom affiche ?
  win.eval("tableauxService = { 'math-prof1@taalim.ma': [" +
           "{ jour: 1, debut: '08:00', fin: '10:00', classe: 'TCSF-1', matiere: 'Maths', prof: 'أيوب الكمرة' } ] };");
  win.eval("nomsProfs['math-prof1'] = 'أيوب الكمرة';");
  console.log("--- avec un nom arabe comme « prof » ---");
  console.log("seances deduites      :", win.eval("JSON.stringify(seancesAnnuleesParAbsence())"));
  process.exit(0);
}, 400);
