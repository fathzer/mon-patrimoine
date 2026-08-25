import { CheckingAccountModule } from './CheckingAccountModule.js';
import { PeaModule } from './PeaModule.js';
import { CtoModule } from './CtoModule.js';
import { StockGrantModule } from './StockGrantModule.js';
import { SavingsAccountModule } from './SavingsAccountModule.js';
import { HomeSavingsModule } from './HomeSavingsModule.js';
import { RealEstateModule } from './RealEstateModule.js';
import { LifeInsuranceModule } from './LifeInsuranceModule.js';
import { BasePlacement, PlacementType, PlacementEditorConstructor } from './BasePlacement.js';
import type { PlacementData } from './BasePlacement.js';

type PlacementConstructor = new (data: PlacementData) => BasePlacement;

interface PlacementModuleStatic {
  getEditorClass(): PlacementEditorConstructor;
}

const MODULE_REGISTRY: Record<PlacementType, PlacementConstructor> = {
  [PlacementType.CHECKING_ACCOUNT]: CheckingAccountModule,
  [PlacementType.PEA]: PeaModule,
  [PlacementType.CTO]: CtoModule,
  [PlacementType.STOCK_GRANT]: StockGrantModule,
  [PlacementType.SAVINGS_ACCOUNT]: SavingsAccountModule,
  [PlacementType.HOME_SAVINGS]: HomeSavingsModule,
  [PlacementType.REAL_ESTATE]: RealEstateModule,
  [PlacementType.LIFE_INSURANCE]: LifeInsuranceModule
};

export class PlacementFactory {
  static _getModuleClass(type: PlacementType): PlacementConstructor {
    const ModuleClass = MODULE_REGISTRY[type];
    if (!ModuleClass) {
      throw new Error(`Unknown placement type: ${type}`);
    }
    return ModuleClass;
  }

  static create(placementData: PlacementData): BasePlacement {
    return new (this._getModuleClass(placementData.type))(placementData);
  }

  static getEditorClass(type: PlacementType): PlacementEditorConstructor {
    return (this._getModuleClass(type) as unknown as PlacementModuleStatic).getEditorClass();
  }
}
