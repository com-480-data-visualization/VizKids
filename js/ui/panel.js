import { METRICS, formatMetric } from '../utils/scales.js';

export class Panel {
    constructor(el) { this.el = el; }

    show(country) {
        if (!country.hasData()) {
            this.el.hidden = false;
            this.el.innerHTML = `<h2>${country.name}</h2><p style="color:#8892a0">No speech data available.</p>`;
            return;
        }
        const s = country.stats;
        const rows = METRICS.map((m) => {
            const v = s[m.key];
            return `<div class="stat-row"><span class="label">${m.label}</span><span>${typeof v === 'number' ? formatMetric(m.key, v) : '—'}</span></div>`;
        }).join('');
        const words = (s.top_words || []).slice(0, 15).map(
            ([w, n]) => `<span class="word">${w} <small style="color:#8892a0">${n}</small></span>`
        ).join('');
        this.el.innerHTML = `
            <h2>${country.name} <small style="color:#8892a0;font-weight:400">${country.iso3}</small></h2>
            ${rows}
            <div class="words"><div class="label" style="color:#8892a0;font-size:0.8rem;margin-bottom:0.3rem">Top words</div>${words || '<span style="color:#8892a0">—</span>'}</div>
        `;
        this.el.hidden = false;
    }
}
