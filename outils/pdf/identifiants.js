// ============================================================================
// Identifiants de connexion des enseignants — generation + PDF (pdf-lib)
// SOURCE DE VERITE : teste seul (Node), puis recopie tel quel dans l'application.
//
// pdf-lib (et non jsPDF) : jsPDF n'arrive pas a exploiter ces polices arabes
// (metadonnees de police vides -> texte illisible). pdf-lib utilise fontkit,
// un vrai analyseur de polices : verifie, l'arabe sort correct.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Abreviation de la matiere (MEME regle que abrevMatiere() de l'application)
// ---------------------------------------------------------------------------
function abrevMatiere(m) {
  if (!m) return '-';
  const t = String(m).trim();
  const s = t.toLowerCase();
  if (s.indexOf('math') >= 0) return 'MATH';
  if (s.indexOf('physique') >= 0 || s === 'pc') return 'PC';
  if (s.indexOf('fran') >= 0) return 'FR';
  if (s.indexOf('arabe') >= 0 || s === 'ar') return 'AR';
  if (s.indexOf('svt') >= 0 || s.indexOf('science') >= 0) return 'SVT';
  if (s.indexOf('anglais') >= 0) return 'ANG';
  if (s.indexOf('histoire') >= 0 || s.indexOf('gé') >= 0) return 'HG';
  if (s.indexOf('philo') >= 0) return 'PHILO';
  if (s.indexOf('islam') >= 0 || s.indexOf('ducation') >= 0) return 'EI';
  if (s.indexOf('eps') >= 0 || s.indexOf('sport') >= 0) return 'EPS';
  if (s.indexOf('info') >= 0) return 'INFO';
  return t.toUpperCase();
}

// ---------------------------------------------------------------------------
// 2. Mot de passe : 8 caracteres, lettres + chiffres, au moins une lettre et un
//    chiffre, aucun caractere special (regle de l'application).
//    I, l, O et 0 sont exclus : on les confond en recopiant depuis un papier.
// ---------------------------------------------------------------------------
const MDP_LETTRES = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const MDP_CHIFFRES = '23456789';

function validerMotDePasseGenere(mdp) {
  if (!mdp || mdp.length < 6) return false;
  if (!/[a-zA-Z]/.test(mdp)) return false;
  if (!/[0-9]/.test(mdp)) return false;
  if (/[^a-zA-Z0-9]/.test(mdp)) return false;
  return true;
}

function genererMotDePasse(taille, aleatoire) {
  const t = taille || 8;
  const rnd = aleatoire || Math.random;
  for (let essai = 0; essai < 50; essai++) {
    const car = [MDP_LETTRES[Math.floor(rnd() * MDP_LETTRES.length)],
                 MDP_CHIFFRES[Math.floor(rnd() * MDP_CHIFFRES.length)]];
    const alphabet = MDP_LETTRES + MDP_CHIFFRES;
    while (car.length < t) car.push(alphabet[Math.floor(rnd() * alphabet.length)]);
    for (let i = car.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = car[i]; car[i] = car[j]; car[j] = tmp;
    }
    const mdp = car.join('');
    if (validerMotDePasseGenere(mdp)) return mdp;
  }
  return null;
}

// Un mot de passe est repris tel quel seulement s'il respecte la regle de
// l'application (>= 6 caracteres, au moins une lettre, au moins un chiffre,
// aucun caractere special). Sinon il est regenere : les identifiants de
// demonstration (mot de passe « 12345 ») ne doivent pas partir dans le PDF.
function motDePasseAcceptable(mdp) {
  return !!mdp && mdp.length >= 6 && /[a-zA-Z]/.test(mdp) && /[0-9]/.test(mdp) && !/[^a-zA-Z0-9]/.test(mdp);
}

// L'email suit la convention générale : {préfixe}[-prof]{numéro}@taalim.ma
// (enseignants : math-prof1@taalim.ma · surveillants : surv1@taalim.ma)
function emailIdentifiantConforme(mail) {
  return !!mail && /^[a-z]+(-prof)?\d+@taalim\.ma$/.test(String(mail).toLowerCase());
}

// Convention EXACTE attendue pour une personne donnée : c'est elle qui décide si
// l'email déjà en place peut être conservé (il ne doit jamais être réattribué).
//   abréviation 'MATH' + séparateur '-prof' -> math-prof1@taalim.ma
//   abréviation 'surv' + séparateur ''      -> surv1@taalim.ma
function emailConformePour(mail, abreviation, separateur) {
  if (!mail || !abreviation) return false;
  const sep = (separateur === undefined ? '-prof' : String(separateur)).replace(/[-]/g, '\\-');
  return new RegExp('^' + String(abreviation).toLowerCase() + sep + '\\d+@taalim\\.ma$')
    .test(String(mail).toLowerCase());
}

// ---------------------------------------------------------------------------
// 3. Generation des identifiants
//    - email : {abreviation minuscule}-prof{n}@taalim.ma
//      n evite tout email deja pris : Supabase refuse deux comptes avec le
//      meme email, et un email ne doit JAMAIS etre reattribue.
//    - un mot de passe different par enseignant.
// ---------------------------------------------------------------------------
const DOMAINE_IDENTIFIANTS = '@taalim.ma';

function genererIdentifiants(enseignants, emailsPris, aleatoire) {
  // Les emails DES ENSEIGNANTS DE LA LISTE ne doivent pas etre comptes comme « deja
  // pris » : sinon on leur en fabriquerait un nouveau a chaque passage (l'appelant
  // transmet naturellement la liste complete des emails de l'etablissement).
  const abDe = ens => ens.abreviation || abrevMatiere(ens.matiere);
  const sepDe = ens => (ens.separateur === undefined ? '-prof' : String(ens.separateur));
  const propres = {};
  (enseignants || []).forEach(e => {
    if (emailConformePour(e.email, abDe(e), sepDe(e))) propres[String(e.email).toLowerCase()] = true;
  });
  const pris = {};
  (emailsPris || []).forEach(e => {
    if (!e) return;
    const cle = String(e).toLowerCase();
    if (propres[cle]) return;               // c'est l'email d'un enseignant de la liste : il lui reste acquis
    pris[cle] = true;
  });
  const compteurs = {};
  const sortie = [];

  (enseignants || []).forEach(ens => {
    const ab = abDe(ens);
    const separateur = sepDe(ens);            // '' pour les surveillants, '-prof' sinon
    let email = ens.email;
    let nouveau = false;

    // REGLE D'OR : un email deja attribue ET conforme a la convention de cette
    // personne ne change jamais (Supabase refuse deux comptes avec le meme email,
    // et des identifiants deja distribues cesseraient de fonctionner).
    if (!emailConformePour(email, ab, separateur) || pris[String(email).toLowerCase()]) {
      let n = compteurs[ab] || 0;
      do {
        n++;
        email = ab.toLowerCase() + separateur + n + DOMAINE_IDENTIFIANTS;
      } while (pris[email.toLowerCase()]);
      compteurs[ab] = n;
      nouveau = true;
    } else {
      // on compte cet email pour que les suivants du meme préfixe prennent le numéro d'après
      const num = String(email).toLowerCase().match(/(\d+)@taalim\.ma$/);
      if (num) compteurs[ab] = Math.max(compteurs[ab] || 0, parseInt(num[1], 10));
    }
    pris[String(email).toLowerCase()] = true;

    // mot de passe : conserve s'il est valable, sinon regenere (8 caracteres)
    const mdp = motDePasseAcceptable(ens.password) ? ens.password : genererMotDePasse(8, aleatoire);
    if (mdp !== ens.password) nouveau = true;

    sortie.push({ nom: ens.nom, matiere: ens.matiere, abreviation: ab, separateur: separateur,
                  email: email, password: mdp, nouveau: nouveau });
  });

  // un mot de passe ne doit jamais etre partage par deux enseignants
  const vus = {};
  sortie.forEach(l => {
    if (!l.password) return;
    let garde = 0;
    while (vus[l.password] && garde < 50) { l.password = genererMotDePasse(8, aleatoire); garde++; }
    vus[l.password] = true;
  });
  return sortie;
}

// Une personne peut s'appeler en arabe (سامية الحاضي) ou en latin (Samia El Hadi,
// « Surveillant 1 »). La police arabe ne contient PAS les lettres latines : dessinees
// avec elle, elles sortent en carres vides. On choisit donc la police selon le texte.
function policePourNom(texte) {
  return /[\u0600-\u06FF]/.test(String(texte || '')) ? 'arabe' : 'latin';
}

// ---------------------------------------------------------------------------
// 4. Le PDF — un tableau par section (« Surveillants », « Enseignants »…)
//    pdf-lib travaille en points (1 mm = 2,8346 pt) et son origine est en BAS
//    a GAUCHE : d'ou la conversion _yBas().
//    sections = [{ titre: 'Surveillants', lignes: [{nom, email, password}, …] }, …]
//    Une section vide est ignoree ; on passe a la page suivante si besoin.
// ---------------------------------------------------------------------------
const PT = 2.83465;                        // mm -> points
const PDF_MM = { largeur: 210, hauteur: 297, marge: 12 };
const PDF_COLS = [66, 72, 48];             // mm — total 186
const PDF_LIGNE_MM = 10;
const PDF_SECTION_MM = 9;                  // hauteur du titre d'une section

function _colX() {
  const x = [PDF_MM.marge];
  PDF_COLS.forEach(l => x.push(x[x.length - 1] + l * PT));
  return x;
}
function _yBas(yHautMm, hauteurMm) {
  return (PDF_MM.hauteur - yHautMm - hauteurMm) * PT;
}

async function construirePdfIdentifiants(PDFLib, PDFDocument, fontkit, octetsPolice, sections, infos) {
  const i = infos || {};
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fNom = await doc.embedFont(octetsPolice, { subset: false });
  const fGras = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const fTexte = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const fMono = await doc.embedFont(PDFLib.StandardFonts.CourierBold);
  const noir = PDFLib.rgb(0.12, 0.12, 0.12);
  const gris = PDFLib.rgb(0.4, 0.4, 0.4);
  const nuit = PDFLib.rgb(0.149, 0.224, 0.353);   // #26395A
  const blanc = PDFLib.rgb(1, 1, 1);
  const bordure = PDFLib.rgb(0.82, 0.85, 0.88);

  let page = doc.addPage([PDF_MM.largeur * PT, PDF_MM.hauteur * PT]);
  let y = PDF_MM.marge;                      // y = haut de la ligne courante (en mm)
  const centre = (PDF_MM.largeur / 2) * PT;
  const T = t => String(t == null ? '' : t);
  const largeurTexte = (t, police, taille) => police.widthOfTextAtSize(T(t), taille);
  const centrer = (t, police, taille) => centre - largeurTexte(t, police, taille) / 2;
  // passe a la page suivante s'il ne reste pas la place voulue
  const besoin = hauteurMm => {
    if (y + hauteurMm > PDF_MM.hauteur - PDF_MM.marge) {
      page = doc.addPage([PDF_MM.largeur * PT, PDF_MM.hauteur * PT]);
      y = PDF_MM.marge;
    }
  };

  // --- titre ---
  page.drawText(T('Identifiants de connexion - AbsenceTrack'),
                { x: centrer('Identifiants de connexion - AbsenceTrack', fGras, 15),
                  y: _yBas(y, 4) + 4, size: 15, font: fGras, color: nuit });
  y += 9;

  // --- etablissement (arabe, mis en forme a la main) ---
  if (i.etablissement) {
    const ar = policePourNom(i.etablissement) === 'arabe';
    const t = ar ? formeArabe(i.etablissement) : T(i.etablissement);
    const p = ar ? fNom : fTexte;
    page.drawText(t, { x: centrer(t, p, 12), y: _yBas(y, 4.2) + 4, size: 12, font: p, color: gris });
    y += 8;
  }

  // --- sous-titre ---
  const soustitre = 'Annee scolaire ' + T(i.annee) + ' - document a remettre a chaque personne';
  page.drawText(soustitre, { x: centrer(soustitre, fTexte, 10), y: _yBas(y, 3.5) + 3.5,
                             size: 10, font: fTexte, color: gris });
  y += 10;

  const x = _colX();
  const entetes = ['Nom', 'Email de connexion', 'Mot de passe'];

  (sections || []).forEach(section => {
    if (!section || !section.lignes || !section.lignes.length) return;
    besoin(PDF_SECTION_MM + PDF_LIGNE_MM + 6);

    // --- titre de la section ---
    page.drawText(T(section.titre), { x: PDF_MM.marge * PT, y: _yBas(y, 3.5) + 3.5,
                                      size: 11.5, font: fGras, color: nuit });
    y += 6;
    page.drawLine({ start: { x: PDF_MM.marge * PT, y: _yBas(y, 0) }, end: { x: (PDF_MM.largeur - PDF_MM.marge) * PT, y: _yBas(y, 0) },
                    thickness: 0.8, color: nuit });
    y += 3;

    // --- en-tete du tableau ---
    for (let c = 0; c < 3; c++) {
      page.drawRectangle({ x: x[c], y: _yBas(y, PDF_LIGNE_MM), width: PDF_COLS[c] * PT,
                           height: PDF_LIGNE_MM * PT, color: nuit });
      const l = largeurTexte(entetes[c], fGras, 10.5);
      page.drawText(entetes[c], { x: x[c] + (PDF_COLS[c] * PT - l) / 2,
                                  y: _yBas(y, PDF_LIGNE_MM) + PDF_LIGNE_MM * PT / 2 - 3.4,
                                  size: 10.5, font: fGras, color: blanc });
    }
    y += PDF_LIGNE_MM;

    // --- lignes ---
    section.lignes.forEach((l, n) => {
      besoin(PDF_LIGNE_MM);
      const fond = (n % 2 === 1) ? PDFLib.rgb(0.957, 0.965, 0.98) : blanc;
      for (let c = 0; c < 3; c++) {
        page.drawRectangle({ x: x[c], y: _yBas(y, PDF_LIGNE_MM), width: PDF_COLS[c] * PT,
                             height: PDF_LIGNE_MM * PT, color: fond,
                             borderColor: bordure, borderWidth: 0.5 });
      }
      const milieu = _yBas(y, PDF_LIGNE_MM) + PDF_LIGNE_MM * PT / 2 - 4;
      // nom : police arabe si le nom est en arabe, sinon police latine (aligne a droite)
      const enArabe = policePourNom(l.nom) === 'arabe';
      const policeNom = enArabe ? fNom : fTexte;
      const nom = enArabe ? formeArabe(T(l.nom)) : T(l.nom);
      page.drawText(nom, { x: x[1] - 6 - largeurTexte(nom, policeNom, 12), y: milieu, size: 12,
                           font: policeNom, color: noir });
      // email (latin, aligne a gauche)
      page.drawText(T(l.email), { x: x[1] + 6, y: milieu, size: 10.5, font: fTexte, color: noir });
      // mot de passe (chasse fixe, centre)
      const mdp = T(l.password);
      page.drawText(mdp, { x: x[2] + (PDF_COLS[2] * PT - largeurTexte(mdp, fMono, 11.5)) / 2,
                           y: milieu, size: 11.5, font: fMono, color: noir });
      y += PDF_LIGNE_MM;
    });

    y += 6;                                  // respiration entre les sections
  });

  // --- pied ---
  besoin(10);
  const pied = 'Document confidentiel - ' + T(i.date) +
               ' - chaque personne change son mot de passe dans Profil.';
  page.drawText(pied, { x: centrer(pied, fTexte, 9), y: _yBas(y, 4), size: 9,
                        font: fTexte, color: gris });
  return doc;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { abrevMatiere, genererMotDePasse, genererIdentifiants,
                     construirePdfIdentifiants, validerMotDePasseGenere,
                     motDePasseAcceptable, emailIdentifiantConforme, emailConformePour,
                     policePourNom };
}
