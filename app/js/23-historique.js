// fichier: app/js/23-historique.js
// ========== HISTORIQUE DES ABSENCES DU PERSONNEL (DIRECTEUR SEULEMENT) ==========
// Deux boutons « Historique des absences » : un dans la partie ENSEIGNANTS, un dans la
// partie SURVEILLANTS. La fenetre est CELLE DE « Declarer une absence » (modal-form) :
// meme titre, meme corps defilant, meme bouton Fermer. Les listes deroulantes sont
// construites par le MEME constructeur de champs que les formulaires, et les lignes
// utilisent la MEME carte que les « seances annulees » du Dashboard.
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
  if (e === 'en_cours') return 'En cours';
  if (e === 'a_venir') return 'A venir';
  return 'Terminee';
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
  if (p === 'apres-midi') return 'apres-midi';
  return 'journee';
}

// ---- la fenetre : celle des formulaires ----
function ouvrirHistoriquePersonnel(roleDemande) {
  if (!histoEstDirecteur()) { afficherToast('Ecran reserve au directeur', 'error'); return; }
  const ov = document.getElementById('modal-form');
  const corps = document.getElementById('form-corps');
  const titre = document.getElementById('form-titre');
  if (!ov || !corps) return;

  ov.dataset.role = (roleDemande === 'surveillant') ? 'surveillant' : 'enseignant';
  if (titre) titre.textContent = 'Historique des absences - ' +
    (ov.dataset.role === 'surveillant' ? 'surveillants' : 'enseignants');
  const valider = ov.querySelector('.btn-primary');
  if (valider) valider.style.display = 'none';            // un historique ne se valide pas

  // les deux boutons de fermeture de la fenetre passent par l'historique
  ov.querySelectorAll('button[onclick*="fermerFormulaire"]').forEach(function (b) {
    if (!b.dataset.onclickOrigine) b.dataset.onclickOrigine = b.getAttribute('onclick') || '';
    b.setAttribute('onclick', 'fermerHistoriquePersonnel()');
  });

  // MEMES champs que « Declarer une absence » (constructeur de l'application)
  // On AJOUTE notre bloc SANS toucher aux formulaires de l'application : vider ce
  // conteneur detruisait tous les autres formulaires (defaut signale : plus aucune
  // fenetre de saisie ne s'ouvrait apres avoir vu l'historique).
  let bloc = document.getElementById('bloc-form-historique');
  if (!bloc) {
    bloc = document.createElement('div');
    bloc.id = 'bloc-form-historique';
    bloc.innerHTML = '<div id="histo-totaux"></div>' +
      '<div id="histo-liste" class="js-histo-personnel" style="max-height:430px;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>';
    corps.appendChild(bloc);
    // MEMES champs que « Declarer une absence » (constructeur de l'application)
    // Ces 3 filtres se construisent UNE SEULE FOIS, avec le bloc : construits a chaque
    // ouverture, ils s'empilaient (3, 6, 9 listes — defaut signale par l'utilisateur :
    // « 3 nouvelles listes deroulantes s'ajoutent dans le popup »).
    const place = function (ch) { bloc.insertBefore(construireChamp(ch), bloc.firstChild); };
    place({ id: 'histo-periode', label: 'Periode', type: 'select', onchange: 'afficherHistoriquePersonnel()',
            options: [['', 'Toute la periode'], ['mois', 'Ce mois'], ['semestre', 'Ce semestre']] });
    place({ id: 'histo-etat', label: 'Etat', type: 'select', onchange: 'afficherHistoriquePersonnel()',
            options: [['', 'Tous les etats'], ['en_cours', 'En cours'], ['terminee', 'Terminees'], ['a_venir', 'A venir']] });
    place({ id: 'histo-personne', label: (ov.dataset.role === 'surveillant') ? 'Surveillant' : 'Enseignant',
            type: 'select', onchange: 'afficherHistoriquePersonnel()', options: [] });
  } else {
    // Reouverture : le libelle de la personne peut changer si l'historique est passe des
    // enseignants aux surveillants (deux boutons distincts) — on met a jour le libelle,
    // on ne reconstruit rien.
    const lab = bloc.querySelector('label[for="histo-personne"]') || bloc.querySelector('#histo-personne').previousElementSibling;
    if (lab) lab.textContent = (ov.dataset.role === 'surveillant') ? 'Surveillant' : 'Enseignant';
  }
  Array.prototype.forEach.call(corps.children, function (el) { el.style.display = (el === bloc) ? 'block' : 'none'; });
  formulaireActif = 'historique';

  // LA DECORATION DES LISTES DEROULANTES (meme composant que « Declarer une absence ») :
  // elle est posee au chargement sur les listes existantes — il faut la poser sur les
  // notres, creees a l'instant, sinon elles restent des listes brutes.
  try {
    if (typeof initialiserListesDeroulantes === 'function') {
      const avant = document.querySelectorAll('#form-corps .sd').length;
      initialiserListesDeroulantes();
      const apres = document.querySelectorAll('#form-corps .sd').length;
      if (apres <= avant) {
        // la fonction ne retraite que les nouvelles : on decore nous-memes les notres
        ['histo-personne', 'histo-etat', 'histo-periode'].forEach(function (id) {
          const sel = document.getElementById(id);
          if (sel && !sel.closest('.sd') && typeof boxerListeDeroulante === 'function') boxerListeDeroulante(sel);
        });
      }
    }
  } catch (e) {}
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
  ov.querySelectorAll('button[data-onclick-origine]').forEach(function (b) {
    b.setAttribute('onclick', b.dataset.onclickOrigine || 'fermerFormulaire()');
  });
  ov.classList.add('hidden');
  ov.style.display = '';
  if (typeof fermerFormulaire === 'function') { try { fermerFormulaire(); } catch (e) {} }
}

function remplirFiltrePersonnesHistorique() {
  const ov = document.getElementById('modal-form');
  const sel = document.getElementById('histo-personne');
  if (!ov || !sel) return;
  const role = ov.dataset.role;
  const codes = {};
  (indispoProfs || []).forEach(function (i) { if (roleAbsence(i) === role) codes[String(i.profCode)] = true; });
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
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune absence pour cette periode.</p>';
  } else {
    cont.innerHTML = '';
    lignes.forEach(function (a) {
      const sn = histoSeancesDeLAbsence(a.id);
      const et = histoEtat(a);
      // MEME carte que les seances annulees du Dashboard
      const titre = histoNomPersonne(a.profCode) +
        (et === 'en_cours' ? ' <span class="tag-avenir">' + histoLibelleEtat(et) + '</span>' : '');
      const sousTitre = dateAffichage(a.debut) + ' - ' + dateAffichage(a.fin || a.debut) +
        ' - ' + histoJours(a) + ' jour(s) - ' + histoPorteeLibelle(a.portee) +
        ' - ' + (a.motif || 'Absence') + (a.par ? ' - par ' + a.par : '') +
        (sn.length ? ' - ' + sn.length + ' seance(s) annulee(s)' : '');
      cont.appendChild(carteLigne(titre, sousTitre));
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
    // Carte « Totaux » : fond du bloc « Motif de justification » (motif-carte) et MEME
    // police que les cartes de la liste ci-dessous (titre / sous-titre de carte).
    // Le nom (arabe) est sur sa ligne, les nombres (latin) sur la suivante : le melange
    // arabe / francais reste lisible, comme dans les listes de l'application.
    tot.innerHTML = noms.length
      ? '<div class="motif-carte" style="margin-bottom:10px;">' + noms.map(function (n) {
          const nb = par[n].absences;
          const j = par[n].jours;
          return '<div style="margin-bottom:6px;">' +
            '<p class="carte-ligne-titre" dir="auto">' + n + '</p>' +
            '<p class="carte-ligne-sous" dir="auto">' + nb + (nb > 1 ? ' absences' : ' absence') +
            ' &middot; ' + j + (j > 1 ? ' jours' : ' jour') + '</p>' +
          '</div>';
        }).join('') + '</div>'
      : '';
  }
}

// ---- les DEUX boutons (espace directeur uniquement) ----
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
  if (!histoEstDirecteur()) return;
  histoPoserBouton('indispo-liste', 'enseignant');
  histoPoserBouton('abs-surv-liste', 'surveillant');
}

if (typeof window !== 'undefined') {
  window.ouvrirHistoriquePersonnel = ouvrirHistoriquePersonnel;
  window.fermerHistoriquePersonnel = fermerHistoriquePersonnel;
  window.afficherHistoriquePersonnel = afficherHistoriquePersonnel;
  window.installerBoutonHistoriquePersonnel = installerBoutonHistoriquePersonnel;
}
