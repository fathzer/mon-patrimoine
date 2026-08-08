import { BasePlacementUI } from './BasePlacementUI.js';
import { PeaUI } from './PeaUI.js';

const UI_REGISTRY = {
  pea: PeaUI
};

export class PlacementUIFactory {
  static createUI(placementInstance) {
    const UIClass = UI_REGISTRY[placementInstance.type] || BasePlacementUI;
    return new UIClass(placementInstance);
  }
}
