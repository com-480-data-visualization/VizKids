import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { COLORS } from './palette.js';
import { chartTooltip } from './tooltip.js';

// Animated scatter for the Diplomatic Blocs chapter.
// Data shape (data/blocs.json):
//   { decades: [...], regions: [...], region_by_iso3, decade_data: { decade: [...] } }
// Each (country, decade) is a single point. Switching decade re-positions the
// existing dots so the same country physically moves across the canvas.

const REGION_COLORS = {
    Africa: COLORS.lime,
    Americas: COLORS.amber,
    Asia: COLORS.cyan,
    Europe: COLORS.purple,
    'Middle East': COLORS.orange,
    Oceania: COLORS.teal,
    Other: COLORS.pink,
};

const PAD = 36;
const POINT_R = 5;

export class BlocsScatter {
    constructor({ svg, data, registry, onSelect }) {
        this.svgEl = svg;
        this.svg = d3.select(svg);
        this.data = data;
        this.registry = registry;
        this.onSelect = onSelect;
        this.decade = data.decades[0];
        this.highlight = null; // optional iso3 to keep visually pinned

        this.width = svg.clientWidth || 900;
        this.height = svg.clientHeight || 520;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

        this.x = d3.scaleLinear().domain([-1, 1]).range([PAD, this.width - PAD]);
        this.y = d3.scaleLinear().domain([-1, 1]).range([this.height - PAD, PAD]);

        // Faint axes so the user has a frame of reference (t-SNE axes are
        // arbitrary, but a frame still helps eye-tracking during animation).
        this.gFrame = this.svg.append('g').attr('class', 'blocs-frame');
        this.gFrame.append('rect')
            .attr('x', PAD).attr('y', PAD)
            .attr('width', this.width - PAD * 2)
            .attr('height', this.height - PAD * 2)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(120,160,230,0.10)')
            .attr('stroke-width', 1);

        this.gPoints = this.svg.append('g').attr('class', 'blocs-points');
        this.gHalo = this.svg.append('g').attr('class', 'blocs-halo'); // selection ring on top

        // Watermark at the corner: current decade.
        this.decadeLabel = this.svg.append('text')
            .attr('class', 'blocs-decade-label')
            .attr('x', this.width - PAD - 8)
            .attr('y', this.height - PAD - 10)
            .attr('text-anchor', 'end')
            .text(`${this.decade}s`);

        this._update();

        this._onResize = () => this._handleResize();
        window.addEventListener('resize', this._onResize);
    }

    setDecade(decade) {
        if (Number(decade) === this.decade) return;
        this.decade = Number(decade);
        this.decadeLabel.text(`${this.decade}s`);
        this._update();
    }

    getDecades() { return this.data.decades; }
    getCurrentDecade() { return this.decade; }
    getRegions() { return this.data.regions; }
    getRegionColor(region) { return REGION_COLORS[region] || COLORS.pink; }

    _update() {
        const points = this.data.decade_data[String(this.decade)] || [];
        const self = this;
        const t = d3.transition().duration(800).ease(d3.easeCubicInOut);

        const sel = this.gPoints.selectAll('circle.bloc-pt')
            .data(points, (d) => d.iso3);

        sel.exit()
            .transition(t)
            .attr('r', 0)
            .style('opacity', 0)
            .remove();

        const enter = sel.enter().append('circle')
            .attr('class', 'bloc-pt')
            .attr('cx', (d) => self.x(d.x))
            .attr('cy', (d) => self.y(d.y))
            .attr('r', 0)
            .style('opacity', 0)
            .attr('fill', (d) => REGION_COLORS[d.region] || COLORS.pink)
            .attr('stroke', COLORS.bg)
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseenter', (event, d) => self._showTip(event, d))
            .on('mousemove', (event) => chartTooltip.move(event))
            .on('mouseleave', () => chartTooltip.hide())
            .on('click', (event, d) => {
                const country = self.registry.get(d.iso3);
                if (country && self.onSelect) self.onSelect(country, d, self.decade);
            });

        enter.merge(sel).transition(t)
            .attr('cx', (d) => self.x(d.x))
            .attr('cy', (d) => self.y(d.y))
            .attr('r', POINT_R)
            .style('opacity', 0.85);
    }

    _showTip(event, d) {
        const country = this.registry.get(d.iso3);
        const name = country ? country.name : d.iso3;
        const speechWord = d.n_speeches === 1 ? 'speech' : 'speeches';
        chartTooltip.show(
            `<div style="font-weight:600;color:${COLORS.ink}">${escapeHtml(name)}</div>`
            + `<div style="color:${REGION_COLORS[d.region] || COLORS.pink};font-size:0.78rem;letter-spacing:0.05em;margin-bottom:2px">${escapeHtml(d.region)} · ${this.decade}s</div>`
            + `<div style="color:${COLORS.muted};font-size:0.78rem">${d.n_speeches} ${speechWord} · ${d.word_count.toLocaleString()} words</div>`
            + `<div style="color:${COLORS.muted};font-size:0.72rem;margin-top:4px;font-style:italic">click to read a speech</div>`,
            event,
        );
    }

    _handleResize() {
        this.width = this.svgEl.clientWidth;
        this.height = this.svgEl.clientHeight;
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        this.x.range([PAD, this.width - PAD]);
        this.y.range([this.height - PAD, PAD]);
        this.gFrame.select('rect')
            .attr('width', this.width - PAD * 2)
            .attr('height', this.height - PAD * 2);
        this.decadeLabel
            .attr('x', this.width - PAD - 8)
            .attr('y', this.height - PAD - 10);
        // Snap points to new positions without animating (avoid jitter on resize).
        this.gPoints.selectAll('circle.bloc-pt')
            .attr('cx', (d) => this.x(d.x))
            .attr('cy', (d) => this.y(d.y));
    }
}

export { REGION_COLORS };

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
