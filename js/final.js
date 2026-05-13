// Entry point for the Milestone 3 story page (final.html).
// Reuses every module from the M2 page — only the orchestration differs.

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

import { loadWorld, loadStats, loadGlobalStats, loadTopicRates, loadEvents } from './data/loader.js';
import { CountryRegistry } from './countries/registry.js';
import { MapRenderer } from './map/renderer.js';
import { Magnifier } from './map/magnifier.js';
import { TopicMap, TOPIC_COLOR_SCHEME } from './map/topic-map.js';
import { Tooltip } from './ui/tooltip.js';
import { Panel as FloatingPanel } from './ui/panel2.js';
import { Legend } from './ui/legend.js';
import { SpeechReader } from './ui/speech-reader.js';
import { METRICS } from './utils/scales.js';

// Charts for chapters 2 / 3 / 4.
import { render as speechesPerYear } from './charts/speeches-per-year.js';
import { render as topWords } from './charts/top-words.js';
import { render as keywordTrends } from './charts/keyword-trends.js';

const PLAY_INTERVAL_MS = 450;

async function init() {
    const [world, stats, globalStats, topicData, events] = await Promise.all([
        loadWorld(),
        loadStats(),
        loadGlobalStats(),
        loadTopicRates(),
        loadEvents(),
    ]);
    const registry = new CountryRegistry(world, stats);

    const reader = new SpeechReader({
        root: document.getElementById('speech-reader'),
        registry,
    });

    runStep('charts',       () => setupCharts(globalStats, events));
    runStep('topic map',    () => setupTopicMap(registry, topicData, reader));
    runStep('explore map',  () => setupExploreMap(registry));
    runStep('scroll reveal',() => setupScrollReveal());

    window.VizKids = { registry, globalStats, topicData, events, reader };
}

// Wraps each setup step so one failure doesn't blank the whole page.
function runStep(name, fn) {
    try { fn(); }
    catch (err) {
        console.error(`[final.js] ${name} failed:`, err);
    }
}

function setupCharts(globalStats, events) {
    speechesPerYear('#chart-speeches', globalStats.speeches_per_year);
    topWords('#chart-words', globalStats.top_words, { top: 15 });
    keywordTrends('#chart-keywords', globalStats.keywords, { events });
}

// ============================================================================
// Chapter 5 — Topic map
// ============================================================================
function setupTopicMap(registry, topicData, reader) {
    const tooltipEl = document.getElementById('tm-tooltip');

    const tm = new TopicMap({
        svg: document.getElementById('tm-svg'),
        registry,
        topicData,
        idPrefix: 'tm',
        onHover: (country, value, event) => showTopicTooltip(tooltipEl, tm, country, value, event),
        onLeave: () => { tooltipEl.hidden = true; },
        onSelect: (country) => {
            reader.setTopic(tm.getCurrentTopic());
            reader.show(country, tm.getCurrentYear());
        },
    });

    // Tell the reader about the initial topic so its "Highlighting" label is right.
    reader.setTopic(tm.getCurrentTopic());

    populateTopicSelect(tm, reader);
    setupYearSlider(tm);
    setupPlayButton(tm);
    renderTopicLegend(tm);
    renderTopicKeywords(tm);
}

function showTopicTooltip(el, tm, country, value, event) {
    const topic = tm.getCurrentTopic();
    const year = tm.getCurrentYear();
    const valStr = (typeof value === 'number')
        ? `<strong>${value.toFixed(2)}</strong> per 1,000 words`
        : '<em>no speech that year</em>';
    el.innerHTML = `
        <div class="tt-name">${escapeHtml(country.name)}</div>
        <div class="tt-stat">${escapeHtml(topic.label)} · ${year}</div>
        <div class="tt-stat">${valStr}</div>
    `;
    el.hidden = false;
    const container = el.parentElement.getBoundingClientRect();
    el.style.left = (event.clientX - container.left) + 'px';
    el.style.top = (event.clientY - container.top) + 'px';
}

function populateTopicSelect(tm, reader) {
    const sel = document.getElementById('tm-topic');
    for (const t of tm.getTopics()) {
        const opt = document.createElement('option');
        opt.value = t.key;
        opt.textContent = t.label;
        sel.appendChild(opt);
    }
    sel.value = tm.getCurrentTopic().key;
    sel.addEventListener('change', (e) => {
        tm.setTopic(e.target.value);
        renderTopicLegend(tm);
        renderTopicKeywords(tm);
        if (reader) reader.setTopic(tm.getCurrentTopic());
    });
}

function setupYearSlider(tm) {
    const slider = document.getElementById('tm-year-slider');
    const label = document.getElementById('tm-year-label');
    const years = tm.getYears();
    slider.min = years[0];
    slider.max = years[years.length - 1];
    slider.value = tm.getCurrentYear();
    label.textContent = tm.getCurrentYear();
    slider.addEventListener('input', (e) => {
        const y = Number(e.target.value);
        tm.setYear(y);
        label.textContent = y;
    });
}

function setupPlayButton(tm) {
    const btn = document.getElementById('tm-play');
    const slider = document.getElementById('tm-year-slider');
    const label = document.getElementById('tm-year-label');
    let timer = null;

    const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
        btn.textContent = '▶ Play';
        btn.classList.remove('playing');
    };
    const start = () => {
        btn.textContent = '⏸ Pause';
        btn.classList.add('playing');
        timer = setInterval(() => {
            const years = tm.getYears();
            const current = tm.getCurrentYear();
            const idx = years.indexOf(current);
            // If we're at the last year, loop back to the start.
            const next = idx >= 0 && idx < years.length - 1 ? years[idx + 1] : years[0];
            tm.setYear(next);
            slider.value = next;
            label.textContent = next;
        }, PLAY_INTERVAL_MS);
    };

    btn.addEventListener('click', () => { if (timer) stop(); else start(); });
    // Clicking the slider while playing pauses — feels right; otherwise the
    // playback would fight the user.
    slider.addEventListener('mousedown', () => { if (timer) stop(); });
}

function renderTopicLegend(tm) {
    const el = document.getElementById('tm-legend');
    const topic = tm.getCurrentTopic();
    const max = tm.getTopicMax(topic.key);
    const scale = d3.scaleSequential(TOPIC_COLOR_SCHEME).domain([0, max]);
    const N = 20;
    const stops = [];
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        stops.push(`${scale(t * max)} ${t * 100}%`);
    }
    el.innerHTML = `
        <div class="legend-title">${escapeHtml(topic.label)} — per 1,000 words</div>
        <div class="legend-bar" style="background: linear-gradient(90deg, ${stops.join(', ')})"></div>
        <div class="legend-ticks">
            <span>0</span>
            <span>${max.toFixed(1)}</span>
        </div>
    `;
}

function renderTopicKeywords(tm) {
    const el = document.getElementById('tm-keywords');
    const topic = tm.getCurrentTopic();
    const kws = (topic.keywords || []).slice(0, 18); // keep the badge compact
    const more = (topic.keywords || []).length - kws.length;
    el.innerHTML = `
        <div class="kw-title">Keywords for "${escapeHtml(topic.label)}"</div>
        <div class="kw-list">
            ${kws.map((kw) => `<span class="kw">${escapeHtml(kw)}</span>`).join('')}
            ${more > 0 ? `<span class="kw" style="opacity:0.6">+${more} more</span>` : ''}
        </div>
    `;
}

// ============================================================================
// Chapter 6 — Explore (basic 4-metric map, unchanged from M2)
// ============================================================================
function setupExploreMap(registry) {
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

// ============================================================================
// Misc
// ============================================================================
function setupScrollReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || els.length === 0) {
        els.forEach((el) => el.classList.add('is-visible'));
        return;
    }
    const obs = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        }
    }, { threshold: 0.12 });
    els.forEach((el) => obs.observe(el));
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Two requestAnimationFrames so SVG containers have their final layout sizes
// before the map measures clientWidth/clientHeight.
const ready = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
ready().then(init).catch((err) => {
    console.error(err);
    document.body.insertAdjacentHTML(
        'beforeend',
        `<p style="padding:2rem;color:#ef476f">Failed to load: ${err.message}</p>`
    );
});
