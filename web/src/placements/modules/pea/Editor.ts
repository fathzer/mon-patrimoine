import { BasePlacementEditor, I18n, ToggleSwitch } from '../../kit/v1/index.js';
import { checkPerPlanCap, checkCombinedCap } from './Caps.js';
import type { BasePlacement, AppStore } from '../../kit/v1/index.js';
import type { PeaModule, PeaType } from './module.js';

const labels = {
  totalDeposits: 'Total des versements (€)',
  peaType: 'Type de plan',
  pea: 'PEA',
  peaPme: 'PEA-PME'
};

const COUPLE_STATUSES = new Set(['married', 'pacsed']);

export class PeaEditor extends BasePlacementEditor {
  private readonly store: AppStore | undefined;
  private currentPlacementId: string | undefined;

  constructor(container: HTMLElement, store?: AppStore) {
    super(container);
    this.store = store;
  }

  protected override renderBeforeInstitution(placement: BasePlacement | null): string {
    this.currentPlacementId = placement?.id;
    const p = placement as PeaModule | null;
    const isPeaPme = p?.peaType === 'pea_pme';
    return `
      <div class="form-group">
        <label>${labels.peaType}</label>
        ${ToggleSwitch.create({
          name: 'peaType',
          labelOff: labels.pea,
          labelOn: labels.peaPme,
          checked: isPeaPme
        })}
      </div>
      <div id="pea-count-warning" class="form-group text-muted" style="font-size: 0.8rem; display: none; color: var(--danger);">
      </div>
    `;
  }

  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as PeaModule | null;
    return `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.totalDeposits}</label>
        <input type="number" step="0.01" name="totalDeposits" class="form-control" value="${p?.totalDeposits || 0}" />
      </div>
      <div id="pea-cap-warning" class="form-group text-muted" style="font-size: 0.8rem; display: none; color: var(--danger);">
      </div>
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${p?.openingDate || ''}" required />
      </div>
    `;
  }

  protected override bindPlacementEvents(): void {
    this.updatePeaCountWarning();
    this.updateCapWarning();

    const peaTypeCheckbox = this.container.querySelector<HTMLInputElement>('input[name="peaType"]');
    peaTypeCheckbox?.addEventListener('change', () => {
      this.updatePeaCountWarning();
      this.updateCapWarning();
      this.notifyValidityChange();
    });

    (['currentValue', 'totalDeposits', 'openingDate'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => {
        if (name === 'totalDeposits') this.updateCapWarning();
        this.notifyValidityChange();
      });
    });
  }

  private updatePeaCountWarning(): void {
    const warning = this.container.querySelector<HTMLElement>('#pea-count-warning');
    if (!warning) return;

    const selectedType = this.getSelectedPeaType();
    const isCouple = COUPLE_STATUSES.has(this.store?.getTaxProfile()?.household?.maritalStatus ?? '');
    const maxCount = isCouple ? 2 : 1;
    const planLabel = selectedType === 'pea_pme' ? labels.peaPme : labels.pea;
    const statusLabel = isCouple ? 'Un couple' : 'Un célibataire';

    const tooMany = this.hasTooManyPeaOfType(selectedType, maxCount);
    if (tooMany) {
      warning.textContent = `${statusLabel} ne peut détenir plus de ${maxCount} ${planLabel}.`;
    }
    warning.style.display = tooMany ? 'block' : 'none';
  }

  private getSelectedPeaType(): PeaType {
    const checkbox = this.container.querySelector<HTMLInputElement>('input[name="peaType"]');
    return checkbox?.checked ? 'pea_pme' : 'pea';
  }

  private hasTooManyPeaOfType(peaType: PeaType, maxCount: number): boolean {
    const placements = this.store?.state?.placements || [];
    const currentId = this.currentPlacementId;

    const count = placements.filter(p =>
      p.type === 'pea' &&
      (p as PeaModule).peaType === peaType &&
      p.id !== currentId
    ).length;

    return count >= maxCount;
  }

  private updateCapWarning(): void {
    const warning = this.container.querySelector<HTMLElement>('#pea-cap-warning');
    if (!warning) return;

    const selectedType = this.getSelectedPeaType();
    const currentDeposits = Number(this.container.querySelector<HTMLInputElement>('input[name="totalDeposits"]')?.value) || 0;
    const isCouple = COUPLE_STATUSES.has(this.store?.getTaxProfile()?.household?.maritalStatus ?? '');

    const { peaDeposits, peaPmeDeposits } = this.collectAllDeposits(selectedType, currentDeposits);

    const perPlanWarning = checkPerPlanCap(selectedType, currentDeposits);
    const combinedWarning = checkCombinedCap(peaDeposits, peaPmeDeposits, isCouple);

    const messages: string[] = [];
    if (perPlanWarning) messages.push(perPlanWarning.message);
    if (combinedWarning) messages.push(combinedWarning.message);

    if (messages.length > 0) {
      warning.innerHTML = messages.map(m => `<p style="margin: 0 0 0.3rem 0;">${m}</p>`).join('');
      warning.style.display = 'block';
    } else {
      warning.style.display = 'none';
    }
  }

  private collectAllDeposits(currentType: PeaType, currentDeposits: number): { peaDeposits: number[]; peaPmeDeposits: number[] } {
    const placements = this.store?.state?.placements || [];
    const currentId = this.currentPlacementId;

    const peaDeposits: number[] = [];
    const peaPmeDeposits: number[] = [];

    for (const p of placements) {
      if (p.type !== 'pea' || p.id === currentId) continue;
      const pea = p as PeaModule;
      if (pea.peaType === 'pea_pme') {
        peaPmeDeposits.push(pea.totalDeposits);
      } else {
        peaDeposits.push(pea.totalDeposits);
      }
    }

    // Include the current plan being edited
    if (currentType === 'pea_pme') {
      peaPmeDeposits.push(currentDeposits);
    } else {
      peaDeposits.push(currentDeposits);
    }

    return { peaDeposits, peaPmeDeposits };
  }

  protected override isPlacementValid(): boolean {
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const openingDateValid = openingDate ? openingDate.checkValidity() : true;
    return currentValueValid && openingDateValid;
  }

  protected override collectData(): Record<string, unknown> {
    return {
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      totalDeposits: Number(this.container.querySelector<HTMLInputElement>('input[name="totalDeposits"]')?.value) || 0,
      openingDate: this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || '',
      peaType: this.getSelectedPeaType()
    };
  }
}
