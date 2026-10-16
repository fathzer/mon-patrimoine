# TODO List

## Refaire le parcours d'accueil pour forcer le renseignement du profi fiscal.

## Prévoir une information sur les nouveautés ... probablement dans la barre d'outils

## Un truc pas mal serait d'avoir la valeur nette en mode fourmi ou cigale (le mode actuel)
Voir https://claude.ai/chat/08d0e5ac-f6a8-4397-88ff-166f65390cce

## Dans le module "Actions gratuites", plutôt que répartir les plafonds entre les différentes attributions éligibles, il faudrait les épuiser dans l'ordre de l'abattement max, ça devrait donner l'optimum, et rien n'empêche la cigale de tout vider en deux ordres séparés d'une journée ou deux.

## Un truc pas mal serait d'avoir la possibilité de marquer les placements non mis à jour le jour courant et d'avoir une icône pour les identifier.
Pour ce faire, il faut ajouter un timestamp de dernière mise à jour dans les placements.
Ce pourrait aussi être très utile pour la synchronisation ... qui serait un plus.

## Ajout de test case pour les calculs de prélèvements
### Reprendre lifeInsuranceModule.test.js pour vérifier que le module est correctement appelé, plutôt que de tester directement l'impôt calculé

## Ajout d'autres StorageProvider (pCloud, One Drive, etc...)

## ~~Annotations sur le graphe d'historique~~ ✅ Fait (étape 7)
`state.annotations: { date, text }[]` persisté dans le payload ; bouton ✎ dans la carte Historique → éditeur inline à la date de vue ; losange ambre sur la courbe nette + texte dans le tooltip.

## Storage Provider « démo » (Gist + provider local)
Créer un Gist contenant un fichier `placements.json` imaginaire (jeu de données de démo) et un StorageProvider « démo » : charge le fichier du Gist, permet de bricoler en local, sauvegarde dans le localStorage (aucune donnée réelle ne quitte le navigateur). Sert de sandbox d'évaluation pour un nouvel utilisateur.
**Fichiers déjà générés** (`bun scripts/make_demo_data.ts`) : `demo/placements-demo.json` (patrimoine réaliste : PEA versements épisodiques, PER mensuel défiscalisé, Livret A, compte clôturé/remplacé, attributions Safran 2021-2024, « Crédit d'impôts », profil marié→parent isolé, annotations) et `demo/placements-stress.json` (1 placement/module × ~800 relevés = densité max de `thin()`, profil fiscal blindé). Reste : publier le démo sur un Gist + écrire le provider.

## Élagage de l'historique (`thin()`) — implémenté, non câblé
**Idée** : borner la croissance de `placements.json` en dégradant la résolution des états anciens. `thin()` (dans `web/src/core/DatedHistory.ts`, déjà testée) retient : tout < ~1 an, 1 entrée/semaine jusqu'à 5 ans (slots 7/14/21/fin de mois), 1/quinzaine jusqu'à 10 ans (slots 15/fin de mois), 1/mois au-delà. Chaque slot garde l'entrée **la plus proche des deux côtés** (une saisie du 6/1 représentant fin décembre gagne le slot 31/12) ; la première entrée est toujours préservée. ~800 entrées/placement sur 20 ans. Non prioritaire : le merge-join (`getDataSeriesAt`) rend le graphe rapide même non élagué ; le thin sert surtout à borner la taille du fichier et l'affichage des dates.

**Branchement proposé** : appeler `thin(this.history)` dans `BasePlacement.recordState()` après le `recordAt` (O(n), négligeable). Points d'attention :
- **Pas de thin dans `insertHistoryEntry()`** : une correction rétroactive fraîche pourrait perdre son slot et être élaguée immédiatement (ou alors l'appeler en protégeant la nouvelle entrée).
- `thin()` est **destructif** : les états élagués sont perdus à la sauvegarde — à valider avant activation.
- `stock_grant` : surcharger pour élaguer aussi `priceHistory` et les `sharesHistory` de chaque ligne (mêmes helpers par dimension).

## TODO Curieux
TODO préexistants (déjà dans le code avant mes changements — le linter les re-signe simplement parce que le fichier a été modifié). Ce ne sont pas des régressions :

Ligne 66 (calculateGobalTax) : méthode stub jamais implémentée ("implement per-income tax and aggregate it"). La compléter = implémenter le calcul d'impôt global — un vrai chantier, hors périmètre de l'étape 1.

Ligne 173 (calculateTax) : TODO de l'auteur du code reconnaissant que le chemin hors-PFU de cette méthode est faux (tmi × base au lieu du différentiel barème comme calculatePlacementTax). Corriger = un vrai changement de comportement.
Deux options : les laisser tels quels (ce sont des limitations documentées), ou — si tu veux — je peux traiter le second dans une passe séparée, car c'est un vrai bug latent (le premier est juste une fonctionnalité non implémentée). Ma recommandation : ne pas les mélanger à l'étape 1, éventuellement y revenir lors du travail sur la valeur nette historique où le chemin hors-PFU aura plus d'importance.

Il faudrait commencer par vérifier si ces méthodes sont appelées dans le code.