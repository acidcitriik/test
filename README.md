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
- Panneau **Laboratoire** : sensibilité, vitesse maximale et accélération, restitution des bandes, friction, compétence de l'IA.

## Architecture

- `index.html` : interface et présentation du jeu.
- `src/physics.js` : modèle de simulation XZ à pas fixe, indépendant du moteur graphique.
- `src/game.js` : rendu Three.js 3D, caméra en perspective, entrées et HUD.
- `src/ai.js` : logique tactique déterministe de l'adversaire, indépendante de la physique et du rendu.
- `tests/physics.test.mjs`, `tests/ai*.test.mjs`, `tests/controls.test.mjs` : tests automatisés des collisions, de la tactique et des commandes.
- `tests/browser-smoke.mjs` : lancement et mouvements testés dans un navigateur Chromium automatisé.

Exécuter tous les tests du moteur avec `npm test` (Node.js récent). Aucun package npm n'est requis pour les tests du moteur.

## Principes et limites

Le joueur contrôle une **position cible virtuelle** ; la raquette accélère et freine avec les mêmes plafonds physiques pour tout le monde. Les collisions utilisent la vitesse relative, les impulsions normales/tangentielles, un coefficient de restitution, des frottements et la rotation du palet. Les gestes obliques ou arrondis n'ont **aucun bonus caché**.

Ce prototype est une **expérimentation locale**, pas un produit esport final : pas de netcode, de classement, de mode PS5, de simulation garantie identique entre architectures ni de calibration matérielle absolue. Les unités et coefficients sont ajustables pour tester les sensations, sans prétendre reproduire fidèlement les matériaux d'une table de air hockey réelle. Le code charge Three.js depuis jsDelivr ; l'usage hors ligne exige une copie locale de la bibliothèque.

Le projet Unity 2017 original n'est pas utilisé ni modifié ; les graphismes sont entièrement procéduraux.

## Tactique de l'IA locale

L'IA n'est plus limitée à un seul contact par échange. Elle poursuit le palet tant qu'il reste jouable dans son camp :

- elle intercepte les trajectoires obliques et les mouvements presque horizontaux, y compris après rebond latéral ;
- elle va chercher les palets ralentis ou arrêtés, même très près de son fond de table ;
- elle peut effectuer une mise en position latérale, une frappe vers la bande, puis poursuivre le palet pour une autre frappe directe ;
- elle recule pour protéger le but lorsque le palet quitte sa moitié ;
- elle conserve la même simulation d'inertie, d'accélération, de contact et de vitesse que les autres raquettes, sans appliquer de vitesse artificielle au palet.

La simulation et l'IA ne constituent pas encore un système de stratégie compétitive abouti. Les choix tactiques sont déterministes et restent à régler après des parties humaines.
