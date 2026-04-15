import { loadWorld, loadStats } from './data/loader.js';
import { CountryRegistry } from './countries/registry.js';
import { MapRenderer } from './map/renderer2.js';
import { Magnifier } from './map/magnifier2.js';
import { Tooltip } from './ui/tooltip.js';
import { Panel } from './ui/panel2.js';
import { Legend } from './ui/legend.js';
import { METRICS } from './utils/scales2.js';

const state = {
    metric: 'avg_word_count',
    magnifierEnabled: true,
};

async function init() {
    const [world, stats] = await Promise.all([loadWorld(), loadStats()]);
    const registry = new CountryRegistry(world, stats);

    const tooltip = new Tooltip(document.getElementById('tooltip'));
    const legend = new Legend(document.getElementById('legend'));

    let renderer;
    const panel = new Panel(document.getElementById('panel'), {
        onClose: () => renderer && renderer.clearSelection(),
    });

    renderer = new MapRenderer({
        svg: document.getElementById('map'),
        registry,
        metric: state.metric,
        onHover: (country, event) => tooltip.show(country, event, state.metric),
        onLeave: () => tooltip.hide(),
        onSelect: (country) => panel.show(country),
    });
    renderer.render();
    legend.render(state.metric, renderer.colorExtent());

    const magnifier = new Magnifier(renderer);
    magnifier.setEnabled(state.magnifierEnabled);

    buildMetricSelect(renderer, legend);
    document.getElementById('magnifier-toggle').addEventListener('change', (e) => {
        magnifier.setEnabled(e.target.checked);
    });

    window.VizKids = { registry, renderer, state };
}

function buildMetricSelect(renderer, legend) {
    const sel = document.getElementById('metric-select');
    for (const m of METRICS) {
        const opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = m.label;
        if (m.key === state.metric) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.addEventListener('change', (e) => {
        state.metric = e.target.value;
        renderer.setMetric(state.metric);
        legend.render(state.metric, renderer.colorExtent());
    });
}

init().catch((err) => {
    console.error(err);
    document.getElementById('map-container').innerHTML =
        `<p style="padding:2rem;color:#ef476f">Failed to load: ${err.message}</p>`;
});
