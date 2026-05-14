// External CDN sources. Loaded once at startup.
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const ISO_MAP_URL = 'data/iso-numeric-to-alpha3.json';
const STATS_URL = 'data/country_stats.json';
const GLOBAL_STATS_URL = 'data/global_stats.json';
const TOPIC_RATES_URL = 'data/topic_rates.json';
const EVENTS_URL = 'data/events.json';
const BLOCS_URL = 'data/blocs.json';
const MENTIONS_URL = 'data/mentions.json';
const DISTINCTIVE_URL = 'data/distinctive.json';

export async function loadWorld() {
    const [topology, isoMap] = await Promise.all([
        fetchJSON(WORLD_URL),
        fetchJSON(ISO_MAP_URL),
    ]);
    // Lazy-load topojson-client from CDN (ES module)
    const topojson = await import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm');
    const countries = topojson.feature(topology, topology.objects.countries);
    const land = topojson.merge(topology, topology.objects.countries.geometries);

    // Attach ISO3 to each feature
    for (const f of countries.features) {
        const numeric = String(f.id).padStart(3, '0');
        f.properties = f.properties || {};
        f.properties.iso3 = isoMap[numeric] || null;
    }
    return { countries, land };
}

export async function loadStats() {
    try {
        return await fetchJSON(STATS_URL);
    } catch (e) {
        console.warn('country_stats.json not found, using empty stats');
        return {};
    }
}

export async function loadGlobalStats() {
    return fetchJSON(GLOBAL_STATS_URL);
}

export async function loadTopicRates() {
    return fetchJSON(TOPIC_RATES_URL);
}

export async function loadEvents() {
    try {
        const obj = await fetchJSON(EVENTS_URL);
        // Accept either the full {meta, events} shape or a raw array.
        return Array.isArray(obj) ? obj : (obj.events || []);
    } catch (e) {
        console.warn('events.json missing, skipping annotations');
        return [];
    }
}

export async function loadBlocs() {
    return fetchJSON(BLOCS_URL);
}

export async function loadMentions() {
    return fetchJSON(MENTIONS_URL);
}

export async function loadDistinctive() {
    return fetchJSON(DISTINCTIVE_URL);
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return res.json();
}
