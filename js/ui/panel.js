import { METRICS, formatMetric } from '../utils/scales.js';
import { loadSpeechText } from '../data/loader.js';

export class Panel {
    constructor(el) { this.el = el; }

    async show(country, year) { 
        this.el.hidden = false;
        
        this.el.innerHTML = `<h2>${escapeHtml(country.name)}</h2><p>..loading speech...</p>`;

        if (!country.hasData()) {
            this.el.innerHTML = `<h2>${escapeHtml(country.name)}</h2><p style="color:#8892a0">No speech data available.</p>`;
            return;
        }

        const speechText = await loadSpeechText(country.iso3, year);
        
        const displayBody = speechText 
            ? escapeHtml(speechText) 
            : `<i style="color:#8892a0">We don't have a record of a speech for ${year}.</i>`;

        const s = country.stats;
        const rows = METRICS.map((m) => {
            const v = s[m.key];
            return `<div class="stat-row"><span class="label">${m.label}</span><span>${typeof v === 'number' ? formatMetric(m.key, v) : '—'}</span></div>`;
        }).join('');
        
        const words = (s.top_words || []).slice(0, 15).map(
            ([w, n]) => `<span class="word">${escapeHtml(w)} <small style="color:#8892a0">${n}</small></span>`
        ).join('');

        // Final UI Render
        this.el.innerHTML = `
            <h2>${escapeHtml(country.name)} <small style="color:#8892a0;font-weight:400">${country.iso3}</small></h2>
            <div class="stat-row" style="margin-bottom: 0.5rem;">
                <span class="label" style="color:var(--accent); font-size: 1.1rem;">Debate Year: ${year}</span>
            </div>
            
            <div class="speech-box" style="
                background: rgba(0, 0, 0, 0.25); 
                padding: 1.2rem; 
                border-radius: 6px; 
                margin-bottom: 1.5rem; 
                max-height: 350px; 
                overflow-y: auto; 
                font-size: 0.9rem; 
                line-height: 1.6; 
                border: 1px solid var(--border-soft);
                white-space: pre-wrap;
                color: #e0e6ed;
            ">
                ${displayBody}
            </div>

            <div class="stats-container" style="border-top: 1px solid var(--border-soft); padding-top: 1rem;">
                ${rows}
            </div>
            
            <div class="words" style="margin-top:1.5rem">
                <div class="label" style="color:#8892a0;font-size:0.8rem;margin-bottom:0.5rem">Frequent Terms (1970-2015)</div>
                ${words || '<span style="color:#8892a0">—</span>'}
            </div>
        `;
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}