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

Le jeu solo local reste accessible sans connexion. Le multijoueur expérimental et la gestion facultative des comptes sont décrits plus bas.
## Assets HD (30 octobre 2026)

- `assets/ui/menu-hd.avif` : menu principal validé en **1672 × 941**, rendu à la bonne proportion sur tout écran.
- `assets/ui/panel-{blue,red,neutral}.webp` et `pause.webp` : éléments de HUD en images séparées, sans agrandissement de l’ancien atlas basse définition.
- `assets/sprites/{paddle-player,puck,paddle-ai}.webp` : découpe HD des trois dessins approuvés, transparence externe et marges de sécurité ; rayon physique préservé.
- Les six portraits de face détourés et `assets/characters/2502.webp` (HAL) restent en place.
- Le niveau `assets/stages/2502.webp` (RED CORE) conserve **l'ouverture noire sans œil dessiné** : l'œil est animé à partir du palet par `src/hal-eye.js`.
- La calibration commune **1672 × 941 / Y 390, 544, 770** reste strictement inchangée.
- Aucun SVG ni rectangle vectoriel n’est ajouté à l’illustration du menu ou aux objets mobiles.

- `assets/ui/studio-splash-hd.avif` : version agrandie et légèrement accentuée du **même logo PiperadeGames approuvé, avec un seul piment** ; aucun changement de composition ni ajout d'illustration. Le fichier source historique 640 × 360 est conservé comme archive.

### Améliorations de présentation (30 octobre 2026)

- Détourage des six adversaires repris à partir des portraits existants : alpha plein à l’intérieur et repli de 2 px du masque pour éliminer les pixels de fond dans les cheveux/épaules.
- Suppression de l’ombre colorée artificielle autour des adversaires dans le moteur.
- Adversaires réduits de 260 à 184 px dans le repère natif, ancrés derrière le rail éloigné à Y 385.
- Score et plaques HUD ancrés à la zone de la scène 1672 × 941 (et non aux bandes noires du viewport), libellés intégrés dans les panneaux, nom d’adversaire redondant masqué.
- Vérifications visuelles automatisées à 1672 × 941 et 1780 × 800, plus six captures individuelles des adversaires.

## Online · multijoueur 1v1 dans le navigateur

Le menu affiche désormais **ARCADE · ENTRAÎNEMENT · ONLINE**, puis **OPTIONS · DÉCONNEXION** sur une deuxième ligne.

Dans **ONLINE**, les utilisateurs connectés apparaissent dans la liste avec leurs pseudos et états de disponibilité. Clique sur un adversaire pour l'inviter ; il n'a qu'à choisir **ACCEPTER** pour rejoindre la partie WebRTC. Il peut aussi la refuser. Les invitations expirent automatiquement. Les parties restent indépendantes et hébergées dans le navigateur du créateur.

Les invités peuvent toujours créer une partie et partager manuellement son code. Aucune inscription n'est exigée pour utiliser ce parcours. Le navigateur du créateur calcule la physique à pas fixe 120 Hz et transmet les états à 60 Hz via PeerJS/WebRTC. Il faut garder l'onglet visible et ouvert ; le multijoueur n'inclut pas encore de reconnexion ou compensation avancée de latence.

**Relais TURN Cloudflare :** plus aucun code privé à saisir. Les joueurs connectés obtiennent des identifiants temporaires en passant par le Worker authentifié avec leur jeton de session Supabase. Les secrets TURN durables sont gardés côté Worker. Les invités utilisent les serveurs STUN/ICE publics existants et certains réseaux restrictifs peuvent empêcher leur connexion.

**Configuration indispensable :** la liste des joueurs et les invitations nécessitent la migration Supabase + l'activation Auth. Le relais TURN automatique nécessite le redéploiement du Worker Cloudflare. Rien de cela n'est automatiquement déployé par un push GitHub Pages.

Voir **[docs/ONLINE_LOBBY.md](docs/ONLINE_LOBBY.md)** pour les étapes d'activation, la sécurité et le test à quatre joueurs. Le serveur Node optionnel reste utilisable avec `npm start` pour le développement.


## Comptes joueurs (Google, e-mail et profil)

Le bouton **COMPTE / INVITÉ**, affiché sur le menu principal, ouvre une interface de connexion et d'inscription séparée du moteur de jeu. Le jeu reste accessible en mode invité. Les profils peuvent conserver un pseudo ainsi que des préférences de personnage (présentation neutre/masculine/féminine/androgyne/libre, teinte de peau, yeux, cheveux et bandana/masque/autres accessoires). Le rendu du personnage personnalisé en match viendra dans une étape ultérieure.

**Attention : les comptes ne sont pas encore activés sur le site public tant que Supabase et Google OAuth n'ont pas été configurés.** Aucune clé privée ne doit être ajoutée à GitHub. Le script public, la migration PostgreSQL RLS et la procédure Google figurent dans [docs/PLAYER_ACCOUNTS.md](docs/PLAYER_ACCOUNTS.md). Les mots de passe sont traités par Supabase Auth, pas par GitHub Pages ni par le jeu.

Le test de validation du modèle d'avatar est intégré à `npm test`.
