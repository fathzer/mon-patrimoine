# Modules de placement (système de plugins)

Ce répertoire contient les modules de placement de l'application, organisés sous
forme de système de plugins. Chaque sous-dossier correspond à un type de
placement et est chargé au démarrage par `modules/PlacementFactory.ts` à partir
des entrées déclarées dans `web/modules.json`.

Ce document décrit l'organisation des dossiers, le contrat auquel un module doit
se conformer, ainsi que les API de l'hôte utilisées par les modules actuels.
L'inventaire des API ci-dessous est **descriptif** (il recense ce que les
modules existants utilisent réellement aujourd'hui) ; il sera
épuré/formalisé par la suite.

## Organisation des dossiers

```
placements/
  <nom>/                 # <nom> = type de placement = PlacementData.type
    module.ts             # obligatoire : default-exporte une sous-classe de BasePlacement
    Editor.ts             # obligatoire : l'éditeur du placement (BasePlacementEditor)
    TaxExplanation.ts     # optionnel : constructeur d'explication fiscale HTML
```

`<nom>` doit correspondre au champ `name` d'une entrée de `web/modules.json`,
par ex. `cto`, `pea`, `real_estate`, `stock_grant`, ...

## `web/modules.json`

Un tableau JSON de définitions de modules, lu une fois au démarrage par
`PlacementFactory.loadModules()`. Chaque entrée comporte actuellement :

| champ    | type   | signification                                                       |
|----------|--------|---------------------------------------------------------------------|
| `name`   | string | Nom du dossier sous `placements/`. Aussi utilisé comme `PlacementData.type`. |
| `author` | string | Auteur/attribution du module.                                       |
| `label`  | string | Libellé affiché dans la liste déroulante « type » du formulaire de placement. |

D'autres champs pourront être ajoutés ultérieurement.

## Chargement

`PlacementFactory.loadModules()` (dans `src/modules/PlacementFactory.ts`) :

1. `fetch('./modules.json')` (servi en tant que ressource statique).
2. Pour chaque définition, fait un `import('../placements/<nom>/module.js')`
   dynamique.
3. Récupère l'**export par défaut** comme classe de placement et l'enregistre
   sous la clé `definition.name`.
4. Une fois la promesse résolue, `PlacementFactory.create(type)` et
   `PlacementFactory.getEditorClass(type)` sont utilisables de façon synchrone.

`main.ts` attend `PlacementFactory.loadModules()` avant `store.init()`, de sorte
que le registre est prêt avant toute création de placement ou ouverture
d'éditeur.

## Contrat de `module.ts`

Un `module.ts` doit **default-exporter** une classe étendant `BasePlacement`
(`src/modules/BasePlacement.ts`) :

```ts
import { BasePlacement } from '../../modules/BasePlacement.js';
import type { Evaluation, PlacementData } from '../../modules/BasePlacement.js';
import type { FiscalProfile, PlacementIncome } from '../../fiscality/TaxCalculator.js';
import { MonEditeur } from './Editor.js';

export class MonModule extends BasePlacement {
  static override readonly DEFAULT_CATEGORY = Category.X;
  static override getEditorClass() { return MonEditeur; }

  constructor(data: MesDonnees) { super(data); /* ... */ }

  override getEvaluation(fiscalProfile: FiscalProfile, now?: Date): Evaluation { /* ... */ }
  override getTaxableIncomes(fiscalProfile: FiscalProfile, now?: Date): PlacementIncome[] { /* ... */ }
  override toJSON(): MesDonnees { return { ...super.toJSON(), /* ... */ }; }
}

export default MonModule;
```

### Contrat de `BasePlacement` (ce qu'un module implémente/utilise)

Défini dans `src/modules/BasePlacement.ts`.

Membres statiques :
- `static readonly DEFAULT_CATEGORY: Category` — **doit** être positionné par le
  module à une valeur de `Category` (`src/core/Categories.ts`). Vérifié dans le
  constructeur.
- `static getEditorClass(): PlacementEditorConstructor` — **doit** être
  surchargée pour renvoyer la classe d'éditeur du module. Par défaut, renvoie
  `BasePlacementEditor`.

Membres d'instance fournis par la classe de base :
- `id: string`, `type: PlacementType` (= string), `label: string`,
  `institution: string` — renseignés à partir de `PlacementData`.
- `getCategory(): Category` — renvoie `DEFAULT_CATEGORY`.
- `getImposition(fiscalProfile, now?): number` — calcule l'impôt sur le revenu
  via `TaxCalculator.calculatePlacementTax` à partir de `getTaxableIncomes()`.
  Les modules l'appellent au sein de `getEvaluation` ; ils ne le réimplémentent
  pas.
- `toJSON(): PlacementData` — sérialise les champs de base ; les modules le
  surchargent et étendent `super.toJSON()`.

Membres abstraits qu'un module **doit** implémenter :
- `getEvaluation(fiscalProfile: FiscalProfile, now?: Date): Evaluation`
- `getTaxableIncomes(fiscalProfile: FiscalProfile, now?: Date): PlacementIncome[]`

Types issus de `BasePlacement.ts` :
- `PlacementType` — désormais un alias de `string` (le nom du dossier).
- `PlacementData` — `{ id?, type, label?, institution? }` ; les modules
  l'étendent avec leurs propres champs.
- `Evaluation` — `{ grossValue, netValueBeforeIR, socialCharges, latentGain,
  imposition, netValue? }`.
- `PlacementEditorConstructor` — `new (container: HTMLElement, store?: AppStore)
  => BasePlacementEditor`.

## Contrat de `Editor.ts`

Étend `BasePlacementEditor` (`src/ui/editors/BasePlacementEditor.ts`) ou
`SavingsAccountBaseEditor` (`src/ui/editors/SavingsAccountBaseEditor.ts`).

`BasePlacementEditor` fournit :
- `container: HTMLElement`, et la machinerie de callback `_onValidityChange`.
- `render(placement?)` — rend `_renderBeforeInstitution` + `_renderInstitution`
  + `_renderAfterInstitution`, puis appelle `_bindEvents()`.
- Hooks surchargeables : `_renderBeforeInstitution`, `_renderInstitution`,
  `_renderAfterInstitution`, `_bindEvents`, `isValid`, `getData`.
- `onValidityChange(callback)`, `_notifyValidityChange()`.

Un éditeur de module **doit** implémenter :
- `abstract buildTaxExplanation(placement: BasePlacement, fiscalProfile:
  FiscalProfile): string` — renvoie le HTML affiché dans le panneau
  d'explication fiscale. Les éditeurs délèguent généralement à leur
  `TaxExplanation.ts`.

Les éditeurs peuvent recevoir un `AppStore` optionnel
(`src/core/AppStore.ts`) en argument du constructeur (utilisé, par ex., par
l'éditeur immobilier pour détecter une résidence principale déjà déclarée).

## `TaxExplanation.ts` (optionnel)

Un simple utilitaire qui produit une chaîne HTML pour le panneau d'explication
fiscale. Il n'est importé que par le `Editor.ts` du module. Aucune forme
d'export n'est imposée ; les modules actuels exportent soit une fonction
(`getCtoTaxExplanation(placement, fiscalProfile)`), soit une classe statique
(`StockGrantTaxExplanation.get(placement, fiscalProfile)`).

## API de l'hôte utilisées par les modules actuels

Il s'agit de l'inventaire de ce que les modules existants importent/appellent.
C'est volontairement un simple recensement pour l'instant.

### Depuis `src/core/`
- `Category` (enum) et `CategoryValues` — depuis `Categories.ts`. Utilisés pour
  positionner `DEFAULT_CATEGORY`.
- `I18n` — depuis `I18n.ts`. Utilisé par les éditeurs via `I18n.t('form.*')`
  pour les libellés.
- `AppStore` (type) — depuis `AppStore.ts`. Utilisé par `RealEstateEditor` pour
  lire `store.state.placements`.

### Depuis `src/fiscality/`
- `SOCIAL_CONTRIBUTION_RATES`, `FISCAL_RATES` — depuis `rates.ts`. Utilisés par
  les modules pour les taux de prélèvements sociaux et de PFU.
- `TaxCalculator.calculatePlacementTax` — utilisé par
  `BasePlacement.getImposition` (non appelé directement par les modules).
- Les types `FiscalProfile`, `PlacementIncome` — depuis `TaxCalculator.ts`.
  Utilisés par chaque module dans `getEvaluation` / `getTaxableIncomes`.

### Depuis `src/i18n/` (utilitaires partagés, utilisés par `TaxExplanation.ts`)
- `commonTaxExplanations.ts` : `getPfuExplanation`, `getPfuHelpPopover`,
  `getTaxDisclaimer`, `getLatentGainsHelpPopover`, `getWarning`,
  `formatPercentage`, `formatCurrency`, et le type `PfuExplanationArgs`.
- Le `TaxExplanation.ts` global (`getTaxRulesHelpPopover`) et
  `commonTaxExplanations.ts` sont également utilisés par
  `ui/SettingsModalView.ts`, en dehors des modules.

### Depuis `src/ui/`
- `BasePlacementEditor` et `SavingsAccountBaseEditor` — classes de base des
  éditeurs.
- `HelpPopover` — depuis `ui/HelpPopover.ts`. Utilisé par certains
  `TaxExplanation.ts` (`HelpPopover.getHtml(...)`, `HelpPopover.register(...)`).

### Constantes inter-modules
Certains `TaxExplanation.ts` importent des constantes ré-exportées par leur
`module.ts` frère (par ex. `ACQUISITION_FEES_FLAT_RATE`, `CSG_2018_THRESHOLD`,
`PFU_AFTER_8Y_PRE_2017`, `StockGrantModule.THRESHOLD`, ...). Ce sont des
contrats internes au module, pas une API de l'hôte.

## Ajouter un nouveau module

1. Créer `placements/<nom>/` avec un `module.ts` (default-exportant une
   sous-classe de `BasePlacement`) et un `Editor.ts`. Ajouter un
   `TaxExplanation.ts` si nécessaire.
2. Ajouter une entrée à `web/modules.json` (`name`, `author`, `label`).
3. Recompiler (`npm run build`). Aucune autre modification de code n'est
   requise — la factory découvre le module depuis `modules.json` et câble son
   éditeur via `getEditorClass()`.

## Notes / limitations

- Le site est servi sous forme de bundle purement statique. `modules.json` doit
  être déployé en tant que ressource statique (le workflow GitHub Pages le
  copie dans `_site/`).
- Les chemins des `import()` dynamiques sont relatifs à la factory compilée
  (`dist/modules/PlacementFactory.js`) et résolvent vers
  `dist/placements/<nom>/module.js`.
- `PlacementFactory.loadModules()` doit être terminé avant toute utilisation
  synchrone de la factory ; `main.ts` le garantit.
