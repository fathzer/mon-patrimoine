# Historique des placements — barèmes annuels, graphe brut/net, inflation, édition

D'abord rendre le calcul de prélèvements paramétrable par année (jusqu'à 2019, validé contre OpenFisca), puis ajouter l'historique daté par module (modèle à états) et le profil fiscal historisé, la vue graphe brut/net avec filtres et périodes, l'inflation via IPC INSEE, et enfin l'édition d'historique.

## Contexte et décisions validées

- **Modèle à états** : entrées `{ date, values }` datées pour les états passés + état courant daté ; valeur à la date D = dernière entrée ≤ D (fonction en escalier). Pas de chaîne de diffs.
- **`asOf`** : date d'effet des valeurs courantes (saisissable, défaut aujourd'hui) — sur le placement et sur `taxProfile`. Permet l'antidatage : à chaque enregistrement, l'ancien état rejoint `history` à **son** `asOf`, pas à la date du jour.
- **`closedAt`** : clôturer ≠ supprimer — le placement/l'attribution restent sérialisés avec leur historique ; `getDataAt(D) → null` pour D > `closedAt`. Une vraie suppression physique = correction destructive documentée.
- **Sérialisation possédée par le module** : chaque module décide quels champs sont absolus (dates d'ouverture/acquisition, label, institution…) vs évolutifs (valeurs, versements…). Pas de `getHistoryFields()` — la couche générique n'a besoin que de `getHistoryDates()` et `getDataAt(date)`.
- **Champs absolus = correction globale** ; entrées d'historique = états par date éditables individuellement. Propagation des corrections : reportée (option UI ultérieure).
- **Profil fiscal historisé** : `taxProfileHistory: [{ date, profile }]` lu en escalier — naissance/mariage/divorce non rétroactifs, RNI par période. Seed de migration : `{ date: "1970-01-01" }` (« depuis toujours »).
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

## Étape 2 — Socle historique (kit + store)

**Format cible `version: "1.1"`** :

```jsonc
{
  "version": "1.1",
  "taxProfile": { "household": {…}, "taxableIncome": 80000, "usePfu": true },
  "taxProfileAsOf": "2026-01-20",
  "taxProfileHistory": [
    { "date": "1970-01-01", "profile": {…} },   // seed migration : « depuis toujours »
    { "date": "2027-03-15", "profile": {…} }
  ],
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
- Profil à la date D = dernier `date ≤ D`.

**Migration au chargement** (pas au save) : `version` 1.0 → 1.1 ; seed `taxProfileHistory = [{ date: "1970-01-01", profile: taxProfile }]` ; pas d'historique placement inventé ; `asOf`/`closedAt` absents → lus comme « aujourd'hui »/actif, matérialisés à la prochaine sauvegarde.

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

- `addPlacement`/`updatePlacement` : `recordState(asOf)` (add → seed de la 1ʳᵉ entrée à `asOf` ; update → ancien état → `history` à **son** `asOf` si valeurs évolutives changées).
- `closePlacement(id, date)` → `closedAt = date` (le bouton « supprimer » devient « clôturer »).
- `ExportPayload` : `taxProfileAsOf` + `taxProfileHistory?: { date; profile }[]` + `getTaxProfileAt(date)` + `version` → `"1.1"` ; changement de profil → ancien `{ date: taxProfileAsOf, profile }` → historique, nouvel `asOf`.

**Implémentation (fait)** : `DatedHistory.ts` (`resolveAt`/`recordAt`/`thin`/`valuesEqual`, génériques sur `{ date }` — réutilisés par `AppStore` pour le profil fiscal) ; `BasePlacement` avec `asOf`/`closedAt`/`history`, `getEvolvingValues()` (défaut `{}`), `getHistoryDates()`, `getDataAt(D)` (→ `null` avant la 1ʳᵉ entrée et après `closedAt`, `asOf` de la donnée renvoyée = date de l'état résolu, sans `history`), `recordState(previous, effectiveDate)`, `insertHistoryEntry(date, values)` ; `AppStore` payload `"1.1"` avec `taxProfileAsOf`/`taxProfileHistory` normalisés (sentinel `1970-01-01` au seed), `getTaxProfileAt(D)` (profil courant = entrée implicite à `taxProfileAsOf`), `updateTaxProfile(profile, asOf?)` (push de l'ancien profil ou insertion rétroactive), `updatePlacement` avec chemin rétroactif (valeurs évolutives insérées à la date passée, état courant préservé), `closePlacement(id, date)`, placements clôturés exclus du résumé courant. Tests : `DatedHistory.test.ts`, `BasePlacement.test.ts`, `AppStore.test.ts` — 370 tests au vert. `thin` : **modèle à slots** — chaque fin de période (jours 7/14/21/fin de mois en bande ~6 mois-2 ans ; fins de mois seules au-delà) **revendique l'entrée la plus proche des deux côtés** (égalité → plus récente). Une entrée isolée couvre les mois vides environnants ; les entrées récentes (< ~6 mois) et la toute première sont toujours gardées. Une saisie du 6/1 représentant fin décembre gagne donc le slot 31/12 ; pour ancrer exactement, `asOf` reste la voie propre.

## Étape 3 — Rollout des modules (opt-in)

| Ordre | Module | Champs évolutifs | Remarques |
|---|---|---|---|
| 1 | `savings_account` | `currentValue`, `interestAmount`, `promotionalInterest` | cas d'école + test |
| 2 | `cto` | `currentValue`, `acquisitionValue`, `cashBalance` | test |
| 3 | `checking_account` | `currentValue` | trivial |
| 4 | `pea`, `pee` | `currentValue`, `totalDeposits` | `openingDate` absolu |
| 5 | `life_insurance`, `per`, `home_savings` | audit champs | |
| 6 | `real_estate` | `currentValue`, `works` | `acquisition*`/`primaryResidence` absolus (correction globale) |
| 7 | `custom` | audit | |
| 8 | `stock_grant` | `currentPrice` (`priceHistory`) + `numberOfShares` par ligne (`attributions[].sharesHistory`) | `getDataAt` overridé (ligne visible si `acquisitionDate ≤ D` — hypothèse à affiner) ; `recordState` overridé ; **ligne jamais supprimée** : cession = `sharesHistory` → 0 à la date |

## Étape 4 — Vue graphe (brut + net)

- **`web/src/ui/HistoryChartView.ts`** : SVG maison — axes, courbe agrégée, tooltip ; sélecteur 1M/6M/YTD/1A/5A/10A/Max ; toggles **brut/net** (actif dès le départ grâce à l'étape 1) et nominal/euros constants (actif après l'étape 5).
- **Filtres** : extraire le prédicat de `AssetTableView._getFilteredEvaluations` (catégories + institutions, persisté dans `UiState`) vers un helper partagé — la sélection du graphe = filtres actuels.
- Séries : union des dates d'historique des placements filtrés dans la fenêtre + bornes + aujourd'hui ; pour chaque D : `PlacementFactory.create(p.getDataAt(D))?.getEvaluation(store.getTaxProfileAt(D), D)` → somme brut / net (`grossValue` vs `netValueBeforeIR − imposition` à taux de l'année D).
- `DashboardView` : nouvelle section + clés i18n (`fr.ts`).

## Étape 5 — Inflation

- `web/src/inflation/` : table IPC mensuelle INSEE (base 2015, France, ensemble) embarquée en TS (~350 valeurs depuis 1996) + `deflate(amount, from, to) = amount × IPC(to)/IPC(from)`.
- Toggle « euros constants » dans `HistoryChartView` (post-agrégation).
- Optionnel : script de régénération via API INSEE/BCE.

## Étape 6 — Édition de l'historique (en dernier)

- `PlacementModalView` : section « Historique » listant `getHistoryDates()` ; actions éditer / supprimer / ajouter un point passé ; édition de `asOf` et `closedAt`.
- Édition : `editor.render(placement, { asOfDate })` pré-rempli via `getDataAt(date)` ; écriture dans l'entrée (sans `recordState`) ; champs absolus édités globalement via le formulaire principal.
- « Supprimer un placement » → `closedAt` (date d'effet), avec option de suppression physique documentée comme destructive de l'historique.
- `AppStore` : `updateHistoryEntry` / `deleteHistoryEntry` / `closePlacement` + persistance.

## Étape 7 — Finitions

- `thin()` appliqué dans `recordState` (politique 6 mois / hebdo / mensuel).
- Docs : `README.md` et **`PLACEMENTS.md`** (contrat : `asOf`, `closedAt`, `history`, `getEvolvingValues`, `getDataAt`, `recordState`, convention `{date, values}`).

## Fichiers principaux

- `fiscality/rates.ts`, `fiscality/TaxCalculator.ts`, `tests/openfiscaSmoke.test.ts` (étape 1)
- `core/DatedHistory.ts` (nouveau), `placements/BasePlacement.ts`, `kit/v1/index.ts`, `core/AppStore.ts`
- `ui/HistoryChartView.ts` (nouveau), `ui/DashboardView.ts`, `ui/AssetTableView.ts`, `ui/PlacementModalView.ts`, `i18n/fr.ts`, `inflation/` (nouveau)
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
