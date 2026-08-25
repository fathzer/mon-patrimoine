/**
 * Placement Kit v1 - Public API for placement modules.
 *
 * This barrel is the ONLY entry point that placement modules should import
 * from. It exposes a stable, versioned contract:
 * everything re-exported here is guaranteed to remain available (with compatible
 * signatures) for the lifetime of v1. Anything NOT exported here is considered
 * internal implementation and may change without notice.
 *
 * If a breaking change is needed, create a new version directory (e.g. v2/)
 * and keep this one intact so existing modules continue to work.
 */

// --- Base classes and core types ---
export { BasePlacement } from '../../../modules/BasePlacement.js';
export type { PlacementData, Evaluation, PlacementEditorConstructor, PlacementModuleStatic } from '../../../modules/BasePlacement.js';

// --- Editor base classes ---
export { BasePlacementEditor } from '../../../ui/editors/BasePlacementEditor.js';

// --- Categories ---
export { Category, CategoryValues } from '../../../core/Categories.js';

// --- I18n (shared labels only; placement-specific labels live in the module) ---
export { I18n } from '../../../core/I18n.js';

// --- AppStore (type only - passed to editors that need it) ---
export type { AppStore } from '../../../core/AppStore.js';

// --- Fiscal types ---
export type { FiscalProfile, PlacementIncome } from '../../../fiscality/TaxCalculator.js';

// --- Tax calculator ---
export { TaxCalculator } from '../../../fiscality/TaxCalculator.js';

// --- Fiscal rates ---
export { SOCIAL_CONTRIBUTION_RATES, FISCAL_RATES } from '../../../fiscality/rates.js';
export type { TaxBracket } from '../../../fiscality/rates.js';

// --- Help popover ---
export { HelpPopover } from '../../../ui/HelpPopover.js';

// --- Shared tax explanation helpers ---
export {
  getPfuExplanation,
  getPfuHelpPopover,
  getTaxDisclaimer,
  getLatentGainsHelpPopover,
  getWarning,
  formatPercentage,
  formatCurrency
} from '../../../i18n/commonTaxExplanations.js';
export type { PfuExplanationArgs } from '../../../i18n/commonTaxExplanations.js';
