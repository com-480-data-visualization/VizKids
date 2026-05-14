import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { buildProjection, buildPath } from './projection.js';
import { COLORS } from '../charts/palette.js';

// Map of "who talks about whom". Click a country to see arcs from it to the
// countries it mentioned most. Arc width encodes mention count.
//
// The data shape is the output of scripts/build_mentions.py:
//   { aggregate: {iso3: {total, top: [[iso3, n], ...]}}, by_year: {year: {...}}, ... }

const TOP_N = 15;          // how many target arcs to draw per click
const ARC_MIN_W = 1.2;
const ARC_MAX_W = 10;
const SOURCE_COLOR = COLORS.amber;
const TARGET_COLOR = COLORS.pink;

export class MentionsMap {
    constructor({ svg, registry, data, idPrefix = 'mn', onHover, onLeave }) {
        this.svgEl = svg;
        this.svg = d3.select(svg);
        this.registry = registry;
        this.data = data;
        this.idPrefix = idPrefix;
        this.onHover = onHover;
        this.onLeave = onLeave;

        this.mode = 'aggregate';            // 'aggregate' | 'year'
        this.year = data.years[data.years.length - 1];
        this.selected = null;

        this.width = svg.clientWidth || 1000;
        this.height = svg.clientHeight || 600;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        this.projection = buildProjection(this.width, this.height, registry.world.land);
        this.path = buildPath(this.projection);

        this.gGraticule = this.svg.append('g').attr('class', 'layer-graticule');
        this.gCountries = this.svg.append('g').attr('class', 'layer-countries');
        this.gArcs      = this.svg.append('g').attr('class', 'layer-arcs');
        this.gTargets   = this.svg.append('g').attr('class', 'layer-targets');

        this._renderBase();

        this._onResize = () => this._handleResize();
        window.addEventListener('resize', this._onResize);
    }

    _renderBase() {
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
            .attr('fill', '#1b2447')
            .on('mousemove', (event, c) => self.onHover && self.onHover(c, self._mentionsForCountry(c), event))
            .on('mouseleave', () => self.onLeave && self.onLeave())
            .on('click', (event, c) => self.select(c));
    }

    _currentTable() {
        return this.mode === 'year'
            ? (this.data.by_year[String(this.year)] || {})
            : this.data.aggregate;
    }

    _mentionsForCountry(country) {
        const tbl = this._currentTable();
        return tbl[country.iso3] || null;
    }

    setMode(mode) {
        // 'aggregate' or 'year'
        if (mode !== 'aggregate' && mode !== 'year') return;
        this.mode = mode;
        if (this.selected) this._drawArcs();
    }

    setYear(year) {
        const n = Number(year);
        if (n === this.year) return;
        this.year = n;
        if (this.mode === 'year' && this.selected) this._drawArcs();
    }

    select(country) {
        // Toggle off if clicking the already-selected country.
        if (this.selected && this.selected.iso3 === country.iso3) {
            this.clearSelection();
            return;
        }
        if (this.selected) {
            d3.select(`#${this.idPrefix}-c-${this.selected.iso3}`).classed('source', false);
        }
        this.selected = country;
        d3.select(`#${this.idPrefix}-c-${country.iso3}`).classed('source', true);
        this._drawArcs();
    }

    clearSelection() {
        if (!this.selected) return;
        d3.select(`#${this.idPrefix}-c-${this.selected.iso3}`).classed('source', false);
        this.selected = null;
        this.gArcs.selectAll('*').remove();
        this.gTargets.selectAll('*').remove();
        this.gCountries.selectAll('path.country').classed('target', false);
    }

    _drawArcs() {
        const entry = this._mentionsForCountry(this.selected);
        const arcs = (entry && entry.top || []).slice(0, TOP_N);

        // Width scale by mention count.
        const maxN = arcs[0] ? arcs[0][1] : 1;
        const w = d3.scaleSqrt().domain([0, maxN || 1]).range([ARC_MIN_W, ARC_MAX_W]);

        // Highlight target country shapes.
        const targetSet = new Set(arcs.map((a) => a[0]));
        this.gCountries.selectAll('path.country')
            .classed('target', (c) => targetSet.has(c.iso3));

        // Compute source centroid (in projected coords).
        const sourceFeature = this.selected.feature;
        const src = this.path.centroid(sourceFeature);

        const lineGen = (target) => {
            const c = this.registry.get(target);
            if (!c || !c.feature) return null;
            const dst = this.path.centroid(c.feature);
            if (!isFiniteXY(src) || !isFiniteXY(dst)) return null;
            return curvedPath(src, dst);
        };

        // Arcs
        this.gArcs.selectAll('path.arc')
            .data(arcs, (d) => d[0])
            .join(
                (enter) => enter.append('path')
                    .attr('class', 'arc')
                    .attr('fill', 'none')
                    .attr('stroke', TARGET_COLOR)
                    .attr('stroke-linecap', 'round')
                    .attr('stroke-opacity', 0)
                    .attr('d', ([t]) => lineGen(t) || '')
                    .attr('stroke-width', ([, n]) => w(n))
                    .call((e) => e.transition().duration(500).attr('stroke-opacity', 0.75)),
                (update) => update
                    .transition().duration(400)
                    .attr('d', ([t]) => lineGen(t) || '')
                    .attr('stroke-width', ([, n]) => w(n))
                    .attr('stroke-opacity', 0.75),
                (exit) => exit.transition().duration(200).attr('stroke-opacity', 0).remove(),
            );

        // Small target rings at the destination centroids.
        this.gTargets.selectAll('circle.target-ring')
            .data(arcs, (d) => d[0])
            .join(
                (enter) => enter.append('circle')
                    .attr('class', 'target-ring')
                    .attr('cx', ([t]) => endpoint(t, this).x)
                    .attr('cy', ([t]) => endpoint(t, this).y)
                    .attr('r', 0)
                    .attr('fill', 'none')
                    .attr('stroke', TARGET_COLOR)
                    .attr('stroke-width', 1.5)
                    .call((e) => e.transition().duration(400).attr('r', 5)),
                (update) => update
                    .transition().duration(300)
                    .attr('cx', ([t]) => endpoint(t, this).x)
                    .attr('cy', ([t]) => endpoint(t, this).y),
                (exit) => exit.transition().duration(150).attr('r', 0).remove(),
            );
    }

    _handleResize() {
        this.width = this.svgEl.clientWidth;
        this.height = this.svgEl.clientHeight;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        this.projection = buildProjection(this.width, this.height, this.registry.world.land);
        this.path = buildPath(this.projection);
        this.gGraticule.selectAll('path').attr('d', this.path);
        this.gCountries.selectAll('path.country').attr('d', (c) => this.path(c.feature));
        if (this.selected) this._drawArcs();
    }

    getYears()   { return this.data.years; }
    getMode()    { return this.mode; }
    getYear()    { return this.year; }
    getSelected(){ return this.selected; }
    getCountryName(iso3) {
        return (this.data.country_names && this.data.country_names[iso3])
            || (this.registry.get(iso3) ? this.registry.get(iso3).name : iso3);
    }
}

// --- Geometry helpers ---

function curvedPath([x1, y1], [x2, y2]) {
    // Quadratic Bézier curve, control point pushed perpendicular to the chord
    // so the arc rises above the straight line. Magnitude scales with distance.
    const dx = x2 - x1, dy = y2 - y1;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dr = Math.hypot(dx, dy);
    // Perpendicular unit vector, rotated 90° counter-clockwise.
    const nx = -dy / (dr || 1), ny = dx / (dr || 1);
    // Curvature factor: longer arcs bend more.
    const k = Math.min(0.32, dr * 0.0006 + 0.18);
    const cx = mx + nx * dr * k;
    const cy = my + ny * dr * k;
    return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

function endpoint(iso3, mm) {
    const c = mm.registry.get(iso3);
    if (!c || !c.feature) return { x: 0, y: 0 };
    const [x, y] = mm.path.centroid(c.feature);
    return { x, y };
}

function isFiniteXY([x, y]) { return Number.isFinite(x) && Number.isFinite(y); }
