import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { buildProjection, buildPath } from './projection.js';
import { colorScaleFor } from '../utils/scales2.js';

// Renderer variant with fallback dots for tiny countries so they remain
// clickable even when the magnifier is off.

const SMALL_COUNTRY_AREA_PX = 18;
const DOT_RADIUS = 4.5;

export class MapRenderer {
    constructor({ svg, registry, metric, onHover, onLeave, onSelect }) {
        this.svgEl = svg;
        this.svg = d3.select(svg);
        this.registry = registry;
        this.metric = metric;
        this.onHover = onHover;
        this.onLeave = onLeave;
        this.onSelect = onSelect;

        this.width = svg.clientWidth || 1200;
        this.height = svg.clientHeight || 700;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

        this.projection = buildProjection(this.width, this.height, registry.world.land);
        this.path = buildPath(this.projection);

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

        const self = this;
        this.gCountries.selectAll('path.country')
            .data(this.registry.all(), (c) => c.iso3)
            .join('path')
            .attr('class', (c) => 'country' + (c.hasData() ? '' : ' no-data'))
            .attr('id', (c) => `c-${c.iso3}`)
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
        const self = this;
        this.gDots.selectAll('circle.country-dot')
            .data(small, (c) => c.iso3)
            .join('circle')
            .attr('class', (c) => 'country-dot' + (c.hasData() ? '' : ' no-data'))
            .attr('id', (c) => `d-${c.iso3}`)
            .attr('r', DOT_RADIUS)
            .attr('cx', (c) => this.path.centroid(c.feature)[0])
            .attr('cy', (c) => this.path.centroid(c.feature)[1])
            .on('mousemove', (event, c) => self.onHover && self.onHover(c, event))
            .on('mouseleave', () => self.onLeave && self.onLeave())
            .on('click', (event, c) => self._select(c));
    }

    setMetric(metric) {
        this.metric = metric;
        this._applyColors();
    }

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
        if (this._selected) {
            d3.select(`#c-${this._selected.iso3}`).classed('selected', false);
            d3.select(`#d-${this._selected.iso3}`).classed('selected', false);
        }
        this._selected = country;
        d3.select(`#c-${country.iso3}`).classed('selected', true);
        d3.select(`#d-${country.iso3}`).classed('selected', true);
        this.onSelect && this.onSelect(country);
    }

    clearSelection() {
        if (!this._selected) return;
        d3.select(`#c-${this._selected.iso3}`).classed('selected', false);
        d3.select(`#d-${this._selected.iso3}`).classed('selected', false);
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
