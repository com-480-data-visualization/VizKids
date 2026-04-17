import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const DEFAULT_RADIUS = 100;
const DEFAULT_SCALE = 3;

export class Magnifier {
    constructor(renderer, { idPrefix = 'm', radius = DEFAULT_RADIUS, scale = DEFAULT_SCALE } = {}) {
        this.renderer = renderer;
        this.svg = renderer.svg;
        this.radius = radius;
        this.scale = scale;
        this.enabled = false;

        renderer._magnifier = this;

        const clipId = `magnifier-clip-${idPrefix}`;
        this.clip = this.svg.append('defs').append('clipPath').attr('id', clipId);
        this.clipCircle = this.clip.append('circle').attr('r', radius);

        this.g = renderer.gMagnifier;
        this.g
            .attr('clip-path', `url(#${clipId})`)
            .style('display', 'none')
            .style('pointer-events', 'none');

        this.content = this.g.append('g').attr('class', 'magnifier-content');
        this._buildClone();

        this.border = this.svg.append('circle')
            .attr('class', 'magnifier-border')
            .attr('r', radius)
            .style('display', 'none')
            .style('pointer-events', 'none');

        this._onMove = this._onMove.bind(this);
        this._onLeave = this._onLeave.bind(this);
        this.svg.node().addEventListener('mousemove', this._onMove);
        this.svg.node().addEventListener('mouseleave', this._onLeave);
    }

    _stripIds(node) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        return clone;
    }

    _buildClone() {
        this.content.selectAll('*').remove();
        this.content.append(() => this._stripIds(this.renderer.gGraticule.node()));
        this.content.append(() => this._stripIds(this.renderer.gCountries.node()));
        this.content.append(() => this._stripIds(this.renderer.gDots.node()));
    }

    refreshContent() {
        const currentTransform = this.content.attr('transform');
        this._buildClone();
        if (currentTransform) this.content.attr('transform', currentTransform);
    }

    setEnabled(on) {
        this.enabled = on;
        if (!on) this._hide();
    }

    _onMove(event) {
        if (!this.enabled) return;
        const [x, y] = d3.pointer(event, this.svg.node());
        this.clipCircle.attr('cx', x).attr('cy', y);
        this.border.attr('cx', x).attr('cy', y).style('display', null);
        this.content.attr('transform', `translate(${x},${y}) scale(${this.scale}) translate(${-x},${-y})`);
        this.g.style('display', null);
    }

    _onLeave() { this._hide(); }

    _hide() {
        this.g.style('display', 'none');
        this.border.style('display', 'none');
    }
}