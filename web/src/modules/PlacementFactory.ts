import { BasePlacement } from './BasePlacement.js';
import type { PlacementData, PlacementEditorConstructor, PlacementType } from './BasePlacement.js';

/**
 * Definition of a placement module, as declared in `modules.json`.
 * `name` is both the folder name under `placements/` and the value used as
 * `PlacementData.type`.
 */
export interface ModuleDefinition {
  name: string;
  author: string;
  label: string;
}

type PlacementConstructor = new (data: PlacementData) => BasePlacement;

interface PlacementModuleStatic {
  getEditorClass(): PlacementEditorConstructor;
}

interface LoadedModule {
  definition: ModuleDefinition;
  ModuleClass: PlacementConstructor;
}

const PLACEMENTS_BASE = '../placements/';

export class PlacementFactory {
  private static _definitions: ModuleDefinition[] = [];
  private static _registry: Map<PlacementType, LoadedModule> = new Map();
  private static _loaded = false;

  /**
   * Loads `modules.json` and dynamically imports every declared module.
   * Must be awaited once, before any `create` / `getEditorClass` call.
   */
  static async loadModules(jsonUrl: string = './modules.json'): Promise<void> {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to load modules.json: ${response.status} ${response.statusText}`);
    }
    const definitions: ModuleDefinition[] = await response.json();

    this._definitions = definitions;
    this._registry = new Map();

    for (const definition of definitions) {
      const moduleUrl = `${PLACEMENTS_BASE}${definition.name}/module.js`;
      const mod = await import(moduleUrl);
      const ModuleClass = (mod.default ?? mod[Object.keys(mod)[0]]) as PlacementConstructor;
      if (!ModuleClass) {
        throw new Error(`Module '${definition.name}' does not export a placement class.`);
      }
      this._registry.set(definition.name, { definition, ModuleClass });
    }

    this._loaded = true;
  }

  static isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Returns the list of declared module definitions, in `modules.json` order.
   */
  static getDefinitions(): ModuleDefinition[] {
    return this._definitions;
  }

  static _getModule(type: PlacementType): LoadedModule {
    if (!this._loaded) {
      throw new Error('PlacementFactory.loadModules() must be awaited before use.');
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

  static getEditorClass(type: PlacementType): PlacementEditorConstructor {
    const ModuleClass = this._getModule(type).ModuleClass;
    return (ModuleClass as unknown as PlacementModuleStatic).getEditorClass();
  }

  static getDefinition(type: PlacementType): ModuleDefinition {
    return this._getModule(type).definition;
  }
}
