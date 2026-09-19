# AGENTS.md — AbsenceTrack

**À LIRE EN ENTIER AVANT LA PREMIÈRE MODIFICATION.** Ce fichier est écrit pour un agent
(ou un développeur) qui reprend le projet sans rien connaître de son histoire.
*(Il remplace et complète `CONTEXTE-AGENT.md`, qui ne fait plus que renvoyer ici.)*

---

## 0. La méthode de travail EXIGÉE par le propriétaire

Le propriétaire est **directeur d'établissement**, **pas développeur**. Ses exigences
(elles ont toutes été payées par des refus successifs — ne pas les redécouvrir) :

1. **AVANT toute modification : écrire la LISTE des changements** — fichier + fonction +
   comportement attendu, en points numérotés — **la lui faire VALIDER**, et seulement
   **APRÈS** coder. Il répond « vas y » / « valide ». Coder avant sa validation = travail refusé.
2. **Ne jamais annoncer une version sans l'avoir prouvée** (essai réel ou banc vert, sortie
   recopiée telle quelle). Pas de chiffre estimé : un chiffre non mesuré se dit « non disponible ».
3. **Un module qu'il déclare terminé est figé** : ne plus y toucher sans demande explicite.
4. **Toujours joindre le fichier livré** (`MEDIA:` du chemin de l'APK) quand une version est annoncée.
5. **Réponses courtes**, français, **sans jargon** ; dire **où appuyer** (nom du bouton, écran) ;
   **une décision à la fois**.
6. **Annoncer l'avancement** des longs travaux ; **ne pas demander la permission à chaque étape**
   (faire, puis rendre compte) — sauf pour **modifier du code** (règle 1).
7. Ses remarques (« ce bouton ne s'ouvre pas », « ça s'affiche encore ») **sont le travail** :
   ne pas les traiter comme du bruit, les mesurer par un banc avant de répondre.

## 1. Le projet en 6 lignes

Application Android (coquille **Capacitor**, `ma.absencetrack.app`) de suivi des absences
scolaires, contexte **MASSAR** marocain, interface **française**, destination : plusieurs
établissements. Trois rôles : **directeur**, **surveillant**, **enseignant**.
Le livrable applicatif est **un seul fichier HTML** construit depuis `app/`.
Les données de travail vivent sur une base **Supabase** (projet `AbsenceTrack2`) : elles sont
**montées** sur la base, l'app **relit la base**, et **chaque geste écrit tout de suite dans la base**.

## 2. Fichiers et rôles

| Chemin | Rôle |
|---|---|
| `app/index.html` | structure de l'écran + toutes les modales (`#modal-form`, `#modal-renommer`, `#modal-confirmation`) + l'étiquette de version |
| `app/js/00-noyau.js` … `app/js/23-historique.js` | **24 modules numérotés**, chargés dans l'ordre des `<script>` de `app/index.html`. La source de vérité, c'est `app/` |
| `app/styles/*.css` | thèmes **clair et sombre** (les règles ajoutées vont **en fin de feuille**) |
| `outils/build.py` | assemble `app/` → `AbsenceTrack-v2.html` + `dist/AbsenceTrack-vX.YY.html` |
| `AbsenceTrack-v2.html` | **PRODUIT** — ne **jamais** l'éditer à la main (la CI refuse une divergence) |
| `tests/test_*.js` | bancs **jsdom** : 49 suites. Ils lisent le livrable `AbsenceTrack-v2.html` |
| `outils/verif.py` | lance les suites : `rapide` (~20 s) ou `tout` (~11 min, 49 suites) |
| `outils/essai_*.js` | essais **réseau** contre la vraie base (montée, lecture, écriture, actions, dashboard) |
| `outils/sonde_annulations.py` · `outils/dump_base.py` · `outils/essai_dashboard_annulations.js` | vérifier que **la base dit la même chose que l'écran** |
| `android/` | projet Capacitor (génère l'APK via la CI) |
| `supabase/` | migrations SQL numérotées + outils de base (voir §4) |
| `.github/workflows/` | CI : construit `build.py`, signe l'APK, publie l'artefact |

Numérotation des modules utile : `05-formulaires` (les 5 fenêtres de saisie), `06-rh`,
`08-enseignant`, `09-stats`, `11-directeur`, `12-imports`, `13-fiches`, `18-connexion`,
`19-donnees` (montée), `20-ecole` (cloisonnement), `21-lire` (lecture base), `22-sync`
(écriture + rafraîchissement 5 s), `23-historique` (historique du personnel).

## 3. Construire, vérifier, livrer

```bash
cd ~/AbsenceTrack-v386            # worktree de travail (branche android-v4)

# 1) modifier app/, puis :
python3 outils/build.py            # écrit AbsenceTrack-v2.html + dist/…

# 2) vérifier : le livrable doit rester identique à app/ (la CI le rejoue)
python3 outils/verif.py rapide     # pendant l'itération
python3 outils/verif.py tout       # AVANT de livrer (49 suites, lire le compte d'échecs)

# 3) livrer
git add -A app outils tests AbsenceTrack-v2.html dist
git commit -m "vX.YY - ce qui change"
git push origin android-v4         # → la CI construit l'APK signé (~3 min)

# 4) récupérer l'APK et le poser où le propriétaire l'attend
gh run list --repo slh04ninja-cmyk/AbsenceTracker --branch android-v4 --limit 1 \
   --json databaseId --jq '.[0].databaseId'
gh run watch <ID> --repo slh04ninja-cmyk/AbsenceTracker --exit-status
gh run download <ID> --repo slh04ninja-cmyk/AbsenceTracker -D ~/apk-new
cp ~/apk-new/absencetrack-apk/app-release.apk /storage/emulated/0/Download/AbsenceTrack-vX.YY.apk
# vérifier la version À L'INTÉRIEUR de l'APK avant de l'annoncer :
unzip -p /storage/emulated/0/Download/AbsenceTrack-vX.YY.apk assets/public/index.html | grep -o "AbsenceTrack v[0-9.]*"
```

**Étiquette de version** : `app/index.html` (`AbsenceTrack vX.YY — Prototype`) — la changer,
puis `build.py`, puis **vérifier que le changement a bien mordu** (`grep -o 'AbsenceTrack vX.YY' AbsenceTrack-v2.html`).
Un `sed` d'étiquette qui rate en silence a déjà fait livrer une étiquette neuve avec l'ancien code.

**Piège du terminal** : toute commande contenant `&` est refusée (donc pas de `2>&1` dans une
longue chaîne `&&` : écrire `> /dev/null` ou enchaîner avec `|`). Les très longues commandes
d'une seule ligne sont aussi refusées : préférer plusieurs commandes courtes.

## 4. La base Supabase (`AbsenceTrack2`)

- Projet : ref **`fgrkjrttcbuflykligfw`**, URL `https://fgrkjrttcbuflykligfw.supabase.co`
- Connexion psql qui marche : `aws-1-eu-west-3.pooler.supabase.com:5432`, utilisateur
  `postgres.fgrkjrttcbuflykligfw`, `PGSSLMODE=require`.
  (l'hôte `db.<ref>.supabase.co` est **IPv6 seule** → injoignable depuis le téléphone)
- **Le mot de passe n'est PAS dans ce dépôt** (dépôt public). Sur la machine du propriétaire :
  `~/abs2/.mdp_base` (fichier local, chmod 600) ou la variable `ABS2_MDP`.
  En dernier recours : `session_search(query="PGPASSWORD pooler.supabase.com")`.
- La clé **publique** utilisée par l'app (`app/js/18-connexion.js`, `AT_CLE`) est publique **par
  nature** : elle n'ouvre que ce que les règles (RLS) autorisent.
- Migrations **rejouables** : `supabase/migrations/0001…0005*.sql`, appliquées par
  `python3 supabase/_creer_base.py` (idempotent, table de suivi `_migrations`, refuse qu'un
  fichier déjà appliqué soit modifié). `supabase/_verifier.sh` les rejoue sur un PostgreSQL local.
- Tables : `etablissements, classes, eleves, profils, seances, signalements, absences_personnel,
  annulations_seances, fermetures` (+ `_migrations`, 4 vues). Écriture = `est_directeur() AND meme_etab(...)`.
- **Méthode de vérification « la base dit-elle la même chose que l'écran ? »** :
  `outils/sonde_annulations.py` (lecture comme l'app), `outils/dump_base.py` (copie des tables en
  JSON), `outils/essai_dashboard_annulations.js` (l'app réelle + les données réelles → verdict).
- **L'établissement réel est en LECTURE SEULE.** Tout essai passe par une **école témoin**
  (`ECOLE-TEMOIN-*`) créée pour l'occasion, puis nettoyée.

## 5. Règles produit non négociables

- **Français**, et **aucun emoji dans l'interface** → icônes **Font Awesome**.
- Tout affichage suit **le mode clair ET le mode sombre** ; pas de couleur en dur ; réutiliser les
  classes existantes (`btn-fermer`, `carte-settings`, `carteLigne`, `motif-carte`…).
- **Ab = rouge `#ef4444`**, **Rd = orange `#f59e0b`** (couleurs sémantiques fixes).
- Un seul Ab/Rd **non justifié** par élève + jour + demi-journée ; retard > 30 min sans approbation → **absence**.
- **L'auteur d'une absence n'est jamais réécrit** ; toutes les comparaisons d'identité se font
  **par identifiant** (nom, code, adresse), **jamais** par nom réaffiché.
- L'enseignant peut cocher/décocher **tant que le créneau n'est pas terminé**.
  Approuver pendant le créneau → **décochage automatique** + carte **verte**.
- Le directeur/surveillant **approuve** ; le bouton « supprimer » ne sert qu'à **corriger une erreur**.
- **Personnel déclaré absent** : consultation seule (le **directeur n'est jamais bloqué**).
- Une **école reliée** ne montre **jamais** les données du téléphone d'une autre école :
  on **masque**, on n'efface **jamais**.
- **Rien ne s'efface tout seul** (un historique terminé reste un registre).
- **Carte « Séances annulées » du Dashboard** : aujourd'hui (tant que l'heure n'est pas passée) +
  à venir **seulement** — les jours passés quittent l'écran mais **restent dans la base** et dans
  `listeSeancesAnnulees()` (le **taux de présence** doit continuer à les compter).

## 6. État au 19/09/2026

- **Version courante : v4.60** (`app/index.html`), APK signé par la CI sur la branche `android-v4`.
- Migration serveur réalisée en 3 étapes : **montée** des données ✓, **lecture de la base** ✓,
  **écriture à chaque geste** ✓ (avec rafraîchissement automatique de 5 s).
- Cloisonnement par école ✓, rôles ✓, Dashboard directeur/surveillant ✓, Stats (y compris
  l'enseignant, filtré sur **lui** et sur **ses classes**) ✓, Historique du personnel (RH) ✓.
- **Reste à faire** : qu'un directeur d'**école neuve** puisse **créer ses fiches de professeurs
  depuis l'app** (aujourd'hui : par commande SQL).
- Le dépôt contient deux lignées : **`android-v4`** (l'application — **branche par défaut**) et
  `main` (le serveur : migrations 0001→0005). Elles ont divergé ; ne pas les fusionner à la légère.

## 7. Pièges déjà payés (ne pas les repayer)

- **Ne jamais écrire `innerHTML` sur un conteneur partagé `#form-corps`** : les 5 formulaires y
  vivent ; les vider fait que **plus aucune fenêtre de saisie ne s'ouvre** (défaut v4.43). On
  **ajoute un bloc frère** et on masque les autres par `style.display`.
- **Fenêtre qui « ne s'ouvre pas »** : deux causes distinctes — (1) l'historique laissait
  `display:none` **en ligne** sur `#modal-form` (corrigé v4.58 : `ouvrirFormulaire` force
  `display:flex`) ; (2) `#form-corps` vidé (ci-dessus).
- **Construire un champ à chaque ouverture = empilement** : les 3 filtres de l'historique RH
  étaient construits **hors** du `if (!bloc)` → 3, 6, 9 listes (corrigé v4.60). Toute construction
  dans un bloc réutilisé va **dans** la branche de création.
- **Bancs sensibles à l'heure** : `heure(+90)` un soir tombe **le lendemain** → construire les cas
  depuis l'heure réelle et annoncer les cas non applicables, plutôt que d'échouer à tort.
- **`nomProfCode(undefined)` renvoie « Surveillant 1 »** : toujours tester `if (!code) return '';`
  avant toute recherche par `===` sur une valeur possiblement `undefined`.
- **Les identifiants de lignes doivent venir de la base** : envoyer un identifiant local d'élève
  provoque une violation de clé étrangère (409 avalé par le `try/catch`).
- **Une base vide ne doit jamais écraser le travail du téléphone**, et la relecture **fusionne**
  les absences (sinon la saisie d'un enseignant disparaît au tour suivant de 5 s).
- **Rafraîchissement 5 s** : la moindre erreur d'identifiant est répétée toutes les 5 s
  (une absence du personnel a déjà été créée ~37 fois). Chercher par `(prof_id, debut, fin)` avant
  d'insérer.
- **Le mot de passe des comptes** est fabriqué et conservé par l'app (le serveur ne peut pas le relire).

## 8. Style d'écriture du code

Commentaires **en français**, pas de `console.log` oublié, pas de bibliothèque nouvelle : tout tient
dans `app/` + le CDN déjà déclaré (Tailwind, Font Awesome, xlsx).
