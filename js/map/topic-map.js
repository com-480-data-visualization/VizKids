import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { buildProjection, buildPath } from './projection.js';

// Specialised choropleth for the topic_rates dataset.
// Two state knobs — topic (string) and year (number) — both can change at runtime
// without re-drawing the country geometry: only fills update.

const COLOR_SCHEME = d3.interpolateYlOrRd;
const NO_DATA_FILL = '#1b2447';
const SMALL_COUNTRY_AREA_PX = 18;
const DOT_RADIUS = 4.5;

export class TopicMap {
    constructor({ svg, registry, topicData, idPrefix = 'tm', onHover, onLeave, onSelect }) {
        this.svgEl = svg;
        this.svg = d3.select(svg);
        this.registry = registry;
        this.data = topicData;
        this.idPrefix = idPrefix;
        this.onHover = onHover;
        this.onLeave = onLeave;
        this.onSelect = onSelect;
        this._selected = null;

        // Initial state: first topic, latest year. The user changes both via
        // the controls in final.html.
        this.topic = topicData.topics[0].key;
        this.year = topicData.years[topicData.years.length - 1];

        this.width = svg.clientWidth || 1000;
        this.height = svg.clientHeight || 600;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        this.projection = buildProjection(this.width, this.height, registry.world.land);
        this.path = buildPath(this.projection);

        this.gBase = this.svg.append('g').attr('class', 'layer-base');
        this.gGraticule = this.gBase.append('g').attr('class', 'layer-graticule');
        this.gCountries = this.gBase.append('g').attr('class', 'layer-countries');
        this.gDots = this.gBase.append('g').attr('class', 'layer-dots');

        // Per-topic max rate across ALL years/countries. Used as the color-scale
        // domain so colors are stable as the user scrubs the year slider —
        // 2009 climate looks deeper red than 1990 climate, not the other way
        // round just because the year-relative scale flipped.
        this.topicMax = {};
        for (const t of topicData.topics) {
            let max = 0;
            const yearsMap = topicData.rates[t.key] || {};
            for (const yearData of Object.values(yearsMap)) {
                for (const v of Object.values(yearData)) {
                    if (v > max) max = v;
                }
            }
            // Floor to avoid degenerate domains on near-empty topics.
            this.topicMax[t.key] = max > 0 ? max : 1;
        }

        this.render();
        this._onResize = () => this._handleResize();
        window.addEventListener('resize', this._onResize);
    }

    render() {
        const graticule = d3.geoGraticule10();
        this.gGraticule.selectAll('path').data([graticule]).join('path')
            .attr('class', 'graticule').attr('d', this.path);

        const self = this;
        const pid = (c) => `${this.idPrefix}-c-${c.iso3}`;
        this.gCountries.selectAll('path.country')
            .data(this.registry.all(), (c) => c.iso3)
            .join('path')
            .attr('class', 'country')
            .attr('id', pid)
            .attr('d', (c) => this.path(c.feature))
            .on('mousemove', (event, c) => self.onHover && self.onHover(c, self.getValueFor(c.iso3), event))
            .on('mouseleave', () => self.onLeave && self.onLeave())
            .on('click', (event, c) => self._select(c));

        this._renderDots();
        this._applyColors();
    }

    _renderDots() {
        // Tiny territories: render a dot at the centroid so they are clickable.
        // Same trick as the M2 map renderer.
        const small = this.registry.all().filter((c) => {
            const area = this.path.area(c.feature);
            return area > 0 && area < SMALL_COUNTRY_AREA_PX;
        });
        const self = this;
        const did = (c) => `${this.idPrefix}-d-${c.iso3}`;
        this.gDots.selectAll('circle.country-dot')
            .data(small, (c) => c.iso3)
            .join('circle')
            .attr('class', 'country-dot')
            .attr('id', did)
            .attr('r', DOT_RADIUS)
            .attr('cx', (c) => this.path.centroid(c.feature)[0])
            .attr('cy', (c) => this.path.centroid(c.feature)[1])
            .on('mousemove', (event, c) => self.onHover && self.onHover(c, self.getValueFor(c.iso3), event))
            .on('mouseleave', () => self.onLeave && self.onLeave())
            .on('click', (event, c) => self._select(c));
    }

    _select(country) {
        if (this._selected) {
            d3.select(`#${this.idPrefix}-c-${this._selected.iso3}`).classed('selected', false);
            d3.select(`#${this.idPrefix}-d-${this._selected.iso3}`).classed('selected', false);
        }
        this._selected = country;
        d3.select(`#${this.idPrefix}-c-${country.iso3}`).classed('selected', true);
        d3.select(`#${this.idPrefix}-d-${country.iso3}`).classed('selected', true);
        this.onSelect && this.onSelect(country);
    }

    clearSelection() {
        if (!this._selected) return;
        const { iso3 } = this._selected;
        d3.select(`#${this.idPrefix}-c-${iso3}`).classed('selected', false);
        d3.select(`#${this.idPrefix}-d-${iso3}`).classed('selected', false);
        this._selected = null;
    }

    _applyColors() {
        const max = this.topicMax[this.topic];
        const scale = d3.scaleSequential(COLOR_SCHEME).domain([0, max]);
        const yd = this._currentYearMap();
        const fill = (c) => {
            const v = yd[c.iso3];
            return (typeof v === 'number') ? scale(v) : NO_DATA_FILL;
        };
        this.gCountries.selectAll('path.country').attr('fill', fill);
        this.gDots.selectAll('circle.country-dot').attr('fill', fill);
    }

    _currentYearMap() {
        const t = this.data.rates[this.topic];
        return (t && t[String(this.year)]) || {};
    }

    // ----- Public state mutators -----

    setTopic(key) {
        if (key === this.topic) return;
        this.topic = key;
        this._applyColors();
    }

    setYear(y) {
        const yNum = Number(y);
        if (yNum === this.year) return;
        this.year = yNum;
        this._applyColors();
    }

    // ----- Public getters -----

    getTopics() { return this.data.topics; }
    getYears() { return this.data.years; }
    getCurrentTopic() { return this.data.topics.find((t) => t.key === this.topic); }
    getCurrentYear() { return this.year; }
    getTopicMax(key) { return this.topicMax[key] || 1; }
    getColorScale() {
        return d3.scaleSequential(COLOR_SCHEME).domain([0, this.topicMax[this.topic]]);
    }
    getValueFor(iso3) {
        const v = this._currentYearMap()[iso3];
        return (typeof v === 'number') ? v : null;
    }

    _handleResize() {
        this.width = this.svgEl.clientWidth;
        this.height = this.svgEl.clientHeight;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        this.projection = buildProjection(this.width, this.height, this.registry.world.land);
        this.path = buildPath(this.projection);
        this.gGraticule.selectAll('path').attr('d', this.path);
        this.gCountries.selectAll('path.country').attr('d', (c) => this.path(c.feature));
        this._renderDots();
    }
}

export { COLOR_SCHEME as TOPIC_COLOR_SCHEME };
