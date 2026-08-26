import { BasePlacement } from './BasePlacement.js';
import type { PlacementData, PlacementEditorConstructor, PlacementModuleStatic } from './BasePlacement.js';
import type { Category } from '../core/Categories.js';
import type { FiscalProfile } from '../fiscality/TaxCalculator.js';

/**
 * Definition of a placement module, as declared in `placements.json`.
 * `name` is both the folder name under `placements/modules/` and the value used
 * as `PlacementData.type`. The JSON exists only to work around the inability to
 * list directory contents on a static host (GitHub Pages).
 */
export interface ModuleDefinition {
  name: string;
}

type PlacementConstructor = new (data: PlacementData) => BasePlacement;

interface LoadedModule {
  definition: ModuleDefinition;
  ModuleClass: PlacementConstructor;
}

interface FailedModule {
  definition: ModuleDefinition;
  error: Error;
}

const PLACEMENTS_BASE = './modules/';

export class PlacementFactory {
  private static _definitions: ModuleDefinition[] = [];
  private static _registry: Map<string, LoadedModule> = new Map();
  private static _failures: Map<string, FailedModule> = new Map();
  private static _loaded = false;

  /**
   * Loads `placements.json` and dynamically imports every declared module.
   * All modules are imported in parallel. If a module fails to load, it is
   * recorded as a failure but does not prevent other modules from loading.
   * After this resolves, `isLoaded()` returns true regardless of individual
   * module failures; use `hasError(name)` to check per-module status.
   * Must be awaited once, before any `create` / `getEditorClass` call.
   */
  static async loadModules(jsonUrl: string = './placements.json'): Promise<void> {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to load placements.json: ${response.status} ${response.statusText}`);
    }
    const definitions: ModuleDefinition[] = await response.json();

    this._definitions = definitions;
    this._registry = new Map();
    this._failures = new Map();

    const results = await Promise.allSettled(
      definitions.map(async (definition) => {
        const moduleUrl = `${PLACEMENTS_BASE}${definition.name}/module.js`;
        const mod = await import(moduleUrl);
        const ModuleClass = (mod.default ?? mod[Object.keys(mod)[0]]) as PlacementConstructor;
        if (!ModuleClass) {
          throw new Error(`Module '${definition.name}' does not export a placement class.`);
        }
        return { definition, ModuleClass };
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const definition = definitions[i];
      if (result.status === 'fulfilled') {
        this._registry.set(definition.name, result.value);
      } else {
        const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        this._failures.set(definition.name, { definition, error });
        console.error(`Failed to load placement module '${definition.name}':`, error);
      }
    }

    this._loaded = true;
  }

  static isLoaded(): boolean {
    return this._loaded;
  }

  static hasError(name: string): boolean {
    return this._failures.has(name);
  }

  static getErrors(): { name: string; error: Error }[] {
    return Array.from(this._failures.values()).map(({ definition, error }) => ({
      name: definition.name,
      error
    }));
  }

  /**
   * Returns the list of declared module definitions, in `placements.json` order.
   */
  static getDefinitions(): ModuleDefinition[] {
    return this._definitions;
  }

  static _getModule(type: string): LoadedModule {
    if (!this._loaded) {
      throw new Error('PlacementFactory.loadModules() must be awaited before use.');
    }
    const failed = this._failures.get(type);
    if (failed) {
      throw new Error(`Placement module '${type}' failed to load: ${failed.error.message}`);
    }
    const loaded = this._registry.get(type);
    if (!loaded) {
      throw new Error(`Unknown placement type: ${type}`);
    }
    return loaded;
  }

  static create(placementData: PlacementData): BasePlacement {
    return new (this._getModule(placementData.type).ModuleClass)(placementData);
  }

  static getEditorClass(type: string): PlacementEditorConstructor {
    const ModuleClass = this._getModule(type).ModuleClass;
    return (ModuleClass as unknown as PlacementModuleStatic).getEditorClass();
  }

  static getLabel(type: string): string {
    const ModuleClass = this._getModule(type).ModuleClass;
    return (ModuleClass as unknown as PlacementModuleStatic).getLabel();
  }

  static getCategory(type: string): Category {
    const ModuleClass = this._getModule(type).ModuleClass;
    return (ModuleClass as unknown as PlacementModuleStatic).getCategory();
  }

  static getTaxExplanation(type: string, placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    const ModuleClass = this._getModule(type).ModuleClass;
    return (ModuleClass as unknown as PlacementModuleStatic).getTaxExplanation(placement, fiscalProfile);
  }

  static getDefinition(type: string): ModuleDefinition {
    return this._getModule(type).definition;
  }
}
