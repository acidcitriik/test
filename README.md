# Kinetic Duel — Prototype HTML 3D

Prototype local jouable dans le navigateur : duel de palets **en 3D, caméra derrière la raquette face à l'adversaire**, contre une IA capable d'intercepter, récupérer et jouer plusieurs fois le palet dans sa moitié.

## Lancement

Ce projet est statique : aucun serveur backend, compte ou installation npm n'est nécessaire pour y jouer sur une page hébergée HTTPS.

- Pour jouer en ligne, activer **GitHub Pages** : Settings → Pages → Deploy from a branch → `main` / `(root)`. Le site sera disponible à l'adresse `https://acidcitriik.github.io/test/` après publication.
- Pour jouer localement, lancer `python -m http.server 8000` à la racine du dépôt, puis visiter `http://localhost:8000`. Une connexion Internet est nécessaire pour charger Three.js depuis le CDN.
- Cliquer sur **Jouer** pour verrouiller la souris. Échap pour libérer le pointeur et mettre en pause.

## Commandes

- **Souris** : mouvement relatif horizontal (X) et avant/arrière (Z), sans lancer un tir avec un bouton.
- **Bouton gauche maintenu** : mode de contact rigide, davantage de restitution.
- **Bouton droit maintenu** : mode de contact amorti, davantage de friction.
- **Les deux maintenus** : mode de contact d'adhérence, favorise le spin.
- **R** : recommencer un match, **Espace** : engager/reprendre, **Échap** : pause.
- Panneau **Laboratoire** : sensibilité, vitesse maximale des impacts du joueur, accélération et vitesse de l'IA, restitution des bandes, friction.

## Architecture

- `index.html` : interface et présentation du jeu.
- `src/physics.js` : modèle de simulation XZ à pas fixe, indépendant du moteur graphique.
- `src/game.js` : rendu Three.js 3D, caméra en perspective, entrées et HUD.
- `src/ai.js` : logique tactique déterministe de l'adversaire, indépendante de la physique et du rendu.
- `tests/physics.test.mjs`, `tests/ai*.test.mjs`, `tests/controls.test.mjs`, `tests/direct-control.test.mjs` : tests automatisés des collisions, de la tactique et des commandes.
- `tests/browser-smoke.mjs` : lancement et mouvements testés dans un navigateur Chromium automatisé.

Exécuter tous les tests du moteur avec `npm test` (Node.js récent). Aucun package npm n'est requis pour les tests du moteur.

## Principes et limites

**Contrôle local direct (latence logicielle de suivi : 0)** : la raquette du joueur rejoint la position de souris dès le prochain pas de simulation (120 Hz), sans lissage, inertie ni accélération. La vitesse utilisée pour calculer la puissance des collisions reste plafonnée à la valeur « Vitesse max. d'impact » afin de limiter l'avantage des mouvements de souris extrêmes. Les déplacements peuvent cependant être instantanés sur la table : c'est un choix **arcade**, différent de la contrainte de vitesse motrice envisagée pour un futur mode compétitif. L'IA conserve son accélération et ses limites de vitesse. Les collisions utilisent la vitesse relative, les impulsions normales/tangentielles, un coefficient de restitution, des frottements et la rotation du palet. Les gestes obliques ou arrondis n'ont **aucun bonus caché**.

Ce prototype est une **expérimentation locale**, pas un produit esport final : pas de netcode, de classement, de mode PS5, de simulation garantie identique entre architectures ni de calibration matérielle absolue. Les unités et coefficients sont ajustables pour tester les sensations, sans prétendre reproduire fidèlement les matériaux d'une table de air hockey réelle. Le code charge Three.js depuis jsDelivr ; l'usage hors ligne exige une copie locale de la bibliothèque.

Le projet Unity 2017 original n'est pas utilisé ni modifié ; les graphismes sont entièrement procéduraux.

## Engagements physiques

Chaque point commence avec un **palet immobile**. Aucun coup initial n'est déclenché automatiquement.
Le joueur engage le premier point en avançant sa raquette sur le palet placé dans sa moitié.
Après un but, **le joueur qui a encaissé** effectue l'engagement suivant : le joueur avec la souris, ou l'IA via une collision réelle. L'affichage indique le serveur.
Cette règle évite toute vitesse initiale imposée au palet.

## Dégagements derrière la raquette IA

Lorsque le palet glisse horizontalement derrière l'IA, celle-ci ne se contente plus de le suivre sur X.
Elle tente de se placer **devant le palet** pour le frapper vers la **bande arrière** lorsqu'une bande existe au point d'impact (hors ouverture du but), puis de récupérer le rebond.
Lorsque la trajectoire est dans l'ouverture du but, elle cherche un dégagement **latéral** plutôt que de tirer volontairement dans son propre but.
Ces comportements restent des heuristiques déterministes : la vitesse et la trajectoire réelles résultent des collisions et non d'une impulsion ajoutée au palet.

## Tactique de l'IA locale

L'IA n'est plus limitée à un seul contact par échange. Elle poursuit le palet tant qu'il reste jouable dans son camp :

- elle intercepte les trajectoires obliques et les mouvements presque horizontaux, y compris après rebond latéral ;
- elle va chercher les palets ralentis ou arrêtés, même très près de son fond de table ;
- elle peut effectuer une mise en position latérale, une frappe vers la bande, puis poursuivre le palet pour une autre frappe directe ;
- elle recule pour protéger le but lorsque le palet quitte sa moitié ;
- elle conserve la même simulation d'inertie, d'accélération, de contact et de vitesse que les autres raquettes, sans appliquer de vitesse artificielle au palet.

La simulation et l'IA ne constituent pas encore un système de stratégie compétitive abouti. Les choix tactiques sont déterministes et restent à régler après des parties humaines.

## Réactivité du contrôle

Le contrôle local ne comporte plus de traînage artificiel : lorsque la souris change de direction, la raquette suit la nouvelle cible au pas de simulation suivant. Le jeu doit toujours attendre le prochain rafraîchissement du navigateur/écran pour afficher le mouvement, ce qui n'est pas une latence absolument nulle au sens matériel. Le moteur balaie le chemin de déplacement pendant le pas de physique pour éviter qu'un mouvement brusque traverse le palet sans collision. Les impulsions utilisent une vitesse de raquette plafonnée, même pour les très grands déplacements.


## Version de référence de l'IA : 2501

Le comportement actuel de l'adversaire est **figé sous le nom de code 2501**.

- Branche de sauvegarde : [`ai-2501`](https://github.com/acidcitriik/test/tree/ai-2501)
- Commit de référence : [`43eb759`](https://github.com/acidcitriik/test/commit/43eb759a5e09cb5ec945ce542bb49888d8405903)
- Source tactique : `src/ai.js` (blob `1288bdf97a093735b870d0f672f6f7f04a7df478`)
- La référence inclut les paramètres moteurs et physiques de `src/physics.js`, les tests IA et l'ensemble du prototype à ce commit.

**Règle de développement :** conserver la branche `ai-2501` inchangée.
Les évolutions de l'IA se font sur une autre branche ou sur `main` ; le comportement 2501 reste disponible comme base de comparaison et de restauration.
Cette sauvegarde ne change pas la version actuellement jouable.
