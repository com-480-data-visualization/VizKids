import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { buildProjection, buildPath } from './projection.js';
import { colorScaleFor } from '../utils/scales.js';

export class MapRenderer {
    constructor({ svg, registry, metric, onHover, onLeave, onSelect }) {
        this.svgEl = svg;
        this.svg = d3.select(svg);
        this.registry = registry;
        this.metric = metric;
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
            .on('mousemove', function (event, c) { self.onHover && self.onHover(c, event); })
            .on('mouseleave', function () { self.onLeave && self.onLeave(); })
            .on('click', function (event, c) { self._select(c); });

        this._applyColors();
    }

    setMetric(metric) {
        this.metric = metric;
        this._applyColors();
    }

    _applyColors() {
        const [min, max] = this.registry.metricExtent(this.metric);
        const scale = colorScaleFor(this.metric, [min, max]);
        this.gCountries.selectAll('path.country')
            .attr('fill', (c) => {
                const v = c.get(this.metric);
                return (typeof v === 'number') ? scale(v) : null;
            });
    }

    _select(country) {
        if (this._selected) {
            d3.select(`#c-${this._selected.iso3}`).classed('selected', false);
        }
        this._selected = country;
        d3.select(`#c-${country.iso3}`).classed('selected', true);
        this.onSelect && this.onSelect(country);
    }

    _handleResize() {
        this.width = this.svgEl.clientWidth;
        this.height = this.svgEl.clientHeight;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        this.projection = buildProjection(this.width, this.height, this.registry.world.land);
        this.path = buildPath(this.projection);
        this.gGraticule.selectAll('path').attr('d', this.path);
        this.gCountries.selectAll('path.country').attr('d', (c) => this.path(c.feature));
    }
}
