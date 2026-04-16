const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const ISO_MAP_URL = 'data/iso-numeric-to-alpha3.json';
const STATS_URL = 'data/country_stats.json';
const GLOBAL_STATS_URL = 'data/global_stats.json';

export async function loadWorld() {
    const [topology, isoMap] = await Promise.all([
        fetchJSON(WORLD_URL),
        fetchJSON(ISO_MAP_URL),
    ]);
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

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return res.json();
}

/**
 * Fetches a single speech text file based on ISO3 code and Year.
 */
export async function loadSpeechText(iso3, year) {
    try {
        const response = await fetch(`data/speeches/${iso3}_${year}.txt`);
        if (!response.ok) throw new Error('Speech not found');
        return await response.text();
    } catch (err) {
        console.warn(`Speech missing: ${iso3} in ${year}`);
        return null;
    }
}