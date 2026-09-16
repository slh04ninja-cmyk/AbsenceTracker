// fichier: app/js/23-historique.js
// ========== HISTORIQUE DES ABSENCES DU PERSONNEL (DIRECTEUR SEULEMENT) ==========
// Deux boutons, un par categorie, portant le meme libelle « Historique des absences » :
//   - dans la partie ENSEIGNANTS (apres la liste des absences des enseignants)
//   - dans la partie SURVEILLANTS (apres la liste des absences des surveillants)
// La fenetre qui s'ouvre reprend le STYLE des autres fenetres de l'application
// (memes classes : modal-overlay, modal-content, btn-fermer) et les listes deroulantes
// utilisees partout ailleurs.
//
// Rien ne s'efface jamais tout seul : une absence terminee reste dans l'historique.

function histoRole() { return String((utilisateurConnecte || {}).role || ''); }
function histoEstDirecteur() { return histoRole() === 'directeur'; }

function histoNomPersonne(code) {
  const c = String(code || '');
  if (!c) return '(personne inconnue)';
  let nom = '';
  try { nom = nomProfCode(c) || ''; } catch (e) { nom = ''; }
  if (!nom && typeof nomsProfs !== 'undefined' && nomsProfs) nom = nomsProfs[c] || '';
  return String(nom || c);
}
function histoEtat(a) {
  const auj = fmtDateISO(new Date());
  if (auj < a.debut) return 'a_venir';
  if (auj > (a.fin || a.debut)) return 'terminee';
  return 'en_cours';
}
function histoLibelleEtat(e) {
  if (e === 'en_cours') return 'en cours';
  if (e === 'a_venir') return 'à venir';
  return 'terminée';
}
function histoSeancesDeLAbsence(idAbsence) {
  try {
    return seancesAnnuleesParAbsence().filter(function (sn) { return '' + sn.idAbsence === '' + idAbsence; });
  } catch (e) { return []; }
}
function histoJours(a) {
  try {
    const d1 = new Date(String(a.debut) + 'T12:00:00');
    const d2 = new Date(String(a.fin || a.debut) + 'T12:00:00');
    const n = Math.round((d2 - d1) / 86400000) + 1;
    return n > 0 ? n : 1;
  } catch (e) { return 1; }
}
function histoPorteeLibelle(p) {
  if (p === 'matin') return 'matin';
  if (p === 'apres-midi') return 'après-midi';
  return 'journée';
}

// ---- la fenetre (meme style que les autres fenetres de l'application) ----
function ouvrirHistoriquePersonnel(roleDemande) {
  if (!histoEstDirecteur()) { afficherToast('Écran réservé au directeur', 'error'); return; }
  // MEME FENETRE QUE « Declarer une absence » (modal-form) : titre, corps defilant,
  // bouton Fermer — le style de l'application, rien d'autre.
  const ov = document.getElementById('modal-form');
  const titreForm = document.getElementById('form-titre');
  const corps = document.getElementById('form-corps');
  if (!ov || !corps) return;
  const valider = ov.querySelector('.btn-primary');
  if (valider) valider.style.display = 'none';            // un historique ne se valide pas
  if (titreForm) titreForm.textContent = 'Historique des absences — ' +
    (roleDemande === 'surveillant' ? 'surveillants' : 'enseignants');
  corps.innerHTML =
    '<div id="histo-filtres" class="flex flex-wrap gap-2 mb-3"></div>' +
    '<div id="histo-totaux" class="mb-3"></div>' +
    '<div id="histo-liste"></div>';
  ov.dataset.histo = '1';
  const f = document.getElementById('histo-filtres');
  f.innerHTML =
    '<select id="histo-personne" class="w-full flex-1 min-w-[140px]" onchange="afficherHistoriquePersonnel()"></select>' +
    '<select id="histo-etat" class="w-full flex-1 min-w-[140px]" onchange="afficherHistoriquePersonnel()">' +
      '<option value="">Tous les états</option><option value="en_cours">En cours</option>' +
      '<option value="terminee">Terminées</option><option value="a_venir">À venir</option></select>' +
    '<select id="histo-periode" class="w-full flex-1 min-w-[140px]" onchange="afficherHistoriquePersonnel()">' +
      '<option value="">Toute la période</option><option value="mois">Ce mois</option>' +
      '<option value="semestre">Ce semestre</option></select>';
  ov.dataset.role = (roleDemande === 'surveillant') ? 'surveillant' : 'enseignant';
  ov.classList.remove('hidden');
  ov.style.display = 'flex';
  remplirFiltrePersonnesHistorique();
  afficherHistoriquePersonnel();
}
function fermerHistoriquePersonnel() {
  const ov = document.getElementById('modal-form');
  if (!ov) return;
  const valider = ov.querySelector('.btn-primary');
  if (valider) valider.style.display = '';               // le bouton Valider revient
  if (typeof fermerFormulaire === 'function') { fermerFormulaire(); return; }
  ov.classList.add('hidden'); ov.style.display = 'none';
}
function remplirFiltrePersonnesHistorique() {
  const ov = document.getElementById('modal-form');
  const sel = document.getElementById('histo-personne');
  if (!ov || !sel) return;
  const role = ov.dataset.role;
  const codes = {};
  (indispoProfs || []).forEach(function (i) {
    if (roleAbsence(i) !== role) return;
    codes[String(i.profCode)] = true;
  });
  const garde = sel.value;
  sel.innerHTML = '<option value="">' + (role === 'surveillant' ? 'Tous les surveillants' : 'Tous les enseignants') + '</option>';
  Object.keys(codes).sort(function (a, b) { return histoNomPersonne(a).localeCompare(histoNomPersonne(b)); }).forEach(function (c) {
    const o = document.createElement('option');
    o.value = c; o.textContent = histoNomPersonne(c);
    sel.appendChild(o);
  });
  if (garde) sel.value = garde;
}

function afficherHistoriquePersonnel() {
  if (!histoEstDirecteur()) return;
  const ov = document.getElementById('modal-form');
  const role = ov ? ov.dataset.role : 'enseignant';
  const lire = function (id, def) { const e = document.getElementById(id); return e ? e.value : def; };
  const personne = lire('histo-personne', '');
  const etat = lire('histo-etat', '');
  const periode = lire('histo-periode', '');

  let debut = '0000-01-01', fin = '9999-12-31';
  try {
    if (periode === 'mois') {
      const auj = fmtDateISO(new Date());
      debut = auj.slice(0, 7) + '-01';
      const d = new Date(auj);
      fin = fmtDateISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    } else if (periode === 'semestre' && typeof bornesSemestreCourant === 'function') {
      const b = bornesSemestreCourant(); debut = b.debut; fin = b.fin;
    }
  } catch (e) {}

  const lignes = (indispoProfs || []).filter(function (a) {
    if (roleAbsence(a) !== role) return false;
    if (personne && String(a.profCode) !== personne) return false;
    if (etat && histoEtat(a) !== etat) return false;
    const f = String(a.fin || a.debut);
    return !(f < debut || String(a.debut) > fin);
  }).sort(function (x, y) { return String(y.debut).localeCompare(String(x.debut)); });

  const cont = document.getElementById('histo-liste');
  const tot = document.getElementById('histo-totaux');
  if (!cont) return;

  if (!lignes.length) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-6">Aucune absence pour cette période.</p>';
  } else {
    cont.innerHTML = '';
    lignes.forEach(function (a) {
      const sn = histoSeancesDeLAbsence(a.id);
      const et = histoEtat(a);
      const carte = document.createElement('div');
      carte.className = 'border border-gray-200 rounded-xl p-3 mb-2';
      carte.innerHTML =
        '<div class="flex items-center justify-between gap-2">' +
          '<span class="font-bold">' + histoNomPersonne(a.profCode) + '</span>' +
          '<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="border:1px solid ' +
            (et === 'en_cours' ? '#ef4444' : (et === 'a_venir' ? '#f59e0b' : '#64748b')) + ';color:' +
            (et === 'en_cours' ? '#ef4444' : (et === 'a_venir' ? '#f59e0b' : '#64748b')) + ';">' +
            histoLibelleEtat(et) + '</span>' +
        '</div>' +
        '<div class="text-sm text-gray-600 mt-1">' + dateAffichage(a.debut) + ' → ' + dateAffichage(a.fin || a.debut) +
          ' · ' + histoJours(a) + ' jour(s) · ' + histoPorteeLibelle(a.portee) + '</div>' +
        '<div class="text-sm text-gray-600">' + (a.motif || 'Absence') +
          (a.par ? ' · déclaré par ' + a.par : '') + '</div>' +
        (sn.length ? '<div class="text-xs text-gray-500 mt-1">Séances annulées : ' + sn.length + '</div>' : '');
      cont.appendChild(carte);
    });
  }

  if (tot) {
    const par = {};
    lignes.forEach(function (a) {
      const n = histoNomPersonne(a.profCode);
      par[n] = par[n] || { absences: 0, jours: 0, seances: 0 };
      par[n].absences++;
      par[n].jours += histoJours(a);
      par[n].seances += histoSeancesDeLAbsence(a.id).length;
    });
    const noms = Object.keys(par);
    tot.innerHTML = noms.length
      ? '<div class="bg-gray-100 rounded-xl p-3 text-sm text-gray-700"><b>Totaux</b> · ' + lignes.length +
        ' absence(s)<br>' + noms.map(function (n) {
          return n + ' : ' + par[n].absences + ' absence(s), ' + par[n].jours + ' jour(s)' +
            (par[n].seances ? ', ' + par[n].seances + ' séance(s) annulée(s)' : '');
        }).join('<br>') + '</div>'
      : '';
  }
}

// ---- les DEUX boutons, dans l'espace du directeur uniquement ----
function histoPoserBouton(idAncre, role) {
  const ancre = document.getElementById(idAncre);
  if (!ancre || !ancre.parentNode) return;
  const id = 'btn-histo-' + role;
  if (document.getElementById(id)) return;
  const b = document.createElement('button');
  b.id = id;
  b.type = 'button';
  b.className = 'btn-secondary w-full mt-3';
  b.innerHTML = '<i class="fas fa-clock-rotate-left"></i> Historique des absences';
  b.onclick = function () { ouvrirHistoriquePersonnel(role); };
  ancre.parentNode.insertBefore(b, ancre.nextSibling);
}
function installerBoutonHistoriquePersonnel() {
  if (!histoEstDirecteur()) return;           // jamais chez le surveillant / l'enseignant
  histoPoserBouton('indispo-liste', 'enseignant');     // partie enseignants
  histoPoserBouton('abs-surv-liste', 'surveillant');   // partie surveillants
}

if (typeof window !== 'undefined') {
  window.ouvrirHistoriquePersonnel = ouvrirHistoriquePersonnel;
  window.fermerHistoriquePersonnel = fermerHistoriquePersonnel;
  window.afficherHistoriquePersonnel = afficherHistoriquePersonnel;
  window.installerBoutonHistoriquePersonnel = installerBoutonHistoriquePersonnel;
}
