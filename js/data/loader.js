const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const ISO_MAP_URL = 'data/iso-numeric-to-alpha3.json';
const STATS_URL = 'data/country_stats.json';
const GLOBAL_STATS_URL = 'data/global_stats.json';

export const SUCCESSOR_MAP = {
    YUG: 'SRB',
    DDR: 'DEU',
    CSK: 'CZE',
    YMD: 'YEM',
    YDYE: 'YEM',
    VDR: 'VNM',
    SUN: 'RUS',
    BYS: 'BLR',
    ZAN: 'TZA',
};

export const PREDECESSOR_MAP = Object.fromEntries(
    Object.entries(SUCCESSOR_MAP).map(([old, modern]) => [modern, old])
);

export async function loadWorld() {
    const [topology, isoMap] = await Promise.all([
        fetchJSON(WORLD_URL),
        fetchJSON(ISO_MAP_URL),
    ]);
    const topojson = await import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm');
    const countries = topojson.feature(topology, topology.objects.countries);
    const land = topojson.merge(topology, topology.objects.countries.geometries);

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

let _csvCache = null;
export async function loadSpeechesForYear(year) {
    const stats = await loadStats();
    
    const set = new Set();
    
    for (const [iso, data] of Object.entries(stats)) {
        if (data.years && data.years.includes(year)) {
            const modern = SUCCESSOR_MAP[iso] || iso;
            set.add(modern);
        }
    }
    return set;
}

export async function loadSpeechText(iso3, year) {
    const direct = await _tryFetchSpeech(iso3, year);
    if (direct !== null) return direct;

    const pred = PREDECESSOR_MAP[iso3];
    if (pred) {
        const fallback = await _tryFetchSpeech(pred, year);
        if (fallback !== null) return fallback;
    }

    console.warn(`Speech missing: ${iso3} (and predecessor) in ${year}`);
    return null;
}

async function _tryFetchSpeech(iso3, year) {
    try {
        const response = await fetch(`data/speeches/${iso3}_${year}.txt`);
        if (!response.ok) return null;
        return await response.text();
    } catch {
        return null;
    }
}



export async function loadSpeechStats(iso3, year) {
    const text = await loadSpeechText(iso3, year);
    if (!text) return null;

    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Sentence splitting: split on . ! ? followed by whitespace or end
    const sentences = text.split(/[.!?]+(?:\s|$)/).filter(s => s.trim().length > 1);
    const sentenceCount = sentences.length;

    // Unique words (lowercased, letters only)
    const cleaned = words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean);
    const uniqueWords = new Set(cleaned).size;

    const STOP = new Set(['the','a','an','and','or','but','in','on','of','to','for',
        'is','are','was','were','be','been','being','have','has','had','do','does',
        'did','will','would','could','should','may','might','shall','that','this',
        'these','those','it','its','we','our','us','they','their','them','he','she',
        'his','her','i','my','you','your','with','as','at','by','from','not','no',
        'so','if','which','who','what','all','also','more','than','when','there',
        'been','into','about','such','each','through','after','over','between',
        'both','only','other','same','then','since','under','while','during',
        'before','without','within','along','among','although','because','however']);

    const freq = new Map();
    for (const w of cleaned) {
        if (w.length < 3 || STOP.has(w)) continue;
        freq.set(w, (freq.get(w) || 0) + 1);
    }
    const topWords = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    return { text, wordCount, sentenceCount, uniqueWords, topWords };
}