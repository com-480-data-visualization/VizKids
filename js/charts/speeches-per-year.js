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

    const x = d3.scaleBand()
        .domain(data.map((d) => d.year))
        .range([0, iw])
        .padding(0.18);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, (d) => d.count)]).nice()
        .range([ih, 0]);

    // Gridlines
    g.append('g').attr('class', 'grid')
        .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(''))
        .call((sel) => sel.selectAll('line').attr('stroke', COLORS.grid))
        .call((sel) => sel.select('.domain').remove());

    // Axes
    const step = Math.max(1, Math.ceil(data.length / 10));
    g.append('g').attr('transform', `translate(0,${ih})`)
        .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % step === 0)))
        .call(styleAxis);
    g.append('g').call(d3.axisLeft(y).ticks(5)).call(styleAxis);

    // Bars
    g.selectAll('rect.bar').data(data).enter().append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d.year))
        .attr('y', (d) => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', (d) => ih - y(d.count))
        .attr('fill', COLORS.amber)
        .attr('rx', 2)
        .on('mouseenter', (event, d) => {
            d3.select(event.currentTarget).attr('fill', COLORS.pink);
            chartTooltip.show(`<b>${d.year}</b><br>${d.count} speeches`, event);
        })
        .on('mousemove', (event) => chartTooltip.move(event))
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).attr('fill', COLORS.amber);
            chartTooltip.hide();
        });
}
