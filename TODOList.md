
# TODO List

## Ajouter une détection des PEA multiples (attention, un couple peut avoir 2 PEA distincts)

## Refaire le parcours d'accueil pour forcer le renseignement du profi fiscal.

## Prévoir une information sur les nouveautés ... probablement dans la barre d'outils

## Un truc pas mal serait d'avoir la veleur nette en mode fourmi ou cigale (le mode actuel)
Voir https://claude.ai/chat/08d0e5ac-f6a8-4397-88ff-166f65390cce

## Dans le module "Actions gratuites", plutôt que répartir les plafonds entre les différentes attributions éligibles, il faudrait les épuiser dans l'ordre de l'abattement max, ça devrait donner l'optimum, et rien n'empêche la cigale de tout vider en deux ordres séparés d'une journée ou deux.

## Ajout de nouveaux types de comptes (PERECO, PER, etc ...)

## Faire un module placement personnalisé on met juste valeur nette, contrib sociale et impôts, pour les placements non prévus.

## Corriger l'explicitations des calculs de l'assurance vie (la fin est ... bizarre).

## Dans le module Livrets, on doit pouvoir saisir des intérêts nets (c'est ce que donne Boursobank ... je ne sais pas comment ils ont le profil fiscal ...).

## Réfléchir au cas des emprunts (je me demande si ça a un réel intérêt) ?

## Un truc pas mal serait d'avoir la possibilité de marquer les placements non mis à jour le jour courant et d'avoir une icône pour les identifier.
Pour ce faire, il faut ajouter un timestamp de dernière mise à jour dans les placements.
Ce pourrait aussi être très utile pour la synchronisation ... qui serait un plus.

## Calcul de l'imposition (peut-être déjà fait)
- Le profil fiscal est actuellement trop simplifié et ne prend pas en compte tous les cas possibles de 1/2 parts et leurs plafonds de réduction d'impôts.

## Faire une revue complète des taux de prélèvements sociaux :
  - Il semble qu'on ne puisse avoir auune confiance en ChatGPT en la matière' :-(
  - Il faut s'assurer que le module appele bien le module fiscal et n'applique pas le taux PFU (par exemple) dans son coin sans vérifier le profil fiscal de l'utilisateur.

## Ajout de test case pour les calculs de prélèvements
### Reprendre lifeInsuranceModule.test.js pour vérifier que le module est correctement appelé, plutôt que de tester directement l'impôt calculé

## Ajout d'autres StorageProvider (pCloud, One Drive, etc...)

