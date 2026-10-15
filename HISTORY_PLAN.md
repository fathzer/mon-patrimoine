# Historique des placements — barèmes annuels, graphe brut/net, inflation, édition

D'abord rendre le calcul de prélèvements paramétrable par année (jusqu'à 2019, validé contre OpenFisca), puis ajouter l'historique daté par module (modèle à états) et le profil fiscal historisé, l'inflation via IPC INSEE, la vue graphe brut/net avec filtres et périodes, et enfin l'édition d'historique.

## Contexte et décisions validées

- **Modèle à états** : entrées `{ date, values }` datées pour les états passés + état courant daté ; valeur à la date D = dernière entrée ≤ D (fonction en escalier). Pas de chaîne de diffs.
- **`asOf`** : date d'effet des valeurs courantes (saisissable, défaut aujourd'hui) — sur le placement ; sur `taxProfile` la granularité est **l'année de revenus** (une seule déclaration par an : `year` au lieu de `asOf`). Permet l'antidatage : à chaque enregistrement, l'ancien état rejoint `history` à **son** `asOf`/`year`, pas à la date du jour.
- **`closedAt`** : clôturer ≠ supprimer — le placement/l'attribution restent sérialisés avec leur historique ; `getDataAt(D) → null` pour D > `closedAt`. Une vraie suppression physique = correction destructive documentée.
- **Sérialisation possédée par le module** : chaque module décide quels champs sont absolus (dates d'ouverture/acquisition, label, institution…) vs évolutifs (valeurs, versements…). Pas de `getHistoryFields()` — la couche générique n'a besoin que de `getHistoryDates()` et `getDataAt(date)`.
- **Champs absolus = correction globale** ; entrées d'historique = états par date éditables individuellement. Propagation des corrections : reportée (option UI ultérieure).
- **Profil fiscal historisé** : `taxProfile` devient une entité `{ profile, year, history: [{ year, profile }] }` — même triplet (état, année d'effet, historique) qu'un placement mais **indexé sur l'année de revenus** (une déclaration par an ; les champs du foyer sont des faits annuels), l'état niché sous `profile` car `FiscalProfile` reste un objet-valeur partagé. Historique lu en escalier annuel — un profil enregistré pour l'année Y s'applique à Y et aux années suivantes jusqu'au prochain point ; pas de point futur possible (année ≤ année courante). Historique vide (et omis) tant qu'il n'y a pas de changement ; `getTaxProfileForYear` retombe sur la première entrée connue pour les années antérieures à tout changement enregistré.
- **Net historique** : barèmes locaux par année, validés contre OpenFisca **en tests uniquement** (jamais au runtime — chaîne d'évaluation synchrone et offline).
- **Indexation temporelle** : prélèvements sociaux au taux en vigueur **à la date** de l'événement ; IR au barème des **revenus de l'année** de l'événement, avec repli sur le dernier barème connu tant que la LF de l'année suivante n'est pas votée (comportement actuel préservé).
- **Graphe** : SVG maison (aucune dépendance runtime — choix validé).
- **Inflation** : table IPC INSEE embarquée, toggle « euros constants ».
- **Élagage** : rétention dégradée (tout < 6 mois, hebdo < 2 ans, mensuel au-delà ; toujours garder la 1ʳᵉ et la dernière entrée de chaque période).

## Étape 1 — Barèmes par année (jusqu'à 2019) + validation OpenFisca ✅

**Indexation temporelle (règle fiscale)** — deux référentiels distincts :

- **Prélèvements sociaux** : taux en vigueur **à la date de l'événement** (cession simulée à la date D) → `getSocialContributionRate(date)`, table par date d'effet (17,2 % → 18,6 % à sourcer avec dates exactes ; un changement peut survenir en cours d'année).
- **Impôt sur le revenu** : une cession en année N relève du barème des **revenus de l'année N**, publié par la loi de finances N+1 — donc inconnu pendant l'année N. Table indexée par année des revenus ; `getFiscalRates(incomeYear)` retourne l'entrée exacte ou **le dernier barème connu ≤ l'année demandée** (jamais une année future). Conséquence : pendant 2026, l'estimation IR utilise le barème revenus 2025 — comportement actuel préservé, et l'entrée 2026 sera ajoutée au vote de la LF 2027 sans changement de code. Les valeurs actuelles de `FISCAL_RATES` = barème revenus 2025 → elles deviennent l'entrée 2025.

Tâches :

- `fiscality/rates.ts` : transformer `FISCAL_RATES` en `FISCAL_RATES_BY_YEAR: Record<incomeYear, …>` — tranches IR, taux PFU (12,8 %), décote, plafonds quotient familial, pour chaque année de revenus **2019 → 2025** (sourcé : impots.gouv / service-public). `getFiscalRates(incomeYear)` avec repli sur la dernière entrée ≤ l'année.
- **Extensibilité pré-2018** : le PFU n'existe qu'à partir des revenus 2018 — encoder `pfuAvailable` par année pour pouvoir étendre la table plus tard ; les revenus `eligiblePfu` retombent alors au barème (approximation documentée). Périmètre initial : 2019+.
- `SOCIAL_CONTRIBUTION_RATES` → `getSocialContributionRate(date)` : taux par date d'effet (dates exactes à sourcer).
- `TaxCalculator` : paramètre optionnel `incomeYear`/`rates` sur `calculatePlacementTax`, `computeRawTax`, `computeFiscalMetrics`, `computeFinalTax`, `_computeDecote` — défaut = année courante, kit v1 préservé. **Le paramètre propagé est l'année des revenus** (`now.getFullYear()`), le repli sur le dernier barème connu se fait dans le lookup, pas à l'appel.
- `BasePlacement.getImposition(fp, now)` propage `now.getFullYear()` ; chaque module remplace ses accès directs `SOCIAL_CONTRIBUTION_RATES` par `getSocialContributionRate(now)` (ajouter `now` aux signatures qui l'ignorent, ex. `CtoModule.getSocialCharges`).
- **Tests** : étendre `web/tests/openfiscaSmoke.test.ts` (le client `Openfisca` prend déjà `year`, indexé par année des revenus — cohérent) — batterie de cas par année 2019→N (statuts, enfants, RNIs variés) comparant impôt/TMI/décote locaux vs OpenFisca. C'est le livrable de l'étape.

**Implémentation (fait)** : `FISCAL_RATES_BY_YEAR` 2019→2025 sourcé directement depuis les paramètres OpenFisca (barème, plafonds QF, décote — y compris le changement de formule décote 2019→2020) ; `getFiscalRates(incomeYear)` avec repli dernier ≤ ; `getSocialContributionRate(date)` avec 15,5 % (2013) → 17,2 % (2018) → 18,6 % (2026-01-01, LFSS 2026 art. 12) ; `incomeYear` propagé dans `TaxCalculator` (défaut = année courante) ; `now` propagé dans les `getSocialCharges*` des modules. Challenge OpenFisca étendu : 36 cas × 7 années (252 comparaisons) au vert.
**Point ouvert** : `OLD_CSG_CRDS` (17,2 %) conservé pour l'immobilier et les gains UC assurance-vie — impact éventuel de la LFSS 2026 sur ces régimes à vérifier.

## Étape 2 — Socle historique (kit + store) ✅

**Format cible `version: "1.2"`** :

```jsonc
{
  "version": "1.2",
  "taxProfile": {
    "profile": { "household": {…}, "taxableIncome": 80000, "usePfu": true },
    "year": 2026,
    "history": [                              // omitted as long as no change was recorded
      { "year": 2024, "profile": {…} }          // profile applicable from income year 2024 on
    ]
  },
  "placements": [{
    "id": "…", "type": "cto", "label": "…", "institution": "…",
    "asOf": "2026-03-31",                        // date d'effet des valeurs courantes
    "closedAt": null,                            // clôture (≠ suppression)
    "acquisitionValue": 42000, "cashBalance": 300, "currentValue": 51000,
    "history": [
      { "date": "2025-06-01", "values": { "acquisitionValue": 40000, "cashBalance": 300, "currentValue": 47800 } }
    ]
  }]
}
```

- Champs de niveau 1 = **état courant** (inchangé — compatibilité 1.0 : lecture dans les deux sens, l'ancien code ignore les clés en plus).
- `history[i].values` = **état complet des champs évolutifs** à la date (pas un diff).
- `getDataAt(D)` = `toJSON()` recouvert par les `values` de la dernière entrée ≤ D ; **`null` avant la 1ʳᵉ entrée et après `closedAt`** — « inconnu » ≠ « valeur plate ».
- Profil à la date D = dernier point avec `year ≤ année(D)`.

**Migration au chargement** (pas au save) : `version` 1.0/1.1 → 1.2 ; `taxProfile` nu → entité `{ profile, year: année courante }`, `history = []` (pas de duplication du profil courant — la première entrée connue s'étend aux années antérieures) ; entité 1.1 datée → `asOf` et `history[].date` repliés sur leur année (doublons d'année : le dernier gagne ; une entrée repliée sur l'année du point courant est absorbée par celui-ci) ; pas d'historique placement inventé ; `asOf`/`closedAt` absents → lus comme « aujourd'hui »/actif, matérialisés à la prochaine sauvegarde.

**Nouveau `web/src/core/DatedHistory.ts`** (générique — placements *et* profil fiscal, toute entrée `{ date, … }`) :

```ts
export interface HistoryEntry { date: string; values: Record<string, unknown> }
resolveAt<T extends { date }>(entries, date): T | null  // dernière entrée ≤ date
recordAt<T extends { date }>(entries, entry): T[]       // insère trié / remplace même jour
thin<T extends { date }>(entries, policy): T[]          // élagage résolution dégradée
valuesEqual(a, b)                                       // égalité structurelle (skip si inchangé)
```

+ tests bun.

**`BasePlacement.ts`** (tout additif, défauts sûrs) :

- `asOf`, `closedAt: string | null`, `history: HistoryEntry[]` hydratés depuis `data` (convention pour modules simples).
- `getHistoryDates(): string[]` — défaut : dates de `history` (+ `asOf`) ; extensible pour historique imbriqué.
- `getDataAt(date): PlacementData | null` — `null` avant la 1ʳᵉ entrée ou après `closedAt` ; sinon `toJSON()` + valeurs résolues, sans `history`/`asOf`/`closedAt`.
- `getEvolvingValues(): Record<string, unknown>` — défaut `{}` (opt-in module ; accesseur d'état, pas déclaration de format).
- `recordState(asOf)` : si valeurs évolutives inchangées → rien ; sinon pousse l'ancien état `{ date: ancien asOf, values: anciennes valeurs }` dans `history` et fixe le nouveau `asOf` ; `asOf` < `asOf` courant → insertion simple dans `history` à la date (état courant inchangé). Overridable (stock_grant).
- Ré-exports dans `placements/kit/v1/index.ts`.

**`AppStore.ts`** :

- `updatePlacement` : `recordState(asOf)` (update → ancien état → `history` à **son** `asOf` si valeurs évolutives changées).
- **Cycle de vie** : `addPlacement` — l'état courant est le 1ᵉʳ état connu à `asOf` (pas de seed d'historique, `null` avant `asOf` ; un placement peut être ajouté déjà clôturé) ; `closePlacement(id, date | null)` — `closedAt = date` conserve le placement et son historique dans le fichier (clôturer ≠ supprimer), `null` réouvre une clôture par erreur ; `deletePlacement` — suppression physique, seul chemin destructeur, réservé aux placements qui n'auraient jamais dû exister (l'UI le mettra derrière confirmation). `closedAt < asOf` toléré au niveau store (`getDataAt` → `null` après `closedAt`), l'UI empêchera la saisie absurde.
- `ExportPayload` : `taxProfile` devient `{ profile, year, history?: { year; profile }[] }` + `getTaxProfileForYear(year)` / `getTaxProfileAt(date)` + `version` → `"1.2"` ; changement de profil → ancien `{ year, profile }` → historique, nouveau `year`.

**Implémentation (fait)** : `DatedHistory.ts` (`resolveAt`/`recordAt`/`thin`/`valuesEqual`, génériques sur `{ date }` — réutilisés par `AppStore` pour le profil fiscal) ; `BasePlacement` avec `asOf`/`closedAt`/`history`, `getEvolvingValues()` (défaut `{}`), `getHistoryDates()`, `getDataAt(D)` (→ `null` avant la 1ʳᵉ entrée et après `closedAt`, `asOf` de la donnée renvoyée = date de l'état résolu, sans `history`), `recordState(previous, effectiveDate)`, `insertHistoryEntry(date, values)` ; `AppStore` payload `"1.2"` avec `taxProfile` entité `{ profile, year, history }` indexée sur l'année de revenus (historique omis du payload tant qu'il est vide ; pas de seed — `getTaxProfileForYear` retombe sur la première entrée connue pour les années antérieures à tout changement), `getTaxProfileForYear(Y)` / `getTaxProfileAt(D)` (profil courant = point implicite à `taxProfileYear`), `resolveTaxProfileForYear` (renvoie aussi l'année d'enregistrement — badge « reconduit »), `updateTaxProfile(profile, year?)` (remplacement en place même année, push de l'ancien profil ou insertion rétroactive, clampé à l'année courante), `getTaxProfileYears`/`hasTaxProfileHistoryEntry`/`deleteTaxProfileHistoryEntry` (le point courant n'est jamais supprimable), `updatePlacement` avec chemin rétroactif (valeurs évolutives insérées à la date passée, état courant préservé), `closePlacement(id, date | null)` (`null` = réouverture), placements clôturés exclus du résumé courant. Tests : `DatedHistory.test.ts`, `BasePlacement.test.ts`, `AppStore.test.ts` — 370 tests au vert. `thin` : **modèle à slots** — chaque fin de période (jours 7/14/21/fin de mois en bande ~6 mois-2 ans ; fins de mois seules au-delà) **revendique l'entrée la plus proche des deux côtés** (égalité → plus récente). Une entrée isolée couvre les mois vides environnants ; les entrées récentes (< ~6 mois) et la toute première sont toujours gardées. Une saisie du 6/1 représentant fin décembre gagne donc le slot 31/12 ; pour ancrer exactement, `asOf` reste la voie propre.

## Étape 3 — Rollout des modules (opt-in) ✅

| Ordre | Module | Champs évolutifs | Statut |
|---|---|---|---|
| 1 | `savings_account` | `currentValue`, `interestAmount`, `promotionalInterest` | fait + test |
| 2 | `cto` | `currentValue`, `acquisitionValue`, `cashBalance` | fait + test |
| 3 | `checking_account` | `currentValue`, `cardBalance` | fait |
| 4 | `pea`, `pee` | `currentValue`, `totalDeposits` (+ `netValue`, `knowsNetValue` pour `pee`) | fait — `openingDate`/`peaType` absolus |
| 5 | `life_insurance`, `per`, `home_savings` | `life_insurance` : `totalPremiums`, `pre2017Premiums`, `currentValue`, `euroFundsValue` (`openingDate` absolu) ; `per` : `grossValue`, `netValue`, `knowsNetValue`, `deducted`, `nonDeducted`, `employeeSavings` ; `home_savings` : `currentValue`, `interestAmount` (`promotionalInterest` forcé à 0 → non historisé) | fait |
| 6 | `real_estate` | `currentValue`, `works` | fait — `acquisition*`/`primaryResidence` absolus (correction globale) |
| 7 | `custom` | `grossValue`, `socialCharges`, `incomeTax` (`category` absolu) | fait |
| 8 | `stock_grant` | `currentPrice` (`priceHistory` + `priceAsOf`) + `numberOfShares` par ligne (`attributions[].sharesHistory` + `sharesAsOf`) | fait + test — `getDataAt`/`recordState`/`insertHistoryEntry`/`getHistoryDates` overridés ; ligne visible si `acquisitionDate ≤ D` ; appariement par `attributionDate+acquisitionDate` ; **ligne jamais supprimée** : cession = `sharesHistory` → 0 à la date |

## Étape 4 — Vue « à la date » + édition de l'historique (avancée — indépendante du graphe et de l'inflation) ✅

- **Principe** : une **barre de date permanente** dans le modal d'édition (hors `<form>` pour préserver le focus), calquée sur la barre d'année du profil fiscal — pas de mode « historique » séparé ni de double jeu d'actions. Un **sélecteur de date** au niveau dashboard (carte Historique de la toolbar ; le graphe de l'étape 5 offrira ensuite des points cliquables) bascule la vue « état au D » : liste, totaux et explications fiscales reconstruits via `getDataAt(D)` / `getTaxProfileAt(D)` / `getEvaluation(fp, D)` — le modal ouvert depuis cette vue démarre sur la date du panneau.
- **Implémentation (fait)** : `AppStore.getSummaryAt(viewDate|null, includeInactive)` partage `_buildSummary` avec `getGlobalSummary` ; `GlobalSummary` porte `asOfDate` ; les inactifs sont dérivés dans la table (`placements` − évalués, badge via `isClosedAt(D)`) ; `DashboardView._viewSummary()` bascule entre le résumé émis et le résumé daté ; carte `HistoryPanelView` (date seule — le toggle clôturés vit dans la toolbar de la table) ouverte par l'icône historique de la toolbar.
- **Liste (fait)** : en vue courante comme en vue datée, les placements sans état à la date apparaissent grisés quand le toggle « Afficher les placements clôturés » (toolbar de la table) est actif, avec badge « Clôturé le JJ/MM/AAAA » / « Non suivi à cette date » ; « Ajouter » vit en bas de liste.
- **Édition datée (fait)** : le modal d'édition affiche la barre de date (◀ ▶ entre **aujourd'hui et les points enregistrés** + champ libre, borné `[EARLIEST_FISCAL_DATE, aujourd'hui]` au commit), **ouverte à aujourd'hui** (`asOf` = dernier point connu, atteint par ◀). Badges « État actuel » (D == asOf) / « Point existant » / « Nouveau point » + badge « Clôturé le … » si `isClosedAt(D)`. Un point **≤ `asOf` et ≠ aujourd'hui** est rétroactif : formulaire **verrouillé** — icône 🔒 près de la date → déverrouillage explicite → **champs évolutifs uniquement** éditables (les `name` de `getEvolvingValues()`, plus les inputs marqués `data-evolving` pour les valeurs évolutives sans nom sérialisé unique — montants des compartiments PER, `numberOfShares` des lignes `stock_grant`), globaux et poubelle verrouillés, note explicative. Sauvegarde → `updatePlacement(id, {…data, asOf: D})` : rétro → `insertHistoryEntry`, sinon `recordState` ; poubelle → `AppStore.deleteStateAt` (entrée d'historique, ou **rollback du point courant** : supprimer `asOf` restaure le dernier état enregistré — par dimension pour `stock_grant`, caché s'il n'y a pas d'état antérieur) ; les dates sont bornées à aujourd'hui (ouverture clampée à `closedAt` pour atterrir sur le dernier état vivant ; navigation libre ensuite) — la sauvegarde est refusée quand la date éditée dépasse la **clôture du formulaire** (message « La date éditée ne peut être postérieure à la clôture ») ; les édits non enregistrés des champs **globaux** (clôture, libellé…) survivent à la navigation — ce sont des attributs du placement, pas du point ; « Enregistrer sans fermer » réaffiche le point déverrouillé pour la saisie chaînée.
- **Profil fiscal par année (fait)** : `SettingsModalView` porte la même mécanique sur l'année de revenus — barre permanente (◀ ▶ + champ année borné `[EARLIEST_FISCAL_YEAR, année courante]`), badges « Profil actuel » / « Point existant » / « Reconduit depuis {année} », **verrou** quand l'année visualisée précède le dernier point (`viewYear < taxProfileYear`) — tout champ du profil étant évolutif, le déverrouillage ouvre tout ; poubelle sur année enregistrée passée et déverrouillée ; « Enregistrer sans fermer » avance à l'année suivante ; résumé fiscal et explications (« Règles fiscales », PFU) calculés avec `incomeYear` de l'année visualisée ; ouverture sur l'année de la date du dashboard quand le panneau historique est actif.
- **Explications fiscales datées (fait)** : titre « Explication fiscale au JJ/MM/AAAA » + `getTaxProfileAt(D)` — la signature est `getTaxExplanation(placement, fp, now)` (`now` = date de vue, `T12:00:00` local) ; chaque module propage `now` aux calculs datés (âge du contrat, taux social via `getSocialContributionRate(now)` quand le régime le suit, `incomeYear = now.getFullYear()` pour le popover PFU). Revue par module :
  - checking_account : vide — rien.
  - custom : texte statique — rien.
  - cto : `getSocialChargesRate(now)` ; fix `getPfuExplanation` (le profil était casté en args — `usePfu` jamais lu) → `{ fiscalProfile, year }`.
  - savings_account : `getSocialChargesRate(now)` ; le popover PFU ne recevait pas le profil → `{ fp, year }`.
  - home_savings : `now` propagé (PEL >12 ans, éligibilité PFU) ; `NEW_RATE` figé → `getSocialContributionRate(now)` ; année PFU.
  - pea : `getHoldingYears`/`isExemptFromIncomeTax`/`getSocialChargesRate(now)` ; année PFU.
  - pee : `getSocialChargesRate(now)`.
  - per : `getSocialChargesRate(now)` ; année PFU.
  - real_estate : `now` propagé (durée de détention, déductions) ; `STANDARD_SOCIAL_RATE` (17,2 %) et taux IR (19 %) **constants** — régime légal propre à la PV immo, ne suit pas `getSocialContributionRate`.
  - life_insurance : `getContractYears`/`getIncomeTaxBreakdown(now)` ; `UC_SOCIAL_RATE` (17,2 %) **constant** ; année PFU.
  - stock_grant : `standardRate` → `getSocialContributionRate(now)` (taux à la cession) ; année PFU.
- **Alerte « barème non voté » (fait)** : `getVotedScheduleYear(incomeYear)` rend explicite l'année du barème réellement utilisée par `getFiscalRates` (table 2019–2025 — un `incomeYear` sans budget voté retombe sur la dernière année connue) ; `getUnvotedScheduleWarning(incomeYear)` renvoie une alerte `getWarning` (« barème {Y} non voté, taux {voté} utilisés ») quand les deux divergent. Affichée sous l'estimation TMI/impôt du profil fiscal (`ctx.viewYear`) et dans la section « Imposition à l'IR » des explications placement — sauf `pee`/`real_estate` (pas de barème annuel utilisé) et les cas exonérés d'IR (PEA > 5 ans, PEL/CEL non éligibles).
- **Placements clôturés (fait)** : la clôture est un **champ du formulaire** (toggle « Placement clôturé » + date, sans borne haute — une clôture future est possible) éditable à l'état courant et en création (un placement peut être créé déjà clôturé) ; verrouillé aux dates passées comme tout champ global. `updatePlacement` n'hérite `closedAt` du précédent que si le payload l'omet — `null` explicite = réouverture. `closePlacement(id, date | null)` reste l'API store.

## Étape 5 — Inflation ✅

- **Données** : séries IPC mensuelles INSEE (base 2025, France) — fichiers JSON chargés paresseusement depuis le Gist `5646b5558f759655717914400cc50a03` (`raw/insee-{id}.json`, mis à jour automatiquement par un workflow GitHub ; la dépendance GitHub existe déjà via GitHub Pages), mis en cache en mémoire pour ne pas pénaliser les réseaux lents. Trois sources : `011814630` (tous produits), `011814056` (hors tabac), `011814080` (hors tabac et alcool) — mention INSEE dans l'aide.
- **`web/src/core/inflation.ts`** : `InflationIndex` (mois triés, valeur du mois D = plus grand mois ≤ D — sinon le plus ancien), facteur = `indice(dernier mois publié) / indice(mois de D)` ; registre de séries + chargement paresseux. Le mois courant n'étant pas encore publié, la base « euros constants » est le dernier mois disponible.
- **Plomberie affichage** : `GlobalSummary.priceLevelFactor` — multiplicateur de présentation produit par `DashboardView._viewSummary()` (jamais persisté, jamais appliqué aux données ni aux calculs) ; `_getDisplayedTotals`, lignes `AssetTableView`, `AssetBreakdownView` et le donut multiplient les montants affichés (les pourcentages sont inchangés — facteur uniforme).
- **UI** : sélecteur dans la carte « Historique » (`HistoryPanelView`) — hors inflation / tous produits / hors tabac / hors tabac et alcool — choix persisté dans `UiState`.
- **Édition et explications fiscales : restent en euros de l'époque** ; alerte dans le modal d'explication quand l'affichage est en euros constants.
- Optionnel : script de régénération via API INSEE.

## Étape 6 — Vue graphe (brut + net) ✅

- **`web/src/ui/HistoryChartView.ts`** : SVG maison — courbes en escalier (un état tient jusqu'au point suivant), grille + axes, tooltip au survol avec curseur pointillé ; clic = date cliquée dans le champ ; appui long (400 ms) + glisser sur mobile. Légende brut/net, marqueur de la date de vue. Pleine période (premier point → aujourd'hui).
- **Filtres** : `AssetTableView.matchesFilters` exposé — le graphe suit les filtres catégories/institutions quand « filtrer les totaux » est actif, comme le résumé.
- **Séries** : `collectChartDates` (union des dates d'historique des placements filtrés + 1ᵉʳ janvier de chaque année couverte + aujourd'hui, stride au-delà de 2000 échantillons) ; `AppStore.getValueSeries(dates, placements)` somme `grossValue` et `netValueBeforeIR − imposition` avec `getTaxProfileAt(D)` / `getEvaluation(profile, D)`. Mesuré : ~5 000 dates × 12 placements en ≈ 80 ms — synchrone.
- **Inflation** : quand une source est sélectionnée, chaque point est multiplié par `factorFor(D)` — cohérent avec l'affichage euros constants du reste de la page.

## Étape 7 — Variations & annotations

Contexte : la variation **globale** du patrimoine (éventuellement filtrée) est le seul indicateur de « performance » qui ait du sens — les mouvements internes entre placements s'annulent au niveau global, et la variation par placement est du bruit (versements/retraits indiscernables de la performance, le PER excepté qui connaît ses versements). La variation globale contient trois composantes : performance des actifs, flux externes (dons, achats), évolution fiscale — les annotations couvrent les flux externes, les marqueurs PS la fiscalité.

- **Annotations manuelles** ✅ : `state.annotations: { date, text }[]` (une par date, triées ; omises du payload tant que vide — format reste `1.2`). Saisie via bouton ✎ dans la carte Historique → éditeur inline à la date de vue (aujourd'hui si aucune) : enregistrer, supprimer (uniquement si existante), annuler. Rendu = losange ambre sur la courbe nette + texte (💬) dans le tooltip quand le curseur passe à ±10 px. Données métier : persistées dans le `placements.json`, pas `UiState`.
- ~~**Marqueurs automatiques PS**~~ : abandonné — l'évolution des PS n'est pas plus marquante qu'un changement de tranche d'IR ; ne rien annoter en automatique.
- **Bloc de variations** ✅ : bloc repliable (`<details>`, état conservé entre re-renders) — KPI chips (Depuis le début avec CAGR net, Année en cours, 12 derniers mois ; ligne € constants quand un indice est actif ; masquées quand le début de période n'est pas couvert) + table annuelle (Δ brut, Δ net, Δ net € constants, moyenne annuelle nette depuis l'année en %/an et €/an). Option restante : courbe du CAGR glissant (3 ans).
- **Pas d'overlay CPI** : redondant — la courbe en euros constants (étape 5) répond déjà à « ai-je battu l'inflation ? ».

## Étape 8 — Finitions

- `thin()` appliqué dans `recordState` (politique 6 mois / hebdo / mensuel).
- Docs : `README.md` et **`PLACEMENTS.md`** (contrat : `asOf`, `closedAt`, `history`, `getEvolvingValues`, `getDataAt`, `recordState`, convention `{date, values}`).

## Fichiers principaux

- `fiscality/rates.ts`, `fiscality/TaxCalculator.ts`, `tests/openfiscaSmoke.test.ts` (étape 1)
- `core/DatedHistory.ts` (nouveau), `placements/BasePlacement.ts`, `kit/v1/index.ts`, `core/AppStore.ts`
- `ui/HistoryChartView.ts` (nouveau), `ui/DashboardView.ts`, `ui/AssetTableView.ts`, `ui/PlacementModalView.ts`, `i18n/fr.ts`, `core/inflation.ts` (nouveau)
- étape 7 : `core/AppStore.ts` (`state.annotations`), `ui/HistoryChartView.ts` (marqueurs), `ui/HistoryPanelView.ts` (saisie)
- `placements/modules/*` (un par un)

## Vérification

- `cd web && bun run build` + `bun test` à chaque étape.
- Étape 1 : tests OpenFisca par année au vert.
- Manuel : CTO modifié plusieurs fois (dont date passée) → courbe en escalier, périodes, toggle brut/net, euros constants, correction d'entrée.

## Risques / points ouverts

- **stock_grant** : attribution comptée à partir de `acquisitionDate` (droit latent non acquis ignoré — à affiner si besoin).
- **IR année courante = estimation** au dernier barème connu (inévitable : la LF N+1 n'est pas votée) ; penser à ajouter l'entrée à chaque nouvelle LF.
- Pré-2019 : hors périmètre initial (table 2019+) ; mécanisme `pfuAvailable` prêt pour extension.
- `asOf` < `asOf` courant : le point rejoint `history` à sa date, l'état courant reste le plus récent (règle tranchée : état courant = point le plus récent).
