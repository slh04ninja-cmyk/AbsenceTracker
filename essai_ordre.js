#!/usr/bin/env node
/* essai_ordre.js — verifie l'ordre d'affichage des seances annulees :
 * la plus proche d'aujourd'hui d'abord (« ordre decroissant de plus proche »).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'AbsenceTrack-v2.html'), 'utf8');
const win = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true }).window;

setTimeout(function () {
  const auj = win.eval('fmtDateISO(new Date())');
  const plus = (n) => {
    const d = new Date(auj + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return win.eval('fmtDateISO(new Date(' + d.getTime() + '))');
  };
  win.eval("seancesAnnulees = [" +
    "{ id: 1, dateISO: '" + plus(5) + "', classe: 'LOIN', debut: '08:00' }," +
    "{ id: 2, dateISO: '" + plus(-1) + "', classe: 'HIER', debut: '08:00' }," +
    "{ id: 3, dateISO: '" + plus(1) + "', classe: 'DEMAIN', debut: '08:00' }," +
    "{ id: 4, dateISO: '" + plus(-4) + "', classe: 'AVANT', debut: '08:00' } ];");
  console.log("aujourd'hui :", auj);
  console.log("ordre affiche :", win.eval("trierSeancesAnnulees().map(function (s) { return s.classe; }).join(' > ')"));
  console.log("attendu       : DEMAIN > HIER > AVANT > LOIN");
  process.exit(0);
}, 400);
