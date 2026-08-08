import { BasePlacementUI } from './BasePlacementUI.js';

export class PeaUI extends BasePlacementUI {
  renderCard(evaluation) {
    const card = super.renderCard(evaluation);
    const body = card.querySelector('.card-body');

    const extra = document.createElement('div');
    extra.innerHTML = `
      <div class="metric" style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
        <span>Plus-value: ${this.formatCurrency(evaluation.latentGain)}</span>
        <span>PS: -${this.formatCurrency(evaluation.socialCharges)}</span>
      </div>
    `;
    body.appendChild(extra);
    return card;
  }
}
