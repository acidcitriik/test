# SYNTHPUCK — PiperadeGames

Un prototype jouable de jeu de palet compétitif, avec un mode Arcade solo et une salle d’entraînement.

## Lancer

```sh
python -m http.server 8000
```

Ouvrir http://localhost:8000/ (pour les tests navigateur : `/?skipSplash=1`). Le jeu est statique et ne nécessite aucun backend. Les fichiers d'art sont dans `assets/stages` et `assets/characters`.

## Parcours

1. Intro PiperadeGames avec piment rouge original.
2. Menu SYNTHPUCK : **Arcade** et **Entraînement** disponibles ; Options et Exit visuellement désactivés.
3. Arcade : Mute, Chonk, Simous, Mamouda, Diamond, Stal, HAL (identifiant interne 2502 conservé). Premier à sept points, enchaînement après victoire, possibilité de rejouer après défaite.
4. Entraînement : GRID 00, sélection parmi les sept adversaires et affichage de leurs quatre statistiques.
5. Jeu au clavier/souris (mouvement direct, bouton gauche pour impact rigide, droit pour amortir, deux boutons pour le spin, Échap pour pause) et au doigt sur écran tactile.

## Architecture

- `src/physics.js` : moteur de palet existant à pas fixe 120 Hz, sans modification des collisions. L'unique extension est un profil IA optionnel.
- `src/ai.js` : agent tactique 2501 d'origine, préservé.
- `src/ai-profiles.js` / `src/roster.js` : sept comportements déterministes et réglages progressifs, avec statistiques de présentation distinctes des paramètres de difficulté.
- `src/campaign.js` : ordre Arcade et transition des niveaux.
- `src/synthpuck.js`, `src/synthpuck.css` : écrans, HUD, sélection, contrôle de la partie, rendu des portraits et des objets mobiles.
- `assets/stages/*.webp` : huit décors de 1672×941 provenant du gabarit commun, une unique projection de jeu. Le dernier décor **RED CORE / HAL** conserve le masque de table original et affiche seulement une ouverture noire dans la paroi.
- `assets/characters/hal-eye.webp` : rétine rouge peinte extraite du décor validé, animée pour suivre le palet sans modifier la physique ; HAL n'utilise aucun sprite de personnage sur sa propre scène.
- `assets/characters/{mute,chonk,simous,mamouda,diamond,stal}.webp` : portraits frontaux propres et opaques à l'intérieur de leur silhouette ; suppression des anciennes bandes de décors et transparences parasites.
- `prototype.html` : ancien banc de physique 3D et variantes historiques de Mamouda conservés.

## Tests

```sh
npm test
npm install --no-save playwright@1.56.1
npx playwright install chromium
node tests/browser-smoke.mjs
node tests/synthpuck-browser.mjs
```

Les vérifications automatiques couvrent les règles physiques, les profils de difficulté, l'ordre des personnages, l'interface, les choix de l'entraînement, la projection commune, l'absence de ressources manquantes et la possibilité de jouer et mettre en pause.

Ce jalon constitue le **jeu solo local**. Aucun matchmaking, compte, ELO, serveur multijoueur ou système anti-triche n'est inclus.
## Assets HD (30 octobre 2026)

- `assets/ui/menu-hd.avif` : menu principal validé en **1672 × 941**, rendu à la bonne proportion sur tout écran.
- `assets/ui/panel-{blue,red,neutral}.webp` et `pause.webp` : éléments de HUD en images séparées, sans agrandissement de l’ancien atlas basse définition.
- `assets/sprites/{paddle-player,puck,paddle-ai}.webp` : découpe HD des trois dessins approuvés, transparence externe et marges de sécurité ; rayon physique préservé.
- Les six portraits de face détourés et `assets/characters/2502.webp` (HAL) restent en place.
- Le niveau `assets/stages/2502.webp` (RED CORE) conserve **l'ouverture noire sans œil dessiné** : l'œil est animé à partir du palet par `src/hal-eye.js`.
- La calibration commune **1672 × 941 / Y 390, 544, 770** reste strictement inchangée.
- Aucun SVG ni rectangle vectoriel n’est ajouté à l’illustration du menu ou aux objets mobiles.
