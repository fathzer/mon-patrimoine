# mon-patrimoine
Une application web pour suivre son patrimoine financier et sa valeur nette (après CSG, impôts).

TRAVAIL EN COURS !!!! RIEN NE FONCTIONNE POUR L'INSTANT

Cette application web en TypeScript permet de gérer (recenser) votre patrimoine. Son objectif final est de pouvoir calculer les valeurs brutes, mais aussi la valeur nette (après prélèvements sociaux et impôts sur le revenu) généralement absente des applications de suivi de patrimoine.
Voici la structure globale :
- L'application est modulaire, avec des fichiers css, des libellés, et des composants bien séparés.
- Chaque type de placement (Compte courant, PEA, PER, PEE, Assurance vie, etc ...) fait l'objet d'un composant différent. Le système de modules de placement (plugins) est documenté dans [MODULES.md](MODULES.md).
- Certaines données sont partagées par certains placements (prélèvement forfaitaire, CSG, par exemple). Elles font l'objet d'un module séparé éventuellement utilisé par les autres modules.
- Il n'y a pas de connexion directe aux banques (ce serait trop ambitieux), tous les montants doivent pouvoir être saisis.
- Les données sont stockées sous forme d'un simple fichier json dans le Cloud (les premiers fournisseurs disponibles seront Google Drive et pCloud). Des composants génériques (qui implémentent une même API) permettent l'authentification et la sauvegarde/relecture du fichier.

## Notes développeurs

### Lancer l'application en local

L'application est écrite en TypeScript et doit être compilée avant d'être servie.

```bash
cd web
npm install
npm run dev
```

Puis ouvrir http://localhost:5500 dans votre navigateur.

`npm run dev` lance `tsc --watch` (recompilation automatique) et un serveur HTTP statique sur le port 5500.

### Tests

Les tests utilisent [Bun](https://bun.sh/) :

```bash
cd web
bun test
```

### Google Drive

Pour permettre à l'application d'accéder à Google Drive depuis une URL donnée, vous devez déclarer cette URL comme origine JavaScript autorisée dans la Google Cloud Console :

1. Ouvrez la [Google Cloud Console](https://console.cloud.google.com/) et sélectionnez le projet contenant l'identifiant client OAuth utilisé par l'application.
2. Allez dans **APIs et services** > **Identifiants**.
3. Cliquez sur l'**Identifiant client OAuth 2.0** de type **Application Web** (celui dont le `client_id` est utilisé dans `web/src/main.ts`).
4. Dans la section **Origines JavaScript autorisées**, ajoutez l'URL exacte depuis laquelle l'application est servie, par exemple :
   - `http://localhost:8000` pour un serveur local (le port doit correspondre)
   - `https://mon-domaine.com` pour un hébergement en ligne
   - N'ajoutez pas de `/` à la fin de l'URL.
5. Enregistrez les modifications. Leur prise en compte peut prendre quelques minutes.
6. Assurez-vous également que l'**API Google Drive** est bien activée pour le projet via **APIs et services** > **Bibliothèque**.

