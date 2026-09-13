// test_identifiants.js — tests de la generation des identifiants (hors PDF) :
// regle d'or sur les emails, mots de passe, unicite, numerotation par matiere.
const fs = require('fs');
(0, eval)(fs.readFileSync(__dirname + '/fixtures/_arabe_fn.js', 'utf8'));
const id = require('../outils/pdf/identifiants.js');

let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

let graine = 42;
const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };

// ---------- 1. cas nominal : des enseignants sans email ----------
const neufs = [
  { nom: 'Prof Maths', matiere: 'Maths' },
  { nom: 'Prof Maths 2', matiere: 'Maths' },
  { nom: 'Prof PC', matiere: 'PC' },
  { nom: 'Prof EPS', matiere: 'EPS' }
];
let lignes = id.genererIdentifiants(neufs, [], alea);
t('emails engendrés dans l ordre des matières',
  lignes.map(l => l.email).join(' ') === 'math-prof1@taalim.ma math-prof2@taalim.ma pc-prof1@taalim.ma eps-prof1@taalim.ma',
  lignes.map(l => l.email).join(' '));
t('les enseignants sans identifiant sont marqués « nouveau »', lignes.every(l => l.nouveau));
t('mots de passe de 8 caractères', lignes.every(l => /^[a-zA-Z0-9]{8}$/.test(l.password)));
t('mots de passe acceptés par la règle de l application', lignes.every(l => id.validerMotDePasseGenere(l.password)));
t('mots de passe tous différents', new Set(lignes.map(l => l.password)).size === lignes.length);

// ---------- 2. emails déjà pris ailleurs : la numerotation tient compte ----------
lignes = id.genererIdentifiants([{ nom: 'Nouveau', matiere: 'Maths' }], ['math-prof1@taalim.ma', 'math-prof2@taalim.ma'], alea);
t('numérotation reprend après les emails déjà pris', lignes[0].email === 'math-prof3@taalim.ma', lignes[0].email);

// ---------- 3. REGLE D'OR : un email conforme ne change pas ----------
const existants = [
  { nom: 'Samia', matiere: 'Français', email: 'fr-prof1@taalim.ma', password: 'K7m2Qp4b' },
  { nom: 'Ayoub', matiere: 'Maths', email: 'math-prof1@taalim.ma', password: 'Xy3Wq9Zt' }
];
lignes = id.genererIdentifiants(existants, [], alea);
t('email existant conservé', lignes[0].email === 'fr-prof1@taalim.ma' && lignes[1].email === 'math-prof1@taalim.ma',
  lignes.map(l => l.email).join(' '));
t('mot de passe valable conservé', lignes[0].password === 'K7m2Qp4b' && lignes[1].password === 'Xy3Wq9Zt');
t('rien marqué « nouveau »', lignes.every(l => !l.nouveau));

// ---------- 3 bis. l'appelant transmet TOUS les emails de l'établissement ----------
lignes = id.genererIdentifiants(
  [{ nom: 'Samia', matiere: 'Français', email: 'fr-prof1@taalim.ma', password: 'K7m2Qp4b' },
   { nom: 'Nouveau', matiere: 'Français' }],
  ['fr-prof1@taalim.ma', 'math-prof1@taalim.ma', 's1@taalim.ma', 's2@taalim.ma', 'd@taalim.ma'], alea);
t('email propre conservé même s il figure dans la liste des emails pris', lignes[0].email === 'fr-prof1@taalim.ma', lignes[0].email);
t('le nouvel enseignant prend le numéro suivant', lignes[1].email === 'fr-prof2@taalim.ma', lignes[1].email);

// ---------- 4. mot de passe de démonstration (« 12345 ») régénéré ----------
lignes = id.genererIdentifiants([{ nom: 'Test', matiere: 'SVT', email: 'svt-prof1@taalim.ma', password: '12345' }], [], alea);
t('mot de passe trop court régénéré', lignes[0].password !== '12345' && lignes[0].password.length === 8, lignes[0].password);
t('email conservé malgré la régénération du mot de passe', lignes[0].email === 'svt-prof1@taalim.ma');
t('marqué « nouveau » (le mot de passe a changé)', lignes[0].nouveau === true);
lignes = id.genererIdentifiants([{ nom: 'Test', matiere: 'SVT', email: 'svt-prof1@taalim.ma', password: 'abc$12!' }], [], alea);
t('mot de passe avec caractère spécial régénéré', /^[a-zA-Z0-9]{8}$/.test(lignes[0].password), lignes[0].password);
lignes = id.genererIdentifiants([{ nom: 'Test', matiere: 'SVT', email: 'svt-prof1@taalim.ma', password: 'abcdefgh' }], [], alea);
t('mot de passe sans chiffre régénéré', /[0-9]/.test(lignes[0].password), lignes[0].password);

// ---------- 5. email non conforme remplacé ----------
lignes = id.genererIdentifiants([{ nom: 'X', matiere: 'Anglais', email: 'x@autre.domaine.ma', password: 'Ab12Cd34' }], [], alea);
t('email hors convention remplacé', lignes[0].email === 'ang-prof1@taalim.ma', lignes[0].email);
t('mot de passe valable conservé malgré le changement d email', lignes[0].password === 'Ab12Cd34');

// ---------- 6. deux enseignants de même matière déjà numérotés ----------
const deux = id.genererIdentifiants([
  { nom: 'A', matiere: 'PC', email: 'pc-prof2@taalim.ma', password: 'Ab12Cd34' },
  { nom: 'B', matiere: 'PC' }
], [], alea);
t('le nouveau prend le numéro suivant, sans collision', deux[1].email === 'pc-prof3@taalim.ma', deux[1].email);

// ---------- 7. stabilité : deux passages donnent le même résultat ----------
const une = id.genererIdentifiants(neufs, [], alea);
const deuxFois = id.genererIdentifiants(une.map(l => ({ nom: l.nom, matiere: l.matiere, email: l.email, password: l.password })), [], alea);
t('un second passage ne change rien (stabilité des identifiants)',
  une.every((l, i) => l.email === deuxFois[i].email && l.password === deuxFois[i].password));

// ---------- 7 bis. surveillants : abréviation explicite ----------
const surv = id.genererIdentifiants([
  { nom: 'Surveillant 1', role: 'surveillant', abreviation: 'surv', separateur: '' },
  { nom: 'Surveillant 2', role: 'surveillant', abreviation: 'surv', separateur: '' }
], [], alea);
t('emails des surveillants en surv1@ / surv2@',
  surv.map(l => l.email).join(' ') === 'surv1@taalim.ma surv2@taalim.ma', surv.map(l => l.email).join(' '));
t('mots de passe des surveillants conformes',
  surv.every(l => /^[a-zA-Z0-9]{8}$/.test(l.password)) && surv[0].password !== surv[1].password);
// surveillants + enseignants dans le meme passage : aucun melange de numerotation
const melange = id.genererIdentifiants([
  { nom: 'S1', abreviation: 'surv', separateur: '' },
  { nom: 'Maths', matiere: 'Maths' },
  { nom: 'S2', abreviation: 'surv', separateur: '' }
], [], alea);
t('numérotation indépendante par préfixe',
  melange.map(l => l.email).join(' ') === 'surv1@taalim.ma math-prof1@taalim.ma surv2@taalim.ma',
  melange.map(l => l.email).join(' '));
t('un email de surveillant déjà attribué est conservé',
  id.genererIdentifiants([{ nom: 'S1', abreviation: 'surv', separateur: '', email: 'surv1@taalim.ma', password: 'K7m2Qp4b' }],
    ['surv1@taalim.ma'], alea)[0].email === 'surv1@taalim.ma');
t('un email de démonstration (s1@) est remplacé par la convention surv1@',
  id.genererIdentifiants([{ nom: 'Surveillant 1', abreviation: 'surv', separateur: '', email: 's1@taalim.ma', password: 'K7m2Qp4b' }],
    ['s1@taalim.ma'], alea)[0].email === 'surv1@taalim.ma');
t('emailConformePour distingue les deux conventions',
  id.emailConformePour('math-prof1@taalim.ma', 'MATH', '-prof') === true &&
  id.emailConformePour('math-prof1@taalim.ma', 'surv', '') === false &&
  id.emailConformePour('surv2@taalim.ma', 'surv', '') === true &&
  id.emailConformePour('s1@taalim.ma', 'surv', '') === false);

// ---------- 7 ter. choix de la police selon le nom (arabe / latin) ----------
t('police arabe pour un nom arabe', id.policePourNom('سامية الحاضي') === 'arabe');
t('police latine pour un nom en latin', id.policePourNom('Surveillant 1') === 'latine' || id.policePourNom('Surveillant 1') === 'latin',
  id.policePourNom('Surveillant 1'));
t('police latine pour un nom français', id.policePourNom('Samia El Hadi') === 'latin');
t('police latine si le nom est vide', id.policePourNom('') === 'latin');

// ---------- 8. abréviations des matières ----------
t('abréviations conformes',
  id.abrevMatiere('Maths') === 'MATH' && id.abrevMatiere('PC') === 'PC' && id.abrevMatiere('SVT') === 'SVT' &&
  id.abrevMatiere('Français') === 'FR' && id.abrevMatiere('Anglais') === 'ANG' && id.abrevMatiere('Arabe') === 'AR' &&
  id.abrevMatiere('EPS') === 'EPS' && id.abrevMatiere('Informatique') === 'INFO' &&
  id.abrevMatiere('Philo') === 'PHILO' && id.abrevMatiere('Éduc. islamique') === 'EI' && id.abrevMatiere('Hist-Géo') === 'HG');

console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
process.exit(ok ? 0 : 1);
