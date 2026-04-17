import { loadWorld, loadStats, loadGlobalStats, loadSpeechesForYear } from './data/loader.js';
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

    await setupMap1(registry);
    setupMap2(registry);
    initCharts(globalStats);

    window.VizKids = { registry, globalStats };
}

async function setupMap1(registry) {
    const state = { year: 2015 };
    const tooltip = new Tooltip(document.getElementById('m1-tooltip'));
    const panel = new ClassicPanel(document.getElementById('m1-panel'));

    const renderer = new MapRenderer({
        svg: document.getElementById('m1-svg'),
        registry,
        metric: 'avg_word_count', 
        speechMode: true,
        idPrefix: 'm1',
        onHover: (c, event) => tooltip.showSpeech(c, event, state.year),
        onLeave: () => tooltip.hide(),
        onSelect: (c) => {
            if (!c.hasSpeechThisYear) {
                panel.showNoSpeech(c, state.year);
            } else {
                panel.show(c, state.year);
            }
        },
    });
    renderer.render();

    const magnifier = new Magnifier(renderer, { idPrefix: 'm1', radius: 150, scale: 4 });
    magnifier.setEnabled(true);

    const firstSet = await loadSpeechesForYear(state.year);
    registry.markSpeechYear(firstSet);
    renderer.setSpeechMode(true);

    document.getElementById('m1-magnifier').addEventListener('change', (e) => {
        magnifier.setEnabled(e.target.checked);
    });

    buildTimeline({
        containerId: 'm1-timeline-bar',
        min: 1970,
        max: 2015,
        value: state.year,
        onChange: async (year) => {
            state.year = year;
            const set = await loadSpeechesForYear(year);
            
            registry.markSpeechYear(set);
            renderer.setSpeechMode(true);

            if (renderer._selected) {
                const c = renderer._selected;
                if (!c.hasSpeechThisYear) {
                    panel.showNoSpeech(c, year);
                } else {
                    panel.show(c, year);
                }
            }
        },
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

function buildTimeline({ containerId, min, max, value, onChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const ticks = [];
    for (let y = min; y <= max; y += 5) ticks.push(y);

    container.innerHTML = `
        <div class="tl-wrap">
            <div class="tl-ticks">
                ${ticks.map(y => `<span class="tl-tick" style="left:${((y - min) / (max - min)) * 100}%">${y}</span>`).join('')}
            </div>
            <div class="tl-track-wrap">
                <div class="tl-fill" id="tl-fill"></div>
                <input class="tl-range" type="range" min="${min}" max="${max}" value="${value}" step="1" id="tl-input">
            </div>
            <div class="tl-label-row">
                <span class="tl-edge">${min}</span>
                <span class="tl-current" id="tl-current">${value}</span>
                <span class="tl-edge">${max}</span>
            </div>
        </div>
    `;

    const input = container.querySelector('#tl-input');
    const fill = container.querySelector('#tl-fill');
    const label = container.querySelector('#tl-current');

    function updateFill(v) {
        const pct = ((v - min) / (max - min)) * 100;
        fill.style.width = pct + '%';
        fill.parentElement.style.setProperty('--tl-pct', pct + '%');
    }
    updateFill(value);

    input.addEventListener('input', async (e) => {
        const y = parseInt(e.target.value, 10);
        label.textContent = y;
        updateFill(y);
        await onChange(y);
    });
}

init().catch((err) => {
    console.error(err);
    document.body.insertAdjacentHTML(
        'beforeend',
        `<p style="padding:2rem;color:#ef476f">Failed to load: ${err.message}</p>`
    );
});