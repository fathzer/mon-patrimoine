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

Ce fichier JSON n'existe que pour pallier l'impossibilité de lister le contenu
d'un répertoire servi par GitHub Pages. Les métadonnées (libellé, catégorie,
etc.) sont fournies par le module lui-même via ses méthodes statiques.

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

Un `module.ts` doit **default-exporter** une classe étendant `BasePlacement`.
Tous les imports externes au module doivent provenir du **kit** (`kit/v1/`) :

```ts
import { BasePlacement, Category } from '../kit/v1/index.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../kit/v1/index.js';
import { MonEditeur } from './Editor.js';

export class MonModule extends BasePlacement {
  static getCategory(): Category { return Category.X; }
  static getLabel(): string { return 'Mon Placement'; }
  static getEditorClass() { return MonEditeur; }

  constructor(data: MesDonnees) { super(data); /* ... */ }

  override getEvaluation(fiscalProfile: FiscalProfile, now?: Date): Evaluation { /* ... */ }
  override getTaxableIncomes(fiscalProfile: FiscalProfile, now?: Date): PlacementIncome[] { /* ... */ }
  override toJSON(): MesDonnees { return { ...super.toJSON(), /* ... */ }; }
}

const _check: PlacementModuleStatic = MonModule;
export default MonModule;
```

## Le Placement Kit (`kit/v1/`)

Le kit est le **seul** point d'entrée que les modules de placement doivent
utiliser pour accéder à l'API de l'hôte. Il est versionné : `kit/v1/` est
garanti stable. Tout ce qui n'est pas exporté par le kit est considéré comme
interne et peut changer sans préavis.

En cas de changement cassant, une nouvelle version (ex. `kit/v2/`) sera créée,
et `kit/v1/` sera conservé pour ne pas casser les modules existants.

### Symboles exportés par `kit/v1/index.ts`

**Classes de base :**
- `BasePlacement` — classe de base abstraite pour les placements.
- `BasePlacementEditor` — classe de base pour les éditeurs.

**Types :**
- `PlacementData`, `Evaluation`, `PlacementEditorConstructor`,
  `PlacementModuleStatic` — depuis `BasePlacement.ts`.
- `FiscalProfile`, `PlacementIncome` — depuis `TaxCalculator.ts`.
- `AppStore` — type transmis aux éditeurs qui en ont besoin.
- `PfuExplanationArgs` — arguments pour `getPfuExplanation`.
- `TaxBracket` — tranche d'imposition.

**Catégories :**
- `Category` (enum), `CategoryValues` — depuis `Categories.ts`.

**Fiscalité :**
- `TaxCalculator` — calculateur d'impôt (utilisé en interne par
  `BasePlacement.getImposition`).
- `SOCIAL_CONTRIBUTION_RATES`, `FISCAL_RATES` — taux et barèmes.

**I18n :**
- `I18n` — accès aux libellés partagés (`I18n.t('form.currentValue')`, etc.).
  Les libellés spécifiques à un placement doivent être définis localement dans
  l'éditeur (const `labels`).

**Aide contextuelle :**
- `HelpPopover` — création de popovers d'aide en HTML.

**Utilitaires d'explication fiscale (depuis `commonTaxExplanations.ts`) :**
- `getPfuExplanation`, `getPfuHelpPopover`, `getTaxDisclaimer`,
  `getLatentGainsHelpPopover`, `getWarning`, `formatPercentage`,
  `formatCurrency`.

### CSS disponible pour les modules

Les classes CSS suivantes sont garanties stables et utilisables par les
modules dans leur HTML :

| Classe | Fichier CSS | Usage |
|--------|-------------|-------|
| `form-group` | `components/forms.css` | Conteneur d'un champ de formulaire |
| `form-control` | `components/forms.css` | Input/select stylisé |
| `btn-primary` | `components/buttons.css` | Bouton principal |
| `btn-secondary` | `components/buttons.css` | Bouton secondaire |
| `btn-danger` | `components/buttons.css` | Bouton de suppression |
| `text-muted` | `components/utilities.css` | Texte atténué |
| `tax-explanation` | `components/tax-explanation.css` | Conteneur d'explication fiscale |

Tout autre style doit être défini en inline dans l'éditeur ou via des classes
propres au module. Les classes non listées ci-dessus peuvent changer ou
disparaître sans préavis.

### Contrat de `BasePlacement`

TypeScript ne supportant pas `abstract static`, les membres statiques obligatoires
sont décrits par l'interface `PlacementModuleStatic` (exportée par le kit). Chaque
module se vérifie lui-même à la compilation avec une ligne
`const _check: PlacementModuleStatic = MonModule;` — si un module oublie
`getCategory()`, `getLabel()` ou `getEditorClass()`, `tsc` refuse de compiler.

Membres statiques (obligatoires, vérifiés via `PlacementModuleStatic`) :
- `static getCategory(): Category` — renvoie la catégorie du placement. Doit
  être une valeur de `Category`. Vérifié également au runtime dans le
  constructeur.
- `static getLabel(): string` — renvoie le libellé affiché dans la liste
  déroulante « type » du formulaire de placement.
- `static getEditorClass(): PlacementEditorConstructor` — renvoie la classe
  d'éditeur du module.

Membres d'instance fournis par la classe de base :
- `id: string`, `type: string` (nom du dossier), `label: string`,
  `institution: string` — renseignés à partir de `PlacementData`.
- `getImposition(fiscalProfile, now?): number` — calcule l'impôt sur le revenu
  via `TaxCalculator.calculatePlacementTax` à partir de `getTaxableIncomes()`.
  Les modules l'appellent au sein de `getEvaluation` ; ils ne le réimplémentent
  pas.
- `toJSON(): PlacementData` — sérialise les champs de base ; les modules le
  surchargent et étendent `super.toJSON()`.

Membres abstraits qu'un module **doit** implémenter :
- `getEvaluation(fiscalProfile: FiscalProfile, now?: Date): Evaluation`
- `getTaxableIncomes(fiscalProfile: FiscalProfile, now?: Date): PlacementIncome[]`

Types :
- `PlacementData` — `{ id?, type, label?, institution? }` ; les modules
  l'étendent avec leurs propres champs.
- `Evaluation` — `{ grossValue, netValueBeforeIR, socialCharges, latentGain,
  imposition, netValue? }`.
- `PlacementEditorConstructor` — `new (container: HTMLElement, store?: AppStore)
  => BasePlacementEditor`.

## Contrat de `Editor.ts`

Étend `BasePlacementEditor` ou `SavingsAccountBaseEditor` (tous deux exportés
par le kit). Tous les imports externes au module doivent provenir du kit.

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

Les éditeurs peuvent recevoir un `AppStore` optionnel en argument du
constructeur (utilisé, par ex., par l'éditeur immobilier pour détecter une
résidence principale déjà déclarée).

Les libellés spécifiques à un placement doivent être définis localement dans
l'éditeur via une `const labels = { ... }`, et non via `I18n.t()`. Seuls les
libellés partagés (`form.currentValue`, `form.openingDate`, `form.institution`,
`form.label`, `form.close`, etc.) restent accessibles via `I18n.t()`.

## `TaxExplanation.ts` (optionnel)

Un simple utilitaire qui produit une chaîne HTML pour le panneau d'explication
fiscale. Il n'est importé que par le `Editor.ts` du module. Aucune forme
d'export n'est imposée ; les modules actuels exportent soit une fonction
(`getCtoTaxExplanation(placement, fiscalProfile)`), soit une classe statique
(`StockGrantTaxExplanation.get(placement, fiscalProfile)`).

Les utilitaires partagés (`getPfuExplanation`, `formatPercentage`,
`HelpPopover`, etc.) sont accessibles via le kit.

### Constantes inter-modules
Certains `TaxExplanation.ts` importent des constantes exportées par leur
`module.ts` frère (par ex. `ACQUISITION_FEES_FLAT_RATE`, `CSG_2018_THRESHOLD`,
`PFU_AFTER_8Y_PRE_2017`, `StockGrantModule.THRESHOLD`, ...). Ce sont des
contrats internes au module, pas une API de l'hôte.

## Ajouter un nouveau module

1. Créer `placements/<nom>/` avec un `module.ts` (default-exportant une
   sous-classe de `BasePlacement`) et un `Editor.ts`. Ajouter un
   `TaxExplanation.ts` si nécessaire.
2. Tous les imports externes doivent provenir de `../kit/v1/index.js`.
3. Ajouter une entrée à `web/modules.json` (`name`).
4. Recompiler (`npm run build`). Aucune autre modification de code n'est
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
