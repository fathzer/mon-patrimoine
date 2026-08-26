# Modules de placement (système de plugins)

Le projet est organisé pour que le développement et l'ajout de modules de placement soient simples. Chaque type de placement est géré par un module indépendant, avec une interface commune.

Le répertoire `web/src/placements/modules/` contient les modules de placement de l'application.  
Chaque sous-dossier correspond à un type de placement et est chargé au démarrage par `web/src/placements/PlacementFactory.ts` à partir
des entrées déclarées dans le fichier `web/placements.json`.

Ce document décrit l'organisation des dossiers, le contrat auquel un module doit se conformer, ainsi que les API utilisables par les modules.

## Organisation des dossiers

```
placements/
  <nom>/                 # <nom> = type de placement = PlacementData.type
    module.ts             # obligatoire (nom imposé par PlacementFactory)
    Editor.ts             # convention : l'éditeur du placement
    TaxExplanation.ts     # convention : explication fiscale HTML
```

Le seul fichier dont le nom est imposé par le système est `module.ts` :
`PlacementFactory` fait un `import('./modules/<nom>/module.js')` dynamique.
Pour le reste, le module est libre de s'organiser comme il veut — il doit
seulement respecter le contrat de `PlacementModuleStatic` (retourner une classe
d'éditeur via `getEditorClass()`, une fonction d'explication fiscale via
`getTaxExplanation`, etc.).

Les noms `Editor.ts` et `TaxExplanation.ts` sont des conventions partagées par
tous les modules actuels, pas une exigence du système.

`<nom>` doit correspondre au champ `name` d'une entrée de `web/placements.json`,
par ex. `cto`, `pea`, `real_estate`, `stock_grant`, ...

## `web/placements.json`

Un tableau JSON de définitions de modules, lu une fois au démarrage par
`PlacementFactory.loadModules()`. Chaque entrée comporte actuellement :

| champ    | type   | signification                                                       |
|----------|--------|---------------------------------------------------------------------|
| `name`   | string | Nom du dossier sous `placements/`. Aussi utilisé comme `PlacementData.type`. |

Ce fichier JSON est nécessaire car GitHub Pages ne permet pas de lister le contenu
d'un répertoire. Les métadonnées (libellé, catégorie, etc.) sont fournies par
le module lui-même via ses méthodes statiques.

## Chargement

`PlacementFactory.loadModules()` (dans `src/placements/PlacementFactory.ts`) :

1. `fetch('./placements.json')` (servi en tant que ressource statique).
2. Pour chaque définition, fait un `import('./modules/<nom>/module.js')`
   dynamique. Les imports sont lancés en parallèle via `Promise.allSettled()` ;
   un module en échec n'empêche pas les autres de se charger.
3. Récupère l'**export par défaut** comme classe de placement et l'enregistre
   sous la clé `definition.name`.
4. Une fois la promesse résolue, `PlacementFactory.create(type)`,
   `PlacementFactory.getEditorClass(type)` et
   `PlacementFactory.getTaxExplanation(type, ...)` sont utilisables de façon
   synchrone.

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
import { getMonTaxExplanation } from './TaxExplanation.js';

export class MonModule extends BasePlacement {
  static getCategory(): Category { return Category.X; }
  static getLabel(): string { return 'Mon Placement'; }
  static getEditorClass() { return MonEditeur; }
  static getTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getMonTaxExplanation(placement as MonModule, fiscalProfile);
  }

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
  `PlacementModuleStatic`, `TaxExplanationProvider` — depuis `BasePlacement.ts`.
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
`getCategory()`, `getLabel()`, `getEditorClass()` ou `getTaxExplanation()`, `tsc` refuse de compiler.

Membres statiques (obligatoires, vérifiés via `PlacementModuleStatic`) :
- `static getCategory(): Category` — renvoie la catégorie du placement. Doit
  être une valeur de `Category`. Vérifié également au runtime dans le
  constructeur.
- `static getLabel(): string` — renvoie le libellé affiché dans la liste
  déroulante « type » du formulaire de placement.
- `static getEditorClass(): PlacementEditorConstructor` — renvoie la classe
  d'éditeur du module.
- `static getTaxExplanation: TaxExplanationProvider` — fonction qui renvoie le
  HTML affiché dans le panneau d'explication fiscale. La signature
  `TaxExplanationProvider` est `(placement: BasePlacement, fiscalProfile:
  FiscalProfile) => string`, exportée par le kit. Les modules délèguent
  généralement à leur `TaxExplanation.ts`.

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

## Contrat de l'éditeur

L'éditeur étend `BasePlacementEditor` ou `SavingsAccountBaseEditor` (tous deux
exportés par le kit). Tous les imports externes au module doivent provenir du
kit. Les modules actuels placent l'éditeur dans un fichier `Editor.ts` par
convention, mais le système n'impose ni ce nom ni ce fichier — seul compte ce
que `getEditorClass()` retourne.

`BasePlacementEditor` utilise le pattern template-method : les méthodes
publiques (`render`, `isValid`, `getData`) et privées (`bindEvents`) orchestrent
la logique de base (champ institution) et délèguent aux hooks protected ci-
dessous. Les sous-classes surchargent les hooks, jamais les méthodes
orchestratrices — la logique de base est ainsi garantie.

Membres publics (appelés par l'hôte — ne pas surcharger) :
- `render(placement?)` — rend le formulaire dans `container`.
- `onValidityChange(callback)` — enregistre un callback de validité.
- `isValid(): boolean` — validité du formulaire (champ institution + hook).
- `getData(): EditorData` — valeurs du formulaire (institution + hook).

Hooks protected (surchargeables, sans besoin d'appeler `super`) :
- `hasInstitution(): boolean` — retourne `true` par défaut. Retourner `false`
  pour un placement sans institution (ex. immobilier).
- `renderBeforeInstitution(placement): string` — HTML avant le champ
  institution. Défaut : chaîne vide.
- `renderAfterInstitution(placement): string` — HTML après le champ
  institution. Défaut : chaîne vide.
- `bindPlacementEvents(): void` — bindings spécifiques au placement.
  Défaut : no-op.
- `isPlacementValid(): boolean` — validation spécifique. Défaut : `true`.
- `collectData(): EditorData` — extraction spécifique. Défaut : `{}`.
- `notifyValidityChange(): void` — notifie l'hôte d'un changement de validité.
  À appeler depuis les listeners de l'éditeur.

Les éditeurs peuvent recevoir un `AppStore` optionnel en argument du
constructeur (utilisé, par ex., par l'éditeur immobilier pour détecter une
résidence principale déjà déclarée).

Les libellés spécifiques à un placement doivent être définis localement dans
l'éditeur via une `const labels = { ... }`, et non via `I18n.t()`. Seuls les
libellés partagés (`form.currentValue`, `form.openingDate`, `form.institution`,
`form.label`, `form.close`, etc.) restent accessibles via `I18n.t()`.

## Explication fiscale

Le module fournit une fonction `getTaxExplanation` conforme au type `TaxExplanationProvider`
(exporté par le kit) :

```ts
type TaxExplanationProvider = (placement: BasePlacement, fiscalProfile: FiscalProfile) => string;
```

Le module est libre d'implémenter cette fonction comme il le veut — inline dans
`module.ts`, ou déléguée à un fichier séparé. Les modules actuels utilisent par
convention un fichier `TaxExplanation.ts` qui exporte soit une fonction
(`getCtoTaxExplanation(placement, fiscalProfile)`), soit une classe statique
(`StockGrantTaxExplanation.get(placement, fiscalProfile)`). Aucune forme d'export
n'est imposée — seul compte ce que `getTaxExplanation` retourne.

Les utilitaires partagés (`getPfuExplanation`, `formatPercentage`,
`HelpPopover`, etc.) sont accessibles via le kit.

### Constantes inter-modules
Certains modules importent des constantes exportées par leur `module.ts` frère
(par ex. `ACQUISITION_FEES_FLAT_RATE`, `CSG_2018_THRESHOLD`,
`PFU_AFTER_8Y_PRE_2017`, `StockGrantModule.THRESHOLD`, ...). Ce sont des
contrats internes au module, pas une API de l'hôte.

## Ajouter un nouveau module

1. Créer `placements/<nom>/` avec un `module.ts` (default-exportant une
   sous-classe de `BasePlacement`). L'éditeur peut être placé dans un
   `Editor.ts` (convention), et l'explication fiscale dans un
   `TaxExplanation.ts` (convention) — mais le système n'impose que `module.ts`.
2. Tous les imports externes doivent provenir de `../kit/v1/index.js`.
3. Ajouter une entrée à `web/placements.json` (`name`).
4. Recompiler (`npm run build`). Aucune autre modification de code n'est
   requise — la factory découvre le module depuis `placements.json`, câble son
   éditeur via `getEditorClass()` et son explication fiscale via
   `getTaxExplanation()`.

## Notes / limitations

- Le site est servi sous forme de bundle purement statique. `placements.json`
  doit être déployé en tant que ressource statique (le workflow GitHub Pages le
  copie dans `_site/`).
- Les chemins des `import()` dynamiques sont relatifs à la factory compilée
  (`dist/placements/PlacementFactory.js`) et résolvent vers
  `dist/placements/modules/<nom>/module.js`.
- `PlacementFactory.loadModules()` doit être terminé avant toute utilisation
  synchrone de la factory ; `main.ts` le garantit.
