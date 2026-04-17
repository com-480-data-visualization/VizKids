import { loadSpeechStats } from '../data/loader.js';

export class Panel {
    constructor(el) {
        this.el = el;
        this._abortController = null;
    }

    async show(country, year) {
        if (this._abortController) this._abortController.abort();
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        this.el.hidden = false;
        this.el.innerHTML = `
            <h2>${escapeHtml(country.name)} <small style="color:#8892a0;font-weight:400">${country.iso3}</small></h2>
            <div class="panel-year-badge">${year}</div>
            <p class="panel-loading">Loading speech…</p>
        `;

        let stats;
        try {
            stats = await loadSpeechStats(country.iso3, year);
        } catch (e) {
            if (signal.aborted) return;
            stats = null;
        }
        if (signal.aborted) return;

        if (!stats) {
            this.el.innerHTML = `
                <h2>${escapeHtml(country.name)} <small style="color:#8892a0;font-weight:400">${country.iso3}</small></h2>
                <div class="panel-year-badge">${year}</div>
                <div class="panel-no-speech">
                    <span class="panel-no-speech-icon">—</span>
                    <p>${escapeHtml(country.name)} did not deliver a speech in ${year}.</p>
                </div>
            `;
            return;
        }

        const words = stats.topWords.map(
            ([w, n]) => `<span class="word">${escapeHtml(w)} <small style="color:#8892a0">${n}</small></span>`
        ).join('');

        this.el.innerHTML = `
            <h2>${escapeHtml(country.name)} <small style="color:#8892a0;font-weight:400">${country.iso3}</small></h2>
            <div class="panel-year-badge">${year}</div>

            <div class="panel-stats-grid">
                <div class="panel-stat">
                    <span class="panel-stat-val">${stats.wordCount.toLocaleString()}</span>
                    <span class="panel-stat-lbl">words</span>
                </div>
                <div class="panel-stat">
                    <span class="panel-stat-val">${stats.sentenceCount.toLocaleString()}</span>
                    <span class="panel-stat-lbl">sentences</span>
                </div>
                <div class="panel-stat">
                    <span class="panel-stat-val">${stats.uniqueWords.toLocaleString()}</span>
                    <span class="panel-stat-lbl">unique words</span>
                </div>
                <div class="panel-stat">
                    <span class="panel-stat-val">${(stats.wordCount / Math.max(stats.sentenceCount, 1)).toFixed(1)}</span>
                    <span class="panel-stat-lbl">words / sentence</span>
                </div>
            </div>

            <div class="speech-box">
                ${escapeHtml(stats.text)}
            </div>

            <div class="words" style="margin-top:1rem">
                <div class="label" style="color:#8892a0;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem">Top words this speech</div>
                ${words || '<span style="color:#8892a0">—</span>'}
            </div>
        `;
    }


    showNoSpeech(country, year) {
    if (this._abortController) this._abortController.abort();
    this.el.hidden = false;
    this.el.innerHTML = `
        <h2>${escapeHtml(country.name)} <small style="color:#8892a0;font-weight:400">${country.iso3}</small></h2>
        <div class="panel-year-badge">${year}</div>
        <div class="panel-no-speech">
            <span class="panel-no-speech-icon">—</span>
            <p>${escapeHtml(country.name)} did not deliver a speech in ${year}.</p>
        </div>
    `;
}

}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}