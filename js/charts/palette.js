// Single source of truth for every chart's colors. Keep this in sync with
// the CSS custom properties in css/style.css.
export const COLORS = {
    bg:       '#0b1020',
    surface:  '#111836',
    ink:      '#f0f3fa',
    muted:    '#95a3c4',
    grid:     'rgba(120,160,230,0.10)',
    axis:     'rgba(149,163,196,0.35)',

    amber:    '#ffb703',
    teal:     '#06d6a0',
    pink:     '#ef476f',
    cyan:     '#4ea8de',
    orange:   '#fb8500',
    purple:   '#8338ec',
    lime:     '#c7f464',
    red:      '#e63946',
};

export const CATEGORICAL = [
    COLORS.amber, COLORS.teal, COLORS.pink, COLORS.cyan,
    COLORS.purple, COLORS.orange, COLORS.lime, COLORS.red,
];

export const MARGIN = { top: 20, right: 20, bottom: 40, left: 52 };

// Apply consistent axis styling to a d3 axis selection.
export function styleAxis(g) {
    g.selectAll('text').attr('fill', COLORS.muted).style('font-size', '11px');
    g.selectAll('line').attr('stroke', COLORS.axis);
    g.select('.domain').attr('stroke', COLORS.axis);
}
