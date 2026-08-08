# mon-patrimoine
Une application web pour suivre son patrimoine financier et sa valeur nette (après CSG, impôts).

TRAVAIL EN COURS !!!! RIEN NE FONCTIONNE POUR L'INSTANT

Cette application web en pur javascript permet de gérer (recenser) votre patrimoine. Son objectif final est de pouvoir calculer les valeurs brutes, mais aussi la valeur nette (après prélèvements sociaux et impôts sur le revenu) généralement absente des applications de suivi de patrimoine.
Voici la structure globale :
- L'application est modulaire, avec des fichiers css, des libellés, et des composants bien séparés.
- Chaque type de placement (Compte courant, PEA, PER, PEE, Assurance vie, etc ...) fait l'objet d'un composant différent.
- Certaines données sont partagées par certains placements (prélèvement forfaitaire, CSG, par exemple). Elles font l'objet d'un module séparé éventuellement utilisé par les autres modules.
- Il n'y a pas de connexion directe aux banques (ce serait trop ambitieux), tous les montants doivent pouvoir être saisis.
- Les données sont stockées sous forme d'un simple fichier json dans le Cloud (les premiers fournisseurs disponibles seront Google Drive et pCloud). Des composants génériques (qui implémentent une même API) permettent l'authentification et la sauvegarde/relecture du fichier.