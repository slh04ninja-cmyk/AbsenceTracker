// fichier: app/js/23-historique.js
// ========== HISTORIQUE DES ABSENCES DU PERSONNEL (DIRECTEUR SEULEMENT) ==========
// Le directeur doit pouvoir consulter, filtrer et compter les absences de son personnel.
// Cet ecran vit DANS SON ESPACE : un enseignant ou un surveillant ne le voit pas et ne
// peut pas l'ouvrir (chaque fonction verifie le role avant d'afficher quoi que ce soit).
//
// Rien ne s'efface jamais tout seul : une absence terminee reste dans l'historique.
// Les seances annulees deduites sont comptees automatiquement (aucun stockage de plus).

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
  if (e === 'a_venir') return 'a venir';
  return 'terminee';
}
function histoSeancesDeLAbsence(idAbsence) {
  try {
    return seancesAnnuleesParAbsence().filter(function (sn) { return '' + sn.idAbsence === '' + idAbsence; });
  } catch (e) { return []; }
}
function histoJours(a) {
  const d1 = new Date(String(a.debut) + 'T12:00:00');
  const d2 = new Date(String(a.fin || a.debut) + 'T12:00:00');
  const n = Math.round((d2 - d1) / 86400000) + 1;
  return n > 0 ? n : 1;
}

// ---- l'ecran ----
function ouvrirHistoriquePersonnel() {
  if (!histoEstDirecteur()) { afficherToast('Ecran reserve au directeur', 'error'); return; }
  let ov = document.getElementById('modal-histo-personnel');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'modal-histo-personnel';
    ov.className = 'modal-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;';
    ov.innerHTML =
      '<div class="modal-content" style="width:100%;max-height:92vh;overflow:auto;background:#ffffff;border-radius:22px 22px 0 0;padding:16px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
          '<h2 style="font-weight:800;font-size:18px;">Historique des absences du personnel</h2>' +
          '<button onclick="fermerHistoriquePersonnel()" style="font-size:24px;line-height:1;color:#94a3b8;">&times;</button>' +
        '</div>' +
        '<div id="histo-filtres" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;"></div>' +
        '<div id="histo-totaux" style="margin-bottom:10px;"></div>' +
        '<div id="histo-liste"></div>' +
      '</div>';
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  const f = document.getElementById('histo-filtres');
  if (f && !f.dataset.pret) {
    f.dataset.pret = '1';
    f.innerHTML =
      '<select id="histo-role" onchange="afficherHistoriquePersonnel()" class="form-input" style="flex:1;min-width:130px;">' +
        '<option value="">Tous les roles</option><option value="enseignant">Enseignants</option><option value="surveillant">Surveillants</option></select>' +
      '<select id="histo-personne" onchange="afficherHistoriquePersonnel()" class="form-input" style="flex:1;min-width:130px;"></select>' +
      '<select id="histo-etat" onchange="afficherHistoriquePersonnel()" class="form-input" style="flex:1;min-width:130px;">' +
        '<option value="">Tous les etats</option><option value="en_cours">En cours</option>' +
        '<option value="terminee">Terminees</option><option value="a_venir">A venir</option></select>' +
      '<select id="histo-periode" onchange="afficherHistoriquePersonnel()" class="form-input" style="flex:1;min-width:130px;">' +
        '<option value="">Toute la periode</option><option value="mois">Ce mois</option><option value="semestre">Ce semestre</option></select>';
  }
  afficherHistoriquePersonnel();
}
function fermerHistoriquePersonnel() {
  const ov = document.getElementById('modal-histo-personnel');
  if (ov) ov.style.display = 'none';
}

function afficherHistoriquePersonnel() {
  if (!histoEstDirecteur()) return;
  const lire = function (id, def) { const e = document.getElementById(id); return e ? e.value : def; };
  const role = lire('histo-role', '');
  const personne = lire('histo-personne', '');
  const etat = lire('histo-etat', '');
  const periode = lire('histo-periode', '');

  // la liste des personnes (pour le filtre) : tous les profils du personnel connus
  const personneSel = document.getElementById('histo-personne');
  if (personneSel && personneSel.options.length < 2) {
    const codes = {};
    (indispoProfs || []).forEach(function (i) { codes[String(i.profCode)] = roleAbsence(i); });
    const garde = personneSel.value;
    personneSel.innerHTML = '<option value="">Toutes les personnes</option>';
    Object.keys(codes).sort().forEach(function (c) {
      const o = document.createElement('option');
      o.value = c; o.textContent = histoNomPersonne(c);
      personneSel.appendChild(o);
    });
    if (garde) personneSel.value = garde;
  }

  // la periode
  let debut = '0000-01-01', fin = '9999-12-31';
  try {
    if (periode === 'mois') { const auj = fmtDateISO(new Date()); debut = auj.slice(0, 7) + '-01'; const d = new Date(auj); fin = fmtDateISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
    else if (periode === 'semestre' && typeof bornesSemestreCourant === 'function') { const b = bornesSemestreCourant(); debut = b.debut; fin = b.fin; }
  } catch (e) {}

  // la liste, du plus recent au plus ancien
  const lignes = (indispoProfs || []).filter(function (a) {
    if (role && roleAbsence(a) !== role) return false;
    if (personne && String(a.profCode) !== personne) return false;
    if (etat && histoEtat(a) !== etat) return false;
    const f = String(a.fin || a.debut);
    return !(f < debut || String(a.debut) > fin);
  }).sort(function (x, y) { return String(y.debut).localeCompare(String(x.debut)); });

  const cont = document.getElementById('histo-liste');
  const tot = document.getElementById('histo-totaux');
  if (!cont) return;
  if (!lignes.length) {
    cont.innerHTML = '<p style="text-align:center;color:#64748b;padding:14px;">Aucune absence sur cette periode.</p>';
  } else {
    cont.innerHTML = '';
    lignes.forEach(function (a) {
      const sn = histoSeancesDeLAbsence(a.id);
      const et = histoEtat(a);
      const couleur = et === 'en_cours' ? '#ef4444' : (et === 'a_venir' ? '#f59e0b' : '#64748b');
      const carte = document.createElement('div');
      carte.style.cssText = 'border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-bottom:8px;';
      carte.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
          '<b style="font-size:15px;">' + histoNomPersonne(a.profCode) + '</b>' +
          '<span style="font-size:11px;font-weight:700;color:' + couleur + ';border:1px solid ' + couleur + ';border-radius:999px;padding:2px 8px;">' +
            histoLibelleEtat(et) + '</span>' +
        '</div>' +
        '<div style="font-size:13px;color:#334155;margin-top:4px;">' +
          dateAffichage(a.debut) + ' &rarr; ' + dateAffichage(a.fin || a.debut) +
          ' &middot; ' + histoJours(a) + ' jour(s) &middot; ' + (a.portee === 'matin' ? 'matin' : (a.portee === 'apres-midi' ? 'apres-midi' : 'journee')) +
        '</div>' +
        '<div style="font-size:13px;color:#334155;margin-top:2px;">' +
          (String(roleAbsence(a)) === 'surveillant' ? 'Surveillant' : 'Enseignant') +
          ' &middot; ' + (a.motif || 'Absence') +
          (a.par ? ' &middot; declare par ' + a.par : '') +
        '</div>' +
        (sn.length ? '<div style="font-size:12px;color:#475569;margin-top:6px;">Seances annulees : ' + sn.length + '</div>' : '');
      cont.appendChild(carte);
    });
  }

  // les totaux par personne (ce qu'on demande pour justifier un service)
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
      ? '<div style="background:#f1f5f9;border-radius:12px;padding:8px 10px;font-size:12px;color:#334155;">' +
        '<b>Totaux</b> &middot; ' + lignes.length + ' absence(s)<br>' +
        noms.map(function (n) {
          return n + ' : ' + par[n].absences + ' absence(s), ' + par[n].jours + ' jour(s)' +
            (par[n].seances ? ', ' + par[n].seances + ' seance(s) annulee(s)' : '');
        }).join('<br>') + '</div>'
      : '';
  }
}

// ---- le bouton, dans l'espace du directeur uniquement ----
function installerBoutonHistoriquePersonnel() {
  if (!histoEstDirecteur()) return;
  if (document.getElementById('btn-histo-personnel')) return;
  const ancre = document.getElementById('indispo-liste');
  if (!ancre || !ancre.parentNode) return;
  const b = document.createElement('button');
  b.id = 'btn-histo-personnel';
  b.type = 'button';
  b.className = 'btn-secondary w-full mt-3';
  b.innerHTML = '<i class="fas fa-clock-rotate-left"></i> Historique des absences du personnel';
  b.onclick = ouvrirHistoriquePersonnel;
  ancre.parentNode.insertBefore(b, ancre.nextSibling);
}

if (typeof window !== 'undefined') {
  window.ouvrirHistoriquePersonnel = ouvrirHistoriquePersonnel;
  window.fermerHistoriquePersonnel = fermerHistoriquePersonnel;
  window.afficherHistoriquePersonnel = afficherHistoriquePersonnel;
  window.installerBoutonHistoriquePersonnel = installerBoutonHistoriquePersonnel;
}
