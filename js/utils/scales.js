import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Central declaration of every available metric.
// Adding a new metric here automatically exposes it in the dropdown + panel.
export const METRICS = [
    { key: 'avg_word_count', label: 'Avg words / speech', scheme: d3.interpolateViridis, format: (v) => Math.round(v).toLocaleString() },
    { key: 'avg_sent_count', label: 'Avg sentences / speech', scheme: d3.interpolateCividis, format: (v) => Math.round(v) },
    { key: 'n_speeches', label: 'Number of speeches', scheme: d3.interpolateBlues, format: (v) => v },
    { key: 'avg_unique_words', label: 'Avg unique words', scheme: d3.interpolateMagma, format: (v) => Math.round(v).toLocaleString() },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]));

export function colorScaleFor(metricKey, [min, max]) {
    const m = METRIC_BY_KEY[metricKey];
    const scale = d3.scaleSequential(m.scheme).domain([min, max]);
    return (v) => scale(v);
}

export function formatMetric(metricKey, v) {
    const m = METRIC_BY_KEY[metricKey];
    return m && m.format ? m.format(v) : String(v);
}
