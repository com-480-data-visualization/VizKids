import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { COLORS, styleAxis } from './palette.js';
import { chartTooltip } from './tooltip.js';

export function render(container, rawData, { top = 20 } = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    const data = rawData.slice(0, top).map(([word, count]) => ({ word, count }));

    const margin = { top: 10, right: 50, bottom: 20, left: 80 };
    const width = el.clientWidth || 480;
    const rowH = 20;
    const height = margin.top + margin.bottom + data.length * rowH;
    const iw = width - margin.left - margin.right;
    const ih = height - margin.top - margin.bottom;

    el.innerHTML = '';
    const svg = d3.select(el).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('width', '100%').attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().domain(data.map((d) => d.word)).range([0, ih]).padding(0.2);
    const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.count)]).range([0, iw]);
    const color = d3.scaleSequential(d3.interpolateInferno)
        .domain([data.length + 4, -2]); // reversed — top word gets bright

    // Y axis (labels)
    g.append('g').call(d3.axisLeft(y).tickSize(0)).call(styleAxis)
        .call((sel) => sel.select('.domain').remove());

    // Bars
    g.selectAll('rect').data(data).enter().append('rect')
        .attr('x', 0)
        .attr('y', (d) => y(d.word))
        .attr('height', y.bandwidth())
        .attr('width', (d) => x(d.count))
        .attr('rx', 3)
        .attr('fill', (_, i) => color(i))
        .on('mouseenter', (event, d) => chartTooltip.show(`<b>${d.word}</b><br>${d.count.toLocaleString()} occurrences`, event))
        .on('mousemove', (event) => chartTooltip.move(event))
        .on('mouseleave', () => chartTooltip.hide());

    // Value labels at end of each bar
    g.selectAll('text.value').data(data).enter().append('text')
        .attr('class', 'value')
        .attr('x', (d) => x(d.count) + 6)
        .attr('y', (d) => y(d.word) + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('fill', COLORS.muted)
        .style('font-size', '11px')
        .style('font-variant-numeric', 'tabular-nums')
        .text((d) => d.count.toLocaleString());
}
