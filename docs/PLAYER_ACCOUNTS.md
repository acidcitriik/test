# SYNTHPUCK — Comptes joueurs (Google + e-mail)

L’interface « COMPTE / INVITÉ » est intégrée sans changer le gameplay, les décors, les sprites ni les zones tactiles du menu peint.

## Activer les comptes (opérations manuelles)

SYNTHPUCK est publié sur **GitHub Pages**, qui ne peut pas conserver des mots de passe ou des secrets OAuth. Le navigateur utilise **Supabase Auth**, avec PostgreSQL et la sécurité RLS pour les données de profil.

1. Créer un projet sur https://supabase.com/.
2. Dans **SQL Editor**, exécuter tout le fichier `supabase/player_profiles.sql`. Vérifier que `public.player_profiles` existe et que RLS est activé.
3. Dans **Authentication > Providers**, activer **Email** (garder la confirmation des e-mails) et **Google**.
4. Dans la console Google Cloud, créer un client OAuth **Application Web**. Autoriser l’origine JavaScript `https://acidcitriik.github.io` et enregistrer l’URI de retour **Supabase**, pas GitHub Pages : `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. Copier l’identifiant client et le **secret uniquement dans Supabase > Auth > Providers > Google**. Ne pas les commiter dans Git.
5. Dans **Supabase > Authentication > URL Configuration**, définir **Site URL** : `https://acidcitriik.github.io/test/`, puis autoriser les redirections `https://acidcitriik.github.io/test/**` et pour les tests locaux `http://localhost:8000/**`. La connexion OAuth utilise `?auth=1`.
6. Dans `src/player-auth-config.js`, remplir les deux valeurs **publiques uniquement** :
   - `supabaseUrl: 'https://<PROJECT_REF>.supabase.co'`
   - `supabasePublishableKey: 'sb_publishable_…'` ou l’ancienne clé **anon** publique.
   - Ne **jamais** mettre une clé `service_role`, `sb_secret_...`, un secret Google, un mot de passe SMTP, un mot de passe joueur ou une clé TURN privée dans le code.
7. Pousser la configuration publique sur GitHub Pages. Le navigateur charge Supabase JS v2 via jsDelivr uniquement quand le projet est configuré. Une connexion Internet est nécessaire.
8. Tester inscription e-mail (confirmation), connexion Google, connexion et déconnexion, actualisation de page, modification du pseudo et sauvegarde des options d’apparence. Vérifier qu’un joueur A ne peut pas lire ou modifier le profil d’un joueur B (RLS).

## Comportement

- Le jeu Arcade, Entraînement et Multijoueur est toujours accessible **sans compte**.
- Connexion Google, inscription/connexion e-mail/mot de passe, confirmation de l’e-mail, déconnexion et réinitialisation du mot de passe sont implémentées côté interface ; le fournisseur distant doit être activé séparément.
- Chaque compte peut enregistrer un pseudo et un avatar_data JSON versionné : présentation visuelle (neutre/masculine/féminine/androgyne/libre), couleur de peau, yeux, coupe et couleur des cheveux, accessoire (bandana, masque, visière, lunettes, cicatrice).
- **Ces préférences de personnage ne définissent ni le sexe, ni l’identité de genre, ni l’orientation sexuelle du joueur.** Ce sont des choix d’apparence fictifs, non obligatoires.
- Le personnage ne remplace **pas encore** les sprites des raquettes, ni les personnages des arènes. La base de données prépare un futur éditeur graphique.
- Un profil est **privé** : un utilisateur authentifié ne peut lire et écrire que son propre enregistrement. Pour un futur classement public, prévoir une vue distincte limitée au pseudo et aux données explicitement publiques.
- Sans configuration ou en cas de panne du fournisseur, un message est affiché et le jeu invité fonctionne toujours.

## Tests

Depuis le dépôt :

~~~
npm test
python -m http.server 8000
~~~

Ouvrir `http://localhost:8000/?skipSplash=1` puis « COMPTE / INVITÉ » en haut à droite du menu.

Pour une ouverture publique, prévoir un SMTP autorisé pour les confirmations, limitation des abus et politique de confidentialité.
