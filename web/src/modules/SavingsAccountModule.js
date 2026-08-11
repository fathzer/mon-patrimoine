import { SavingsAccountBaseModule } from './SavingsAccountBaseModule.js';
import { SavingsAccountEditor } from '../ui/editors/SavingsAccountEditor.js';

export class SavingsAccountModule extends SavingsAccountBaseModule {
  static getEditorClass() {
    return SavingsAccountEditor;
  }
}
