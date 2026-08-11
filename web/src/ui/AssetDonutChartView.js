import { I18n } from '../core/I18n.js';

const DONUT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
const DONUT_RADIUS = 15.9155;
const DONUT_STROKE = 6.4;
const SEGMENT_GAP = 0.5;

export class AssetDonutChartView {
  constructor(container, options = {}) {
    this.container = container;
    this.onHover = options.onHover || (() => {});
    this.onLeave = options.onLeave || (() => {});
  }

  render(evaluations, valueKey = 'grossValue') {
    const { total, byCat } = this._computeByCategory(evaluations, valueKey);
    const segments = Object.entries(byCat)
      .filter(([, value]) => value > 0)
      .sort(([, a], [, b]) => b - a);
    const percentages = total > 0 ? segments.map(([, value]) => (value / total) * 100) : [];
    const colors = segments.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]);

    this.container.innerHTML = `
      <svg class="donut-chart" viewBox="0 0 40 40" style="width: 100%; height: auto;" aria-label="${I18n.t('summary.breakdownTitle')}">
        ${this._renderSegments(segments, percentages, colors, total)}
      </svg>
    `;

    this._bindEvents();
  }

  _computeByCategory(evaluations, valueKey) {
    const byCat = {};
    let total = 0;
    for (const { instance, evaluation } of (evaluations || [])) {
      const cat = instance.getCategory();
      const amount = evaluation[valueKey] || 0;
      byCat[cat] = (byCat[cat] || 0) + amount;
      total += amount;
    }
    return { total, byCat };
  }

  _renderSegments(segments, percentages, colors, total) {
    if (total === 0) {
      return `<circle class="donut-segment" cx="20" cy="20" r="${DONUT_RADIUS}" fill="transparent" stroke="var(--card-border)" stroke-width="${DONUT_STROKE}" pointer-events="none" />`;
    }

    let cumulative = 0;
    const effectiveGap = percentages.length > 1 ? SEGMENT_GAP : 0;
    return percentages.map((pct, i) => {
      const [cat, value] = segments[i];
      const color = colors[i];
      const visible = Math.min(pct, Math.max(0.05, pct - effectiveGap));
      const rotation = -90 + (cumulative * 3.6);
      const rounded = Math.round(pct * 10) / 10;
      cumulative += pct;
      return `<circle
        class="donut-segment"
        cx="20" cy="20" r="${DONUT_RADIUS}"
        fill="transparent"
        stroke="${color}"
        stroke-width="${DONUT_STROKE}"
        stroke-dasharray="${visible} ${100 - visible}"
        pointer-events="stroke"
        transform="rotate(${rotation} 20 20)"
        data-cat="${cat}"
        style="cursor: pointer;"
      >
        <title>${I18n.t(`categories.${cat}`)}: ${this._formatCurrency(value)} (${rounded}%)</title>
      </circle>`;
    }).join('');
  }

  _bindEvents() {
    const svg = this.container.querySelector('svg');

    svg?.addEventListener('mouseover', (e) => {
      const cat = e.target.dataset?.cat;
      if (!cat) return;
      this.container.querySelectorAll('.donut-segment').forEach(seg => {
        seg.style.opacity = '0.4';
      });
      e.target.style.opacity = '1';
      this.onHover(cat);
    });

    svg?.addEventListener('mouseout', (e) => {
      const related = e.relatedTarget;
      if (related?.classList?.contains('donut-segment')) {
        return;
      }
      this.container.querySelectorAll('.donut-segment').forEach(seg => {
        seg.style.opacity = '';
      });
      this.onLeave();
    });
  }

  _formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }
}
