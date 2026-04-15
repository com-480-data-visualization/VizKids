import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Richer palettes for the fullscreen map (map2).
export const METRICS = [
    { key: 'avg_word_count',   label: 'Avg words / speech',     scheme: d3.interpolateTurbo,   format: (v) => Math.round(v).toLocaleString() },
    { key: 'avg_sent_count',   label: 'Avg sentences / speech', scheme: d3.interpolateInferno, format: (v) => Math.round(v) },
    { key: 'n_speeches',       label: 'Number of speeches',     scheme: d3.interpolateYlGnBu,  format: (v) => v },
    { key: 'avg_unique_words', label: 'Avg unique words',       scheme: d3.interpolatePlasma,  format: (v) => Math.round(v).toLocaleString() },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]));

export function colorScaleFor(metricKey, [min, max]) {
    return d3.scaleSequential(METRIC_BY_KEY[metricKey].scheme).domain([min, max]);
}

export function formatMetric(metricKey, v) {
    const m = METRIC_BY_KEY[metricKey];
    return m && m.format ? m.format(v) : String(v);
}
