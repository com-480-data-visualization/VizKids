import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { COLORS } from './palette.js';

// Renders a country's "distinctive vocabulary" — words it uses more than
// average — as a sized word display, sorted by ratio descending.

const MIN_FONT_PX = 14;
const MAX_FONT_PX = 44;

export class DistinctiveVocab {
    constructor({ data, registry, dropdown, cloud, info, suggestionsEl, suggestions }) {
        this.data = data;
        this.registry = registry;
        this.dropdown = dropdown;
        this.cloud = cloud;
        this.info = info;
        this.iso3 = null;

        this._populateDropdown();
        this._renderSuggestions(suggestionsEl, suggestions);

        this.dropdown.addEventListener('change', (e) => this.setCountry(e.target.value));
    }

    _populateDropdown() {
        // Build the (label, iso3) list and sort alphabetically by display name.
        const opts = Object.keys(this.data.by_country).map((iso3) => {
            const c = this.registry.get(iso3);
            return { iso3, name: c ? c.name : iso3 };
        }).sort((a, b) => a.name.localeCompare(b.name));

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Choose a country…';
        placeholder.disabled = true;
        placeholder.selected = true;
        this.dropdown.appendChild(placeholder);

        for (const o of opts) {
            const opt = document.createElement('option');
            opt.value = o.iso3;
            opt.textContent = o.name;
            this.dropdown.appendChild(opt);
        }
    }

    _renderSuggestions(el, suggestions) {
        if (!el || !suggestions) return;
        el.innerHTML = '';
        for (const iso3 of suggestions) {
            const c = this.registry.get(iso3);
            const name = c ? c.name : iso3;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dv-suggestion';
            btn.textContent = name;
            btn.addEventListener('click', () => this.setCountry(iso3));
            el.appendChild(btn);
        }
    }

    setCountry(iso3) {
        if (!iso3 || !this.data.by_country[iso3]) return;
        this.iso3 = iso3;
        this.dropdown.value = iso3;
        this._render();
    }

    _render() {
        const words = this.data.by_country[this.iso3] || [];
        if (words.length === 0) {
            this.cloud.innerHTML = '<p class="dv-empty">No distinctive vocabulary for this country.</p>';
            this.info.textContent = '';
            return;
        }
        // Each entry is [word, ratio, count_in_country, count_globally].
        // sqrt-scale ratio to font size: prevents the biggest word from
        // dominating when the ratio range spans an order of magnitude or two.
        const ratios = words.map((w) => w[1]);
        const scale = d3.scaleSqrt()
            .domain([Math.min(...ratios), Math.max(...ratios)])
            .range([MIN_FONT_PX, MAX_FONT_PX]);

        const country = this.registry.get(this.iso3);
        const name = country ? country.name : this.iso3;
        this.info.innerHTML = `
            <strong>${escapeHtml(name)}</strong>
            · top ${words.length} words at <span class="dv-info-em">≥2× global frequency</span>
            <span class="dv-info-em">·</span>
            most over-represented first
        `;

        this.cloud.innerHTML = words.map(([word, ratio, c, g]) => {
            const size = scale(ratio).toFixed(1);
            const opacity = Math.min(1, 0.55 + ratio / Math.max(...ratios) * 0.45);
            return `<span class="dv-word"
                style="font-size:${size}px; opacity:${opacity}"
                title="${escapeHtml(word)} · ${ratio.toFixed(1)}× more common in ${escapeHtml(name)} (${c} mentions here vs ${g} globally)"
            >${escapeHtml(word)}</span>`;
        }).join('');
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
