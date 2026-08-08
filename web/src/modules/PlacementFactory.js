import { CheckingAccountModule } from './CheckingAccountModule.js';
import { PeaModule } from './PeaModule.js';

const MODULE_REGISTRY = {
  checking_account: CheckingAccountModule,
  pea: PeaModule
};

export class PlacementFactory {
  static create(placementData) {
    const ModuleClass = MODULE_REGISTRY[placementData.type];
    if (!ModuleClass) {
      return new CheckingAccountModule(placementData);
    }
    return new ModuleClass(placementData);
  }
}
