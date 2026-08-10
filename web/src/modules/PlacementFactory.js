import { CheckingAccountModule } from './CheckingAccountModule.js';
import { PeaModule } from './PeaModule.js';
import { SavingsAccountModule } from './SavingsAccountModule.js';

const MODULE_REGISTRY = {
  checking_account: CheckingAccountModule,
  pea: PeaModule,
  savings_account: SavingsAccountModule
};

export class PlacementFactory {
  static _getModuleClass(type) {
    const ModuleClass = MODULE_REGISTRY[type];
    if (!ModuleClass) {
      throw new Error(`Unknown placement type: ${type}`);
    }
    return ModuleClass;
  }

  static create(placementData) {
    return new (this._getModuleClass(placementData.type))(placementData);
  }

  static getEditorClass(type) {
    return this._getModuleClass(type).getEditorClass();
  }
}
