import { METRICS, formatMetric } from '../utils/scales.js';

// Floating bottom-left panel variant with a close button.
export class Panel {
    constructor(el, { onClose } = {}) {
        this.el = el;
        this.body = el.querySelector('.panel-body');
        this.closeBtn = el.querySelector('.panel-close');
        this.onClose = onClose;
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.hide());
    }

    show(country) {
        if (!country.hasData()) {
            this.body.innerHTML = `
                <h2>${escapeHtml(country.name)} <small>${country.iso3}</small></h2>
                <p style="color:var(--muted)">No speech data available.</p>`;
            this.el.hidden = false;
            return;
        }
        const s = country.stats;
        const rows = METRICS.map((m) => {
            const v = s[m.key];
            return `
                <div class="stat-row">
                    <span class="label">${m.label}</span>
                    <span class="value">${typeof v === 'number' ? formatMetric(m.key, v) : '—'}</span>
                </div>`;
        }).join('');
        const yearsTxt = s.years && s.years.length
            ? `${s.years[0]}–${s.years[s.years.length - 1]}`
            : '—';
        const words = (s.top_words || []).slice(0, 15).map(
            ([w, n]) => `<span class="word">${escapeHtml(w)}<small>${n}</small></span>`
        ).join('');
        this.body.innerHTML = `
            <h2>${escapeHtml(country.name)} <small>${country.iso3}</small></h2>
            <div class="stat-row"><span class="label">Years active</span><span class="value">${yearsTxt}</span></div>
            ${rows}
            <div class="words-section">
                <div class="words-title">Top words</div>
                ${words || '<span style="color:var(--muted)">—</span>'}
            </div>`;
        this.el.hidden = false;
    }

    hide() {
        this.el.hidden = true;
        this.onClose && this.onClose();
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
