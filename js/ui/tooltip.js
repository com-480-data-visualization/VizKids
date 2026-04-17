import { METRIC_BY_KEY, formatMetric } from '../utils/scales.js';

export class Tooltip {
    constructor(el) { this.el = el; }

    // Map 2 — metric-based tooltip (unchanged)
    show(country, event, metric) {
        const m = METRIC_BY_KEY[metric];
        const val = country.get(metric);
        const valStr = (typeof val === 'number') ? formatMetric(metric, val) : '—';
        this.el.innerHTML = `
            <div class="tt-name">${escapeHtml(country.name)}</div>
            <div class="tt-stat">${m.label}: <strong>${valStr}</strong></div>
            <div class="tt-stat">Speeches: ${country.get('n_speeches') ?? '—'}</div>
        `;
        this._position(event);
        this.el.hidden = false;
    }

    // Map 1 — speech-presence tooltip
    showSpeech(country, event, year) {
        const badge = country.hasSpeechThisYear
            ? `<span style="color:var(--accent-4)">● Speech recorded</span>`
            : `<span style="color:var(--muted)">○ No speech this year</span>`;
        this.el.innerHTML = `
            <div class="tt-name">${escapeHtml(country.name)}</div>
            <div class="tt-stat" style="margin-top:0.25rem">${badge}</div>
        `;
        this._position(event);
        this.el.hidden = false;
    }

    _position(event) {
        const container = this.el.parentElement.getBoundingClientRect();
        this.el.style.left = (event.clientX - container.left) + 'px';
        this.el.style.top  = (event.clientY - container.top)  + 'px';
    }

    hide() { this.el.hidden = true; }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}