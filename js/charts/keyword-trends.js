import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { COLORS, CATEGORICAL, MARGIN, styleAxis } from './palette.js';
import { chartTooltip } from './tooltip.js';

export function render(container, data) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    const width = el.clientWidth || 480;
    const height = 300;
    const iw = width - MARGIN.left - MARGIN.right;
    const ih = height - MARGIN.top - MARGIN.bottom - 30; // reserve for legend

    el.innerHTML = '';
    const svg = d3.select(el).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('width', '100%').attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const years = data[0].series.map((p) => p.year);
    const x = d3.scaleLinear().domain(d3.extent(years)).range([0, iw]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, (kw) => d3.max(kw.series, (p) => p.rate))]).nice()
        .range([ih, 0]);

    const color = d3.scaleOrdinal().domain(data.map((d) => d.keyword)).range(CATEGORICAL);

    // Gridlines
    g.append('g').attr('class', 'grid')
        .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(''))
        .call((sel) => sel.selectAll('line').attr('stroke', COLORS.grid))
        .call((sel) => sel.select('.domain').remove());

    // Axes
    g.append('g').attr('transform', `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d'))).call(styleAxis);
    g.append('g').call(d3.axisLeft(y).ticks(5)).call(styleAxis);
    g.append('text')
        .attr('transform', `rotate(-90)`)
        .attr('x', -ih / 2).attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('fill', COLORS.muted).style('font-size', '10px')
        .text('Mentions per 1000 words');

    // Lines
    const line = d3.line().x((p) => x(p.year)).y((p) => y(p.rate)).curve(d3.curveMonotoneX);
    g.selectAll('path.series').data(data).enter().append('path')
        .attr('class', 'series')
        .attr('fill', 'none')
        .attr('stroke', (d) => color(d.keyword))
        .attr('stroke-width', 1.8)
        .attr('d', (d) => line(d.series))
        .attr('opacity', 0.9);

    // Legend at bottom
    const legend = svg.append('g').attr('transform', `translate(${MARGIN.left},${height - 18})`);
    let cursor = 0;
    const gap = Math.min(110, iw / data.length);
    data.forEach((d, i) => {
        const item = legend.append('g').attr('transform', `translate(${cursor},0)`);
        item.append('circle').attr('r', 4).attr('cy', -3).attr('fill', color(d.keyword));
        item.append('text').attr('x', 9)
            .attr('fill', COLORS.muted).style('font-size', '11px')
            .text(d.keyword);
        cursor += gap;
    });

    // Hover: vertical guide + tooltip showing all keywords for that year
    const guide = g.append('line').attr('y1', 0).attr('y2', ih)
        .attr('stroke', COLORS.muted).attr('stroke-dasharray', '2,3').style('display', 'none');

    const overlay = g.append('rect')
        .attr('width', iw).attr('height', ih).attr('fill', 'none').attr('pointer-events', 'all');

    const bisect = d3.bisector((p) => p.year).left;
    overlay
        .on('mouseenter', () => guide.style('display', null))
        .on('mouseleave', () => { guide.style('display', 'none'); chartTooltip.hide(); })
        .on('mousemove', (event) => {
            const xm = x.invert(d3.pointer(event, g.node())[0]);
            const i = Math.min(years.length - 1, Math.max(0, bisect(years.map((y) => ({ year: y })), xm, 1) - 1));
            const year = years[i];
            guide.attr('x1', x(year)).attr('x2', x(year));
            const rows = data.map((kw) => {
                const v = kw.series[i].rate;
                return `<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:${color(kw.keyword)}">&#9632;</span><span>${kw.keyword}</span><b>${v.toFixed(2)}</b></div>`;
            }).join('');
            chartTooltip.show(`<b>${year}</b>${rows}`, event);
        });
}
