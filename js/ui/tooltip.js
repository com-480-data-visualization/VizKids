import { METRIC_BY_KEY, formatMetric } from '../utils/scales.js';

export class Tooltip {
    constructor(el) { this.el = el; }

    show(country, event, metric) {
        const m = METRIC_BY_KEY[metric];
        const val = country.get(metric);
        const valStr = (typeof val === 'number') ? formatMetric(metric, val) : '—';
        this.el.innerHTML = `
            <div class="tt-name">${escapeHtml(country.name)}</div>
            <div class="tt-stat">${m.label}: <strong>${valStr}</strong></div>
            <div class="tt-stat">Speeches: ${country.get('n_speeches') ?? '—'}</div>
        `;
        this.el.hidden = false;
        const container = this.el.parentElement.getBoundingClientRect();
        this.el.style.left = (event.clientX - container.left) + 'px';
        this.el.style.top = (event.clientY - container.top) + 'px';
    }

    hide() { this.el.hidden = true; }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
