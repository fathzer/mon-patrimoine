# TODO List

## Skin white theme

## ~~Refaire le parcours d'accueil pour forcer le renseignement du profil fiscal.~~ ✅ Fait
L'absence de `taxProfile` dans le fichier *est* le flag « profil jamais renseigné » : `_getDefaultData()` l'omet, `_hydrateState` pose `state.profileConfigured`, `updateTaxProfile` le lève (et `getExportPayload` ne réintroduit la clé qu'une fois le profil fourni). `DashboardView.render()` ouvre `SettingsModalView` en mode `mandatory` tant que le flag est faux — sans barre d'année ni « Fermer »/« Enregistrer sans fermer », ni fermeture par clic sur l'overlay : seul « Enregistrer » débloque. Les fichiers existants (profil présent) ne voient rien ; le mode démo non plus (le Gist a un profil).

## Prévoir une information sur les nouveautés ... probablement dans la barre d'outils

## Un truc pas mal serait d'avoir la valeur nette en mode fourmi ou cigale (le mode actuel)
Voir https://claude.ai/chat/08d0e5ac-f6a8-4397-88ff-166f65390cce

## ~~Dans le module "Actions gratuites", plutôt que répartir les plafonds entre les différentes attributions éligibles, il faudrait les épuiser dans l'ordre de l'abattement max, ça devrait donner l'optimum, et rien n'empêche la cigale de tout vider en deux ordres séparés d'une journée ou deux.~~ ✅ Fait
`StockGrantModule._allocateThreshold()` remplace la répartition proportionnelle : les attributions éligibles (≥ 31/12/2016) sont triées par abattement sous-seuil décroissant (`StockGrant.getBelowThresholdAbattement` — détention 50/65 % pour 2017, 50 % uniforme dès 2018) et le seuil de 300 k€ est épuisé sur chacune à tour de rôle, plafonné au gain d'acquisition. Glouton = optimal : chaque euro de seuil retranche `abattement` € d'assiette. Les prélèvements sociaux sont invariants à la répartition (même écart de taux sous/au-dessus du seuil pour tout euro déplacé) ; à égalité d'abattement, l'ordre de déclaration l'emporte (tri stable). `TaxExplanation` précise que le seuil s'apprécie par année de cession (étaler sur 2 années = 2 × 300 k€).

## Un truc pas mal serait d'avoir la possibilité de marquer les placements non mis à jour le jour courant et d'avoir une icône pour les identifier. ✅ Fait (partiellement)
Pour ce faire, on aurait pu ajouter un timestamp de dernière mise à jour dans les placements qui aurait aussi été très utile pour la synchronisation ... qui serait un plus.
Mais la possibilité de choisir une date dans l'historique permet d'identifier les placements mis à jour à cette date, et donc par contraste, ceux qui ne le sont pas.

## ~~Ajout de test case pour les calculs de prélèvements~~ ✅ Fait
### ~~Reprendre lifeInsuranceModule.test.js pour vérifier que le module est correctement appelé, plutôt que de tester directement l'impôt calculé~~
Les tests de module vérifient désormais le **contrat** `getTaxableIncomes()` (assiette, `eligiblePfu`, `tauxSpecifique`, `deductionRevenus`) plutôt que `evaluation.imposition` (impôt calculé par `TaxCalculator`, couvert par ses propres tests + les tests OpenFisca). Convertis : `life_insurance` (10 assertions) et `per` (3). Contrat ajouté pour les modules qui en manquaient : `pea` (exonération à 5 ans, borne incluse), `home_savings` (PEL >12 ans pré-2018 / CEL jamais / post-2018), `real_estate` (RP exonérée, abattement 6 %/an IR, exonération 22 ans), `cto` + `savings_account` (gains PFU, exonération Livret A), `checking_account`/`pee` (`[]` — exonérés). `custom` conserve sa fiscalité saisie à la main. Au passage : `pea` n'émet plus de revenu à assiette 0 (garde `> 0`, comme `cto`).

## Ajout d'un StorageProvider pCloud

## Extraction de la couche storage en lib réutilisable (offline + synchro multi-appareils)
Design arrêté : voir « Piste : moteur de synchronisation » dans STORAGE_PROVIDERS.md (contrat révisionné, merge par grains, pull avide + push explicite).

## ~~Annotations sur le graphe d'historique~~ ✅ Fait (étape 7)
`state.annotations: { date, text }[]` persisté dans le payload ; bouton ✎ dans la carte Historique → éditeur inline à la date de vue ; losange ambre sur la courbe nette + texte dans le tooltip.

## ~~Storage Provider « démo »~~ ✅ Fait
`DemoProvider` (`web/src/storage/DemoProvider.ts`) : `loadData()` fetch le Gist public (`raw/demo.json`), `saveData()` répond `true` sans rien écrire — les données vivent en mémoire, un reload repart du Gist (variante retenue : pas même de sauvegarde localStorage). `StorageProvider.isReadOnly()` pilote le bandeau orange « Mode démo — vos modifications ne sont pas sauvegardées » en haut d'écran. Entrée : bouton « ou tester Mon Patrimoine en mode démo » sous « Connexion » (`AppStore.loginDemo()` → `StorageManager.useProvider` + `init()` ; `logout()` restaure le provider Google Drive).
**Fichiers** (`bun scripts/make_demo_data.ts`) : `demo/placements-demo.json` (patrimoine réaliste publié sur le Gist : PEA versements épisodiques + PEA FortunaBank clôturé en 2019 pour financer la maison du Morbihan, appart Boulogne présent dès 2019, PER mensuel défiscalisé, Livret A, compte clôturé/remplacé, attributions Safran 2021-2024, « Crédit d'impôts », profil marié 0→3 enfants, banques fictives, annotations) et `demo/placements-stress.json` (1 placement/module × ~800 relevés = densité max de `thin()`, profil fiscal blindé).

## Élagage de l'historique (`thin()`) — implémenté, non câblé
**Idée** : borner la croissance de `placements.json` en dégradant la résolution des états anciens. `thin()` (dans `web/src/core/DatedHistory.ts`, déjà testée) retient : tout < ~1 an, 1 entrée/semaine jusqu'à 5 ans (slots 7/14/21/fin de mois), 1/quinzaine jusqu'à 10 ans (slots 15/fin de mois), 1/mois au-delà. Chaque slot garde l'entrée **la plus proche des deux côtés** (une saisie du 6/1 représentant fin décembre gagne le slot 31/12) ; la première entrée est toujours préservée. ~800 entrées/placement sur 20 ans. Non prioritaire : le merge-join (`getDataSeriesAt`) rend le graphe rapide même non élagué ; le thin sert surtout à borner la taille du fichier et l'affichage des dates.

**Branchement proposé** : appeler `thin(this.history)` dans `BasePlacement.recordState()` après le `recordAt` (O(n), négligeable). Points d'attention :
- **Pas de thin dans `insertHistoryEntry()`** : une correction rétroactive fraîche pourrait perdre son slot et être élaguée immédiatement (ou alors l'appeler en protégeant la nouvelle entrée).
- `thin()` est **destructif** : les états élagués sont perdus à la sauvegarde — à valider avant activation.
- `stock_grant` : surcharger pour élaguer aussi `priceHistory` et les `sharesHistory` de chaque ligne (mêmes helpers par dimension).
