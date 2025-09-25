// scripts/fetch_wikipedia.js
// Script to fetch data from Wikipedia API and save to data/wikipedia.json

const fs = require('fs');
const https = require('https');

const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

function fetchWikipediaSummary(title) {
    return new Promise((resolve, reject) => {
        const url = WIKIPEDIA_API_URL + encodeURIComponent(title);
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function fetchAndSave(titles) {
    const results = [];
    for (const title of titles) {
        try {
            const summary = await fetchWikipediaSummary(title);
            results.push({ title, summary });
            console.log(`Fetched: ${title}`);
        } catch (err) {
            console.error(`Error fetching ${title}:`, err.message);
        }
    }
    fs.writeFileSync('data/wikipedia.json', JSON.stringify(results, null, 2));
    console.log('Saved data/wikipedia.json');
}

// Example usage: fetch summaries for some topics
const topics = [
    'Artificial intelligence',
    'Machine learning',
    'Natural language processing',
    'Neural network',
    'Data science'
];

fetchAndSave(topics);
