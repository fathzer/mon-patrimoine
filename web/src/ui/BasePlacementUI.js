export class BasePlacementUI {
  constructor(placementInstance) {
    this.placement = placementInstance;
  }

  renderCard(evaluation) {
    const card = document.createElement('div');
    card.className = 'placement-card';
    card.dataset.id = this.placement.id;

    card.innerHTML = `
      <div class="card-header">
        <div>
          <span class="institution-tag">${this.escapeHtml(this.placement.institution)}</span>
          <h3 class="card-title">${this.escapeHtml(this.placement.label)}</h3>
        </div>
      </div>
      <div class="card-body">
        <div class="metric">
          <span class="label">Valeur Brute</span>
          <span class="value">${this.formatCurrency(evaluation.grossValue)}</span>
        </div>
        <div class="metric highlight">
          <span class="label">Valeur Nette Est.</span>
          <span class="value">${this.formatCurrency(evaluation.netValueBeforeIR)}</span>
        </div>
      </div>
    `;
    return card;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
}
