import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { COLORS, MARGIN, styleAxis } from './palette.js';
import { chartTooltip } from './tooltip.js';

export function render(container, data) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    const width = el.clientWidth || 480;
    const height = 260;
    const iw = width - MARGIN.left - MARGIN.right;
    const ih = height - MARGIN.top - MARGIN.bottom;

    el.innerHTML = '';
    const svg = d3.select(el).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('width', '100%').attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([0, iw]);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.median)]).nice().range([ih, 0]);

    // Gradient for the area fill
    const grad = svg.append('defs').append('linearGradient')
        .attr('id', 'speech-length-grad')
        .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%').attr('stop-color', COLORS.teal).attr('stop-opacity', 0.55);
    grad.append('stop').attr('offset', '100%').attr('stop-color', COLORS.teal).attr('stop-opacity', 0);

    // Gridlines
    g.append('g').attr('class', 'grid')
        .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(''))
        .call((sel) => sel.selectAll('line').attr('stroke', COLORS.grid))
        .call((sel) => sel.select('.domain').remove());

    // Axes
    g.append('g').attr('transform', `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d'))).call(styleAxis);
    g.append('g').call(d3.axisLeft(y).ticks(5)).call(styleAxis);

    // Area + line
    const area = d3.area().x((d) => x(d.year)).y0(ih).y1((d) => y(d.median)).curve(d3.curveMonotoneX);
    const line = d3.line().x((d) => x(d.year)).y((d) => y(d.median)).curve(d3.curveMonotoneX);

    g.append('path').datum(data).attr('fill', 'url(#speech-length-grad)').attr('d', area);
    g.append('path').datum(data)
        .attr('fill', 'none').attr('stroke', COLORS.teal).attr('stroke-width', 2).attr('d', line);

    // Hover interaction
    const focus = g.append('g').style('display', 'none');
    focus.append('circle').attr('r', 4).attr('fill', COLORS.amber).attr('stroke', COLORS.bg).attr('stroke-width', 2);

    const bisect = d3.bisector((d) => d.year).left;
    const overlay = g.append('rect')
        .attr('width', iw).attr('height', ih).attr('fill', 'none').attr('pointer-events', 'all');

    overlay
        .on('mouseenter', () => focus.style('display', null))
        .on('mouseleave', () => { focus.style('display', 'none'); chartTooltip.hide(); })
        .on('mousemove', (event) => {
            const xm = x.invert(d3.pointer(event, g.node())[0]);
            const i = bisect(data, xm, 1);
            const d0 = data[i - 1], d1 = data[i] || d0;
            const d = !d1 || (xm - d0.year < d1.year - xm) ? d0 : d1;
            focus.attr('transform', `translate(${x(d.year)},${y(d.median)})`);
            chartTooltip.show(`<b>${d.year}</b><br>${Math.round(d.median).toLocaleString()} words (median)`, event);
        });
}
