# mon-patrimoine

[![Deploy to GitHub Pages](https://github.com/fathzer/mon-patrimoine/actions/workflows/deploy.yml/badge.svg)](https://github.com/fathzer/mon-patrimoine/actions/workflows/deploy.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Live app](https://img.shields.io/badge/Live%20app-GitHub%20Pages-success?logo=github)](https://fathzer.github.io/mon-patrimoine/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/fathzer/mon-patrimoine)

Une application web (Desktop et mobile) pour suivre son patrimoine financier et sa valeur nette (après CSG, impôts) en tenant compte de l'impact de l'inflation.

Cette application web en TypeScript permet de gérer (recenser) votre patrimoine. Son objectif final est de pouvoir calculer les valeurs brutes, mais aussi la valeur nette (après prélèvements sociaux et impôts sur le revenu) généralement absente des applications de suivi de patrimoine, et dans suivre l'évolution de votre patrimoine dans le temps, en prenant également en compte l'inflation.
Voici la structure globale :
- L'application est modulaire, avec des fichiers css, des libellés, et des composants bien séparés.
- Chaque type de placement (Compte courant, PEA, PER, PEE, Assurance vie, etc ...) fait l'objet d'un composant différent. Le système de modules de placement (plugins) est documenté dans [PLACEMENTS.md](PLACEMENTS.md).
- Certaines données sont partagées par certains placements (prélèvement forfaitaire, CSG, par exemple). Elles font l'objet d'un module séparé éventuellement utilisé par les autres modules.
- Il n'y a pas de connexion directe aux banques (ce serait trop ambitieux), tous les montants doivent pouvoir être saisis.
- L'application garde l'historique daté de chaque placement afin de produire des graphes d'évolution brut/net (périodes 1M/6M/Année/1A/5A/10A/Max), un tableau de variations annuelles. Elle permet également d'ajouter des annotations pour mentionner des événements importants affectant le patrimoine (ex: Dons), d'effectuer des corrections rétroactives (une valeur saisie dans le passé peut être corrigée), et d'afficher en euros constants via les indices INSEE.
- Les données sont stockées sous forme d'un simple fichier json dans le Cloud (les premiers fournisseurs disponibles seront Google Drive et pCloud). Des composants génériques (qui implémentent une même API) permettent l'authentification et la sauvegarde/relecture du fichier.

## Notes développeurs

### Lancer l'application en local

L'application est écrite en TypeScript et doit être compilée avant d'être servie.
Le projet utilise [Bun](https://bun.sh/) comme gestionnaire de paquets et pour les tests.

```bash
cd web
bun install
bun run dev
```

Puis ouvrir http://localhost:5500 dans votre navigateur.

`bun run dev` lance `tsc --watch` (recompilation automatique) et un serveur HTTP statique sur le port 5500.

### Tests

```bash
cd web
bun test
```

### Données de démonstration

`bun scripts/make_demo_data.ts` génère deux fichiers dans `demo/` :

- `placements-demo.json` — un patrimoine fictif réaliste (PEA, PER, Livret A, comptes courants, attributions d'actions Safran 2021-2024, immobilier, placement personnalisé « Crédit d'impôts », profil fiscal et annotations) ;
- `placements-stress.json` — un placement de chaque type rempli à la densité maximale de la politique d'élagage (`thin()`), destiné aux tests de performance.

Le premier est publié sur un Gist public et alimente le **mode démo** : le bouton « ou tester Mon Patrimoine en mode démo » de l'écran de connexion charge ces données via le `DemoProvider` (lecture seule — les modifications ne sont pas sauvegardées et sont perdues au rechargement, signalé par un bandeau en haut d'écran).

### Indice des prix à la consommation (INSEE)

Le script `scripts/fetch_insee_cpi.py` interroge l'API BDM de l'INSEE et publie les indices mensuels des prix à la consommation au format JSON sur un Gist GitHub public — un fichier par série, nommé `insee-<idbank>.json` :

- https://gist.githubusercontent.com/fathzer/5646b5558f759655717914400cc50a03/raw/insee-011814056.json (ensemble hors tabac)
- https://gist.githubusercontent.com/fathzer/5646b5558f759655717914400cc50a03/raw/insee-011814630.json (ensemble y compris tabac, France)
- https://gist.githubusercontent.com/fathzer/5646b5558f759655717914400cc50a03/raw/insee-011814080.json (ensemble hors tabac et alcool)

Les séries extraites sont listées dans `IDBANKS` en tête du script.

Le workflow GitHub `fetch-insee-cpi.yml` l'exécute chaque jour (l'INSEE publie l'indice vers le 15 du mois) et met à jour le Gist uniquement si les données ont changé. Il nécessite un secret de dépôt `GIST_TOKEN` contenant un Personal Access Token (classique) avec le scope `gist`.

Exécution locale — affiche le JSON sans mettre à jour le Gist si `GIST_TOKEN` n'est pas défini :

```bash
python3 scripts/fetch_insee_cpi.py
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

