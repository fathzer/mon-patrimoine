# TODO List

## Refaire le parcours d'accueil pour forcer le renseignement du profi fiscal.

## Prévoir une information sur les nouveautés ... probablement dans la barre d'outils

## Un truc pas mal serait d'avoir la valeur nette en mode fourmi ou cigale (le mode actuel)
Voir https://claude.ai/chat/08d0e5ac-f6a8-4397-88ff-166f65390cce

## Dans le module "Actions gratuites", plutôt que répartir les plafonds entre les différentes attributions éligibles, il faudrait les épuiser dans l'ordre de l'abattement max, ça devrait donner l'optimum, et rien n'empêche la cigale de tout vider en deux ordres séparés d'une journée ou deux.

## Corriger l'explicitations des calculs de l'assurance vie (la fin est ... bizarre).

## Un truc pas mal serait d'avoir la possibilité de marquer les placements non mis à jour le jour courant et d'avoir une icône pour les identifier.
Pour ce faire, il faut ajouter un timestamp de dernière mise à jour dans les placements.
Ce pourrait aussi être très utile pour la synchronisation ... qui serait un plus.

## Ajout de test case pour les calculs de prélèvements
### Reprendre lifeInsuranceModule.test.js pour vérifier que le module est correctement appelé, plutôt que de tester directement l'impôt calculé

## Ajout d'autres StorageProvider (pCloud, One Drive, etc...)

## TODO Curieux
TODO préexistants (déjà dans le code avant mes changements — le linter les re-signe simplement parce que le fichier a été modifié). Ce ne sont pas des régressions :

Ligne 66 (calculateGobalTax) : méthode stub jamais implémentée ("implement per-income tax and aggregate it"). La compléter = implémenter le calcul d'impôt global — un vrai chantier, hors périmètre de l'étape 1.

Ligne 173 (calculateTax) : TODO de l'auteur du code reconnaissant que le chemin hors-PFU de cette méthode est faux (tmi × base au lieu du différentiel barème comme calculatePlacementTax). Corriger = un vrai changement de comportement.
Deux options : les laisser tels quels (ce sont des limitations documentées), ou — si tu veux — je peux traiter le second dans une passe séparée, car c'est un vrai bug latent (le premier est juste une fonctionnalité non implémentée). Ma recommandation : ne pas les mélanger à l'étape 1, éventuellement y revenir lors du travail sur la valeur nette historique où le chemin hors-PFU aura plus d'importance.

Il faudrait commencer par vérifier si ces méthodes sont appelées dans le code.