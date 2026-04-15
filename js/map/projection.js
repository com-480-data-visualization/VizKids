import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

export function buildProjection(width, height, land) {
    const projection = d3.geoEqualEarth();
    projection.fitSize([width, height], land);
    return projection;
}

export function buildPath(projection) {
    return d3.geoPath(projection);
}
