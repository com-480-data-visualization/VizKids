import { SUCCESSOR_MAP } from '../data/loader.js';

export class Country {
    constructor(iso3, feature, stats) {
        this.iso3 = iso3;
        this.feature = feature;
        this.stats = stats || null;
        this.name = (stats && stats.name) || (feature && feature.properties && feature.properties.name) || iso3;
        this.hasSpeechThisYear = false;
    }
    hasData() { return this.stats !== null; }
    get(metric) { return this.stats ? this.stats[metric] : null; }
}

export class CountryRegistry {
    constructor(world, stats) {
        this.world = world;
        this._byIso = new Map();
        this._listeners = new Set();

        for (const feature of world.countries.features) {
            const iso3 = feature.properties.iso3;
            if (!iso3) continue;
            this._byIso.set(iso3, new Country(iso3, feature, stats[iso3]));
        }
    }

    get(iso3) { return this._byIso.get(iso3) || null; }
    all() { return Array.from(this._byIso.values()); }
    forEach(fn) { this._byIso.forEach(fn); }

    onSelect(cb) { this._listeners.add(cb); return () => this._listeners.delete(cb); }
    emitSelect(country) { this._listeners.forEach((cb) => cb(country)); }

    markSpeechYear(speechSet) {
        for (const c of this._byIso.values()) {
            c.hasSpeechThisYear = speechSet.has(c.iso3);
        }
    }

    metricExtent(metric) {
        let min = Infinity, max = -Infinity;
        for (const c of this._byIso.values()) {
            const v = c.get(metric);
            if (typeof v === 'number' && !isNaN(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        return min === Infinity ? [0, 1] : [min, max];
    }
}