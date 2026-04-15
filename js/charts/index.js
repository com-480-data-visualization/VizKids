import { render as speechesPerYear } from './speeches-per-year.js';
import { render as speechLength } from './speech-length.js';
import { render as topWords } from './top-words.js';
import { render as keywordTrends } from './keyword-trends.js';

export async function initCharts(globalStats) {
    speechesPerYear('#chart-speeches', globalStats.speeches_per_year);
    speechLength('#chart-length', globalStats.median_words_per_year);
    topWords('#chart-words', globalStats.top_words, { top: 20 });
    keywordTrends('#chart-keywords', globalStats.keywords);
}
