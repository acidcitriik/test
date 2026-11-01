# SYNTHPUCK — ONLINE, présence et invitations

## Expérience joueur

Le menu comporte désormais **ARCADE**, **ENTRAÎNEMENT**, **ONLINE**, puis sur une ligne inférieure centrée **OPTIONS** et **DÉCONNEXION**.
La mise en page est superposée au menu peint ; son logo, les arènes, les sprites, la projection de table et la physique ne sont pas modifiés.

Dans ONLINE :
- **Joueur connecté** : voit les autres joueurs connectés, leur pseudo et leur disponibilité ; cliquer **INVITER À JOUER** prépare une partie WebRTC et envoie une invitation. Le destinataire voit **ACCEPTER / REFUSER** dans le même salon. S'il accepte, il rejoint automatiquement la partie de l'invitant.
- **Invité sans compte** : peut toujours **CRÉER UNE PARTIE** ou **REJOINDRE** à l'aide d'un code de partie, mais n'apparaît pas dans l'annuaire public. Aucune clé ni code TURN Cloudflare n'est demandé.
- Un joueur **EN PARTIE** ne peut pas recevoir de nouvelle invitation. L'entrée et la sortie du salon sont suivies via un heartbeat et un délai d'expiration de 45 secondes, avec rafraîchissement toutes les 3 secondes.
- Deux parties 1v1 indépendantes, chacune hébergée dans le navigateur du créateur, restent possibles. L'invitation et la présence passent par Supabase, les états de gameplay restent en WebRTC PeerJS, pas dans la base.
- **DÉCONNEXION** ferme la session authentifiée ; pour un invité, ouvre l'écran de connexion. **OPTIONS** enregistre localement la sensibilité de la souris.

## Activation côté serveur (indispensable)

Les nouveaux écrans sont publiés sur GitHub Pages, mais **les comptes et le salon en ligne ne pourront fonctionner que lorsque Supabase et Cloudflare seront configurés**.

1. Configurer Supabase Auth et Google OAuth conformément à [PLAYER_ACCOUNTS.md](PLAYER_ACCOUNTS.md).
2. Dans le SQL Editor Supabase, exécuter dans cet ordre :
   - `supabase/player_profiles.sql` (une fois, si non déjà appliqué)
   - `supabase/online_lobby.sql` (nouvelle migration).
3. Configurer `src/player-auth-config.js` avec l'URL du projet Supabase et sa **clé publiable**. Ce sont des données publiques. Ne jamais y placer de clé `service_role`.
4. **Redéployer** `cloudflare/turn-worker.js` sur `https://synthpuck-turn.acidcitriik.workers.dev/`. La modification du dépôt ne redéploie pas automatiquement le Worker.
5. Configurer les quatre variables du Worker :
   - `TURN_KEY_ID` : identifiant Cloudflare TURN (secret côté Worker).
   - `TURN_API_TOKEN` : jeton API Cloudflare TURN (secret côté Worker).
   - `SUPABASE_URL` : URL HTTPS du projet Supabase.
   - `SUPABASE_PUBLISHABLE_KEY` : clé publique Supabase (aucun secret administrateur).
   - `ALLOW_LOCAL_DEV=true` seulement en développement, si nécessaire.
6. Supprimer l'ancien secret `RELAY_ACCESS_CODE` après mise à jour : il n'est plus utilisé par le nouveau Worker. Le navigateur envoie le jeton de session Supabase au Worker, lequel le valide par `/auth/v1/user` avant de demander à Cloudflare des identifiants TURN temporaires (1 heure). Le jeton Cloudflare durable ne quitte pas le Worker.
7. Pour les invités et pendant la transition, le jeu essaie le STUN/direct via PeerJS (avec les serveurs publics déjà configurés). Cela ne garantit pas la connectivité derrière tous les NAT. Pour un test Cloudflare TURN authentifié, voir la commande ci-dessous.
8. Configurer la protection anti-abus / limitations de fréquence du Worker avant une ouverture publique (Cloudflare WAF ou rate limiting, suivi du quota TURN).

## Test à quatre navigateurs

- A et B se connectent avec des comptes distincts. A clique sur B puis B accepte.
- C et D se connectent avec deux autres comptes. C clique sur D puis D accepte.
- Vérifier que les deux matchs avancent indépendamment, les scores ne se mélangent pas et les statuts deviennent occupés.
- Vérifier qu'une invitation peut être refusée, qu'une absence expire, qu'une déconnexion retire le joueur et qu'un utilisateur non connecté ne peut pas consulter les tables protégées par RLS.
- Vérifier la visibilité des menus à 1672×941 et sur mobile ; vérifier que le nouveau panneau ne recouvre pas les commandes de jeu.

**Attention :** ce parcours réel dépend d'une instance Supabase, d'un Worker effectivement redéployé et de plusieurs navigateurs ; le simple push GitHub ne constitue pas un test de bout en bout.

## Test du Worker

Après le redéploiement, avec un access token Supabase valide :

~~~
SYNTHPUCK_SUPABASE_ACCESS_TOKEN=<access-token> node tests/cloudflare-relay.mjs
~~~

Ce jeton est éphémère et **ne doit jamais être commité** ni collé dans une URL publique.
