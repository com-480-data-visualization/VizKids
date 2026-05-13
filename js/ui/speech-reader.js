// Slide-out drawer that loads a country's UN speech text on demand.
// Files are sharded at data/speeches/{ISO3}.json — only fetched when the user
// clicks a country, then cached for the rest of the session.

const SPEECH_URL = (iso3) => `data/speeches/${iso3}.json`;

export class SpeechReader {
    constructor({ root, registry }) {
        this.root = root;
        this.registry = registry;
        this.cache = new Map();          // iso3 -> data
        this.country = null;             // currently shown Country
        this.data = null;                // currently shown speech file
        this.year = null;
        this.topic = null;               // { key, label, keywords } from topic map

        this.elTitle    = root.querySelector('.sr-country');
        this.elIso      = root.querySelector('.sr-iso');
        this.elTopic    = root.querySelector('.sr-topic');
        this.elYear     = root.querySelector('.sr-year-select');
        this.elWords    = root.querySelector('.sr-wordcount');
        this.elBody     = root.querySelector('.sr-body');
        this.elClose    = root.querySelector('.sr-close');
        this.elBackdrop = root.querySelector('.sr-backdrop');

        this.elClose.addEventListener('click', () => this.hide());
        this.elBackdrop.addEventListener('click', () => this.hide());
        this.elYear.addEventListener('change', (e) => this._renderYear(Number(e.target.value)));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.root.hidden) this.hide();
        });
    }

    setTopic(topic) {
        // Called when the topic-map's selected topic changes. If the drawer is
        // open, re-highlight; if closed, just remember for next open.
        this.topic = topic;
        if (!this.root.hidden && this.data && this.year !== null) {
            this._renderBody(this.year);
        }
        if (this.elTopic) this.elTopic.textContent = topic ? topic.label : '';
    }

    async show(country, preferredYear) {
        this.country = country;
        this.elTitle.textContent = country.name;
        this.elIso.textContent = country.iso3;
        if (this.topic && this.elTopic) this.elTopic.textContent = this.topic.label;

        this.root.hidden = false;
        // Force a reflow so the slide-in transition triggers cleanly.
        void this.root.offsetWidth;
        this.root.classList.add('is-open');

        this.elBody.innerHTML = '<p class="sr-loading">Loading speech…</p>';
        this.elYear.innerHTML = '';
        this.elWords.textContent = '';

        let data;
        try {
            data = await this._load(country.iso3);
        } catch (err) {
            this.elBody.innerHTML = `<p class="sr-loading sr-error">Could not load speeches for ${escapeHtml(country.name)} (${escapeHtml(country.iso3)}).</p>`;
            return;
        }

        this.data = data;
        if (!data.years || data.years.length === 0) {
            this.elBody.innerHTML = `<p class="sr-loading">${escapeHtml(country.name)} has no recorded speeches.</p>`;
            return;
        }

        // Populate year dropdown (descending — recent at top).
        const years = [...data.years].sort((a, b) => b - a);
        for (const y of years) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            this.elYear.appendChild(opt);
        }
        // Try preferred year, otherwise the most recent.
        const initialYear = years.includes(Number(preferredYear)) ? Number(preferredYear) : years[0];
        this.elYear.value = String(initialYear);
        this._renderYear(initialYear);
    }

    hide() {
        this.root.classList.remove('is-open');
        // Wait for animation to finish before hiding fully (matches CSS duration).
        setTimeout(() => { this.root.hidden = true; }, 240);
    }

    async _load(iso3) {
        if (this.cache.has(iso3)) return this.cache.get(iso3);
        const res = await fetch(SPEECH_URL(iso3));
        if (!res.ok) throw new Error(`fetch ${iso3} ${res.status}`);
        const data = await res.json();
        this.cache.set(iso3, data);
        return data;
    }

    _renderYear(year) {
        this.year = year;
        this._renderBody(year);
    }

    _renderBody(year) {
        const sp = this.data && this.data.speeches && this.data.speeches[String(year)];
        if (!sp) {
            this.elBody.innerHTML = `<p class="sr-loading">No speech for ${year}.</p>`;
            this.elWords.textContent = '';
            return;
        }
        this.elWords.textContent = `${sp.word_count.toLocaleString()} words`;

        const keywords = (this.topic && this.topic.keywords) || [];
        const html = sp.paragraphs.map((p) => `<p>${highlight(p, keywords)}</p>`).join('');
        this.elBody.innerHTML = html;
        // Scroll to top on new speech.
        this.elBody.scrollTop = 0;
    }
}

function highlight(text, keywords) {
    const escaped = escapeHtml(text);
    if (!keywords || keywords.length === 0) return escaped;
    // Sort longer keywords first so e.g. "terrorism" wins over "terror" via the
    // alternation engine (regex picks the first alternative that matches).
    const sorted = [...keywords].sort((a, b) => b.length - a.length).map(escapeRegex);
    const pattern = new RegExp(`\\b(${sorted.join('|')})\\b`, 'gi');
    return escaped.replace(pattern, '<mark class="sr-hit">$1</mark>');
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
