import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Circular magnifier that follows the cursor.
// Implementation: clone the countries layer inside a clipped <g>, then apply
// a transform that pins the cursor point under the cursor while scaled up.

const RADIUS = 90;
const SCALE = 3;

export class Magnifier {
    constructor(renderer) {
        this.renderer = renderer;
        this.svg = renderer.svg;
        this.enabled = false;

        const id = 'magnifier-clip';
        this.clip = this.svg.append('defs').append('clipPath').attr('id', id);
        this.clipCircle = this.clip.append('circle').attr('r', RADIUS);

        this.g = renderer.gMagnifier;
        this.g.attr('clip-path', `url(#${id})`).style('display', 'none');

        // Clone the base layer once; re-apply transform on mousemove.
        this.content = this.g.append('g').attr('class', 'magnifier-content');
        this.content.append(() => renderer.gGraticule.node().cloneNode(true));
        this.content.append(() => renderer.gCountries.node().cloneNode(true));

        this.border = this.svg.append('circle').attr('class', 'magnifier-border').attr('r', RADIUS).style('display', 'none');

        this._onMove = this._onMove.bind(this);
        this._onLeave = this._onLeave.bind(this);

        this.svg.node().addEventListener('mousemove', this._onMove);
        this.svg.node().addEventListener('mouseleave', this._onLeave);
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
        // Transform: translate so that the point (x,y) stays fixed after scaling.
        // p' = (p - (x,y)) * k + (x,y)  ==  translate(x,y) scale(k) translate(-x,-y)
        this.content.attr('transform', `translate(${x},${y}) scale(${SCALE}) translate(${-x},${-y})`);
        this.g.style('display', null);
    }

    _onLeave() { this._hide(); }

    _hide() {
        this.g.style('display', 'none');
        this.border.style('display', 'none');
    }
}
