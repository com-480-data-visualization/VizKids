import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { METRIC_BY_KEY, formatMetric } from '../utils/scales2.js';

// Small color-scale legend for map2.
export class Legend {
    constructor(el) { this.el = el; }

    render(metricKey, [min, max]) {
        const m = METRIC_BY_KEY[metricKey];
        const scale = d3.scaleSequential(m.scheme).domain([min, max]);
        const stops = [];
        const N = 20;
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            stops.push(`${scale(min + t * (max - min))} ${t * 100}%`);
        }
        this.el.innerHTML = `
            <div class="legend-title">${m.label}</div>
            <div class="legend-bar" style="background: linear-gradient(90deg, ${stops.join(', ')})"></div>
            <div class="legend-ticks">
                <span>${formatMetric(metricKey, min)}</span>
                <span>${formatMetric(metricKey, max)}</span>
            </div>
        `;
    }
}
