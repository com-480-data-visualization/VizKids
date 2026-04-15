import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { buildProjection, buildPath } from './projection.js';
import { colorScaleFor } from '../utils/scales.js';

// Countries whose projected area is below this threshold (px²) get a
// clickable dot marker at their centroid — without this, small countries
// are unreachable unless the magnifier is on.
const SMALL_COUNTRY_AREA_PX = 18;
const DOT_RADIUS = 4.5;

export class MapRenderer {
    constructor({ svg, registry, metric, idPrefix = 'm', onHover, onLeave, onSelect }) {
        this.svgEl = svg;
        this.svg = d3.select(svg);
        this.registry = registry;
        this.metric = metric;
        this.idPrefix = idPrefix;
        this.onHover = onHover;
        this.onLeave = onLeave;
        this.onSelect = onSelect;

        this.width = svg.clientWidth || 1000;
        this.height = svg.clientHeight || 600;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

        this.projection = buildProjection(this.width, this.height, registry.world.land);
        this.path = buildPath(this.projection);

        // Layer groups — exposed so the magnifier can clone them.
        this.gBase = this.svg.append('g').attr('class', 'layer-base');
        this.gGraticule = this.gBase.append('g').attr('class', 'layer-graticule');
        this.gCountries = this.gBase.append('g').attr('class', 'layer-countries');
        this.gDots = this.gBase.append('g').attr('class', 'layer-dots');
        this.gMagnifier = this.svg.append('g').attr('class', 'layer-magnifier');

        this._selected = null;

        window.addEventListener('resize', () => this._handleResize());
    }

    render() {
        const graticule = d3.geoGraticule10();
        this.gGraticule.selectAll('path').data([graticule]).join('path')
            .attr('class', 'graticule').attr('d', this.path);

        const pid = (c) => `${this.idPrefix}-c-${c.iso3}`;
        const self = this;
        this.gCountries.selectAll('path.country')
            .data(this.registry.all(), (c) => c.iso3)
            .join('path')
            .attr('class', (c) => 'country' + (c.hasData() ? '' : ' no-data'))
            .attr('id', pid)
            .attr('d', (c) => this.path(c.feature))
            .on('mousemove', (event, c) => self.onHover && self.onHover(c, event))
            .on('mouseleave', () => self.onLeave && self.onLeave())
            .on('click', (event, c) => self._select(c));

        this._renderDots();
        this._applyColors();
    }

    _renderDots() {
        const small = this.registry.all().filter((c) => {
            const area = this.path.area(c.feature);
            return area > 0 && area < SMALL_COUNTRY_AREA_PX;
        });
        const did = (c) => `${this.idPrefix}-d-${c.iso3}`;
        const self = this;
        this.gDots.selectAll('circle.country-dot')
            .data(small, (c) => c.iso3)
            .join('circle')
            .attr('class', (c) => 'country-dot' + (c.hasData() ? '' : ' no-data'))
            .attr('id', did)
            .attr('r', DOT_RADIUS)
            .attr('cx', (c) => this.path.centroid(c.feature)[0])
            .attr('cy', (c) => this.path.centroid(c.feature)[1])
            .on('mousemove', (event, c) => self.onHover && self.onHover(c, event))
            .on('mouseleave', () => self.onLeave && self.onLeave())
            .on('click', (event, c) => self._select(c));
    }

    setMetric(metric) { this.metric = metric; this._applyColors(); }

    _applyColors() {
        const [min, max] = this.registry.metricExtent(this.metric);
        const scale = colorScaleFor(this.metric, [min, max]);
        const fill = (c) => {
            const v = c.get(this.metric);
            return (typeof v === 'number') ? scale(v) : null;
        };
        this.gCountries.selectAll('path.country').attr('fill', fill);
        this.gDots.selectAll('circle.country-dot').attr('fill', fill);
        this._currentExtent = [min, max];
    }

    colorExtent() { return this._currentExtent; }

    _select(country) {
        const prev = this._selected;
        if (prev) {
            d3.select(`#${this.idPrefix}-c-${prev.iso3}`).classed('selected', false);
            d3.select(`#${this.idPrefix}-d-${prev.iso3}`).classed('selected', false);
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
