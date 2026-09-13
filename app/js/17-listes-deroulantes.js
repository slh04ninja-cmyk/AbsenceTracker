// fichier: app/js/17-listes-deroulantes.js
// ========== LISTES DEROULANTES PERSONNALISEES ==========
function sdOptionCourante(select) { return select.options[select.selectedIndex] || null; }

function sdMajLibelle(conteneur) {
  const select = conteneur.querySelector('select');
  const bouton = conteneur.querySelector('.sd-trigger');
  const span = conteneur.querySelector('.sd-trigger > span');
  if (!select || !bouton || !span) return;
  const opt = sdOptionCourante(select);
  const texte = opt ? opt.textContent : '---';
  if (span.textContent !== texte) span.textContent = texte;
  if (bouton.disabled !== !!select.disabled) bouton.disabled = !!select.disabled;
  const desactive = select.disabled ? '0.55' : '1';
  if (bouton.style.opacity !== desactive) bouton.style.opacity = desactive;
}

function sdRafraichirTout() {
  const tous = document.querySelectorAll('.sd');
  for (let i = 0; i < tous.length; i++) sdMajLibelle(tous[i]);
}

function sdFermerTout() {
  const ouverts = document.querySelectorAll('.sd.ouvert');
  for (let i = 0; i < ouverts.length; i++) ouverts[i].classList.remove('ouvert');
  sdRafraichirTout();
}

function sdConstruireOptions(conteneur) {
  const select = conteneur.querySelector('select');
  const panneau = conteneur.querySelector('.sd-panel');
  panneau.innerHTML = '';
  Array.prototype.forEach.call(select.options, function (opt, index) {
    const ligne = document.createElement('div');
    ligne.className = 'sd-option' + (index === select.selectedIndex ? ' actif' : '') + (opt.value === '' ? ' vide' : '');
    ligne.innerHTML = '<span>' + opt.textContent + '</span><i class="fas fa-check"></i>';
    ligne.addEventListener('click', function (ev) {
      ev.stopPropagation();
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sdFermerTout();
      sdMajLibelle(conteneur);
    });
    panneau.appendChild(ligne);
  });
  const actif = panneau.querySelector('.sd-option.actif');
  if (actif && actif.scrollIntoView) { try { actif.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
}

// Place la liste : en dessous s'il y a la place, sinon AU-DESSUS (jamais cachee sous les boutons).
function sdPlacer(conteneur) {
  const panneau = conteneur.querySelector('.sd-panel');
  const bouton = conteneur.querySelector('.sd-trigger');
  if (!panneau || !bouton) return;
  conteneur.classList.remove('sd-haut');
  panneau.style.maxHeight = '';
  const rb = bouton.getBoundingClientRect ? bouton.getBoundingClientRect() : null;
  if (!rb || (!rb.top && !rb.bottom)) return;          // pas de geometrie (tests jsdom) : on ne touche a rien
  const marge = 12;
  const hauteurVoulue = Math.min(panneau.scrollHeight || 264, 264);
  // limite visible : le premier ancetre qui defile (corps du formulaire), sinon la fenetre
  let bas = window.innerHeight || 800, haut = 0, zone = conteneur.parentElement;
  while (zone) {
    const st = window.getComputedStyle(zone);
    if (/(auto|scroll)/.test(st.overflowY)) {
      const rz = zone.getBoundingClientRect();
      bas = Math.min(bas, rz.bottom);
      haut = Math.max(haut, rz.top);
      break;
    }
    zone = zone.parentElement;
  }
  const placeBas = bas - rb.bottom - marge;
  const placeHaut = rb.top - haut - marge;
  if (placeBas < hauteurVoulue && placeHaut > placeBas) {
    conteneur.classList.add('sd-haut');                 // les elements de menu glissent vers le haut
    panneau.style.maxHeight = Math.max(96, Math.min(hauteurVoulue, placeHaut)) + 'px';
  } else if (placeBas < hauteurVoulue) {
    panneau.style.maxHeight = Math.max(96, placeBas) + 'px';
  }
}

function sdBasculer(conteneur) {
  const etaitOuvert = conteneur.classList.contains('ouvert');
  sdFermerTout();
  if (etaitOuvert) return;
  sdMajLibelle(conteneur);
  sdConstruireOptions(conteneur);
  conteneur.classList.add('ouvert');
  sdPlacer(conteneur);                                  // <- place la liste (haut ou bas)
}

function initialiserListesDeroulantes() {
  const selects = document.querySelectorAll('select');
  Array.prototype.forEach.call(selects, function (select) {
    if (select.closest('.sd')) return;
    const conteneur = document.createElement('div');
    conteneur.className = 'sd' + (select.classList.contains('w-full') ? ' w-full' : '');
    select.parentNode.insertBefore(conteneur, select);
    conteneur.appendChild(select);

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'sd-trigger';
    bouton.innerHTML = '<span></span><i class="fas fa-chevron-down sd-fleche"></i>';
    conteneur.appendChild(bouton);

    const panneau = document.createElement('div');
    panneau.className = 'sd-panel';
    conteneur.appendChild(panneau);

    bouton.addEventListener('click', function (ev) { ev.stopPropagation(); sdBasculer(conteneur); });
    sdMajLibelle(conteneur);
  });
  document.addEventListener('click', sdFermerTout);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sdFermerTout(); });
  setInterval(sdRafraichirTout, 800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiserListesDeroulantes);
} else {
  initialiserListesDeroulantes();
}
