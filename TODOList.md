
# TODO List

## Faire stockGrantTaxExplanation.

## Faire un module placement personnalisé on met juste valeur nette, contrib sociale et impôts, pour les placements non prévus.

## Réfléchir au cas des emprunts (je me demande si ça a un réel intérêt) ?

## Corriger l'explicitations des calculs de l'assurance vie (la fin est ... bizarre).

## Dans le module Livrets, on doit pouvoir saisir des intérêts nets (c'est ce que donne Boursobank ... je ne sais pas comment ils ont le profil fiscal ...).

## Un truc pas mal serait d'avoir la possibilité de marquer les placements non mis à jour le jour courant et d'avoir une icône pour les identifier.
Pour ce faire, il faut ajouter un timestamp de dernière mise à jour dans les placements.
Ce pourrait aussi être très utile pour la synchronisation ... qui serait un plus.

## Ajout de nouveaux types de comptes (PERECO, PER, etc ...)

## Calcul de l'imposition
- Le profil fiscal est actuellement trop simplifié et ne prend pas en compte tous les cas possibles de 1/2 parts et leurs plafonds de réduction d'impôts.
- Globalement, il faudrait revoir le calcul de l'imposition, notamment pour pouvoir passer une liste de couple "montants"/"taux de PFU" (utile dans le cas des assurances vie).
- Attention, en cas de non PFU, la CSG déductible est déduite des revenus pas des impôts (qui ne peuvent donc pas passer sous 0)

## Il y a une énorme problème dans la synchronisation des données
Quand la sauvegarde échoue et qu'on se reconnecte, il semble qu'on remplace les données actuelles par les données sauvegardées. Il faudrait prévoir un mécanisme de synchro (içône qui informe du statut de synchronisation, retry auto le cas échéant, détection des conflits).

## Faire une revue complète des taux de prélèvements sociaux :
  - Il semble qu'on ne puisse avoir auune confiance en ChatGPT en la matière' :-(
  - Il faut s'assurer que le module appele bien le module fiscal et n'applique pas le taux PFU (par exemple) dans son coin sans vérifier le profil fiscal de l'utilisateur.

## Ajout de test case pour les calculs de prélèvements
### Reprendre lifeInsuranceModule.test.js pour vérifier que le module est correctement appelé, plutôt que de tester directement l'impôt calculé

## Ajout d'autres StorageProvider (pCLoud, One Drive, etc...)

