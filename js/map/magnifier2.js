import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Fullscreen-map magnifier. Also clones the dots layer so small-country
// markers get magnified under the cursor.

const RADIUS = 110;
const SCALE = 3.2;

export class Magnifier {
    constructor(renderer) {
        this.renderer = renderer;
        this.svg = renderer.svg;
        this.enabled = false;

        const clipId = 'magnifier-clip-2';
        this.clip = this.svg.append('defs').append('clipPath').attr('id', clipId);
        this.clipCircle = this.clip.append('circle').attr('r', RADIUS);

        this.g = renderer.gMagnifier;
        this.g.attr('clip-path', `url(#${clipId})`).style('display', 'none');

        const cloneStripIds = (node) => {
            const clone = node.cloneNode(true);
            clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
            return clone;
        };
        this.content = this.g.append('g').attr('class', 'magnifier-content');
        this.content.append(() => cloneStripIds(renderer.gGraticule.node()));
        this.content.append(() => cloneStripIds(renderer.gCountries.node()));
        this.content.append(() => cloneStripIds(renderer.gDots.node()));

        this.border = this.svg.append('circle')
            .attr('class', 'magnifier-border')
            .attr('r', RADIUS)
            .style('display', 'none');

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
        this.content.attr('transform', `translate(${x},${y}) scale(${SCALE}) translate(${-x},${-y})`);
        this.g.style('display', null);
    }

    _onLeave() { this._hide(); }

    _hide() {
        this.g.style('display', 'none');
        this.border.style('display', 'none');
    }
}
