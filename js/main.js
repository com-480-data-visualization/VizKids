import { loadWorld, loadStats, loadGlobalStats } from './data/loader.js';
import { initCharts } from './charts/index.js';
import { CountryRegistry } from './countries/registry.js';
import { MapRenderer } from './map/renderer.js';
import { Magnifier } from './map/magnifier.js';
import { Tooltip } from './ui/tooltip.js';
import { Panel as ClassicPanel } from './ui/panel.js';
import { Panel as FloatingPanel } from './ui/panel2.js';
import { Legend } from './ui/legend.js';
import { METRICS } from './utils/scales.js';


async function init() {
    const [world, stats, globalStats] = await Promise.all([
        loadWorld(), loadStats(), loadGlobalStats(),
    ]);
    const registry = new CountryRegistry(world, stats);

    setupMap1(registry);
    setupMap2(registry);
    initCharts(globalStats);

    window.VizKids = { registry, globalStats };
}

function setupMap1(registry) {
    const state = { metric: 'avg_word_count', year: 2015 }; 
    const tooltip = new Tooltip(document.getElementById('m1-tooltip'));
    const panel = new ClassicPanel(document.getElementById('m1-panel'));

    const renderer = new MapRenderer({
        svg: document.getElementById('m1-svg'),
        registry,
        metric: state.metric,
        idPrefix: 'm1',
        onHover: (c, event) => tooltip.show(c, event, state.metric),
        onLeave: () => tooltip.hide(),
        onSelect: (c) => panel.show(c, state.year), 
    });
    renderer.render();

    const magnifier = new Magnifier(renderer, { idPrefix: 'm1', radius: 150, scale: 4 });
    magnifier.setEnabled(true);

    populateMetricSelect('m1-metric', state.metric, (val) => {
        state.metric = val;
        renderer.setMetric(val);
    });
    document.getElementById('m1-magnifier').addEventListener('change', (e) => {
        magnifier.setEnabled(e.target.checked);
    });

    const timeline = document.getElementById('m1-timeline');
    const yearLabel = document.getElementById('m1-year-val');
    
    timeline.addEventListener('input', (e) => {
        state.year = parseInt(e.target.value, 10);
        yearLabel.textContent = state.year; 
        if (renderer._selected) {
            panel.show(renderer._selected, state.year);
        }
        
    });
}

function setupMap2(registry) {
    const state = { metric: 'avg_word_count' };
    const tooltip = new Tooltip(document.getElementById('m2-tooltip'));
    const legend = new Legend(document.getElementById('m2-legend'));

    let renderer;
    const panel = new FloatingPanel(document.getElementById('m2-panel'), {
        onClose: () => renderer && renderer.clearSelection(),
    });

    renderer = new MapRenderer({
        svg: document.getElementById('m2-svg'),
        registry,
        metric: state.metric,
        idPrefix: 'm2',
        onHover: (c, event) => tooltip.show(c, event, state.metric),
        onLeave: () => tooltip.hide(),
        onSelect: (c) => panel.show(c),
    });
    renderer.render();
    legend.render(state.metric, renderer.colorExtent());

    const magnifier = new Magnifier(renderer, { idPrefix: 'm2', radius: 110, scale: 3.2 });
    magnifier.setEnabled(true);

    populateMetricSelect('m2-metric', state.metric, (val) => {
        state.metric = val;
        renderer.setMetric(val);
        legend.render(val, renderer.colorExtent());
    });
    document.getElementById('m2-magnifier').addEventListener('change', (e) => {
        magnifier.setEnabled(e.target.checked);
    });
}

function populateMetricSelect(id, current, onChange) {
    const sel = document.getElementById(id);
    for (const m of METRICS) {
        const opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = m.label;
        if (m.key === current) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.addEventListener('change', (e) => onChange(e.target.value));
}

init().catch((err) => {
    console.error(err);
    document.body.insertAdjacentHTML(
        'beforeend',
        `<p style="padding:2rem;color:#ef476f">Failed to load: ${err.message}</p>`
    );
});
