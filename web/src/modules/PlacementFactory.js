import { CheckingAccountModule } from './CheckingAccountModule.js';
import { PeaModule } from './PeaModule.js';
import { CtoModule } from './CtoModule.js';
import { SavingsAccountModule } from './SavingsAccountModule.js';
import { HomeSavingsModule } from './HomeSavingsModule.js';
import { RealEstateModule } from './RealEstateModule.js';
import { LifeInsuranceModule } from './LifeInsuranceModule.js';

const MODULE_REGISTRY = {
  checking_account: CheckingAccountModule,
  pea: PeaModule,
  cto: CtoModule,
  savings_account: SavingsAccountModule,
  home_savings: HomeSavingsModule,
  real_estate: RealEstateModule,
  life_insurance: LifeInsuranceModule
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
