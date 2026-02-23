require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: 'https://nova-iota-gules.vercel.app' }));
app.use(express.json());

const stealthHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://manganato.com/'
};

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        // Search Manganato with a more flexible query
        const searchUrl = `https://manganato.com/search/story/${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const searchRes = await axios.get(searchUrl, { headers: stealthHeaders });
        const $ = cheerio.load(searchRes.data);
        
        // Find the best link in the search results
        const firstResult = $('.search-story-item a.item-title').first().attr('href');
        if (!firstResult) return res.json({ chapters: [] });

        const mangaRes = await axios.get(firstResult, { headers: stealthHeaders });
        const $manga = cheerio.load(mangaRes.data);
        let chapters = [];
        $('.row-content-chapter li a').each((i, el) => {
            const url = $(el).attr('href');
            const name = $(el).text().trim();
            chapters.push({
                id: Buffer.from(url).toString('base64'),
                num: name.match(/\d+(\.\d+)?/)?.[0] || '?',
                title: name
            });
        });
        res.json({ chapters });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/scrape/images', async (req, res) => {
    try {
        const target = Buffer.from(req.query.chapterId, 'base64').toString('ascii');
        const resHtml = await axios.get(target, { headers: stealthHeaders });
        const $ = cheerio.load(resHtml.data);
        let images = [];
        $('.container-chapter-reader img').each((i, el) => {
            const src = $(el).attr('src');
            if (src) images.push(src);
        });
        res.json({ images });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/proxy/image', async (req, res) => {
    try {
        const response = await axios.get(req.query.url, {
            responseType: 'arraybuffer',
            headers: { 'Referer': 'https://chapmanganato.to/' }
        });
        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (e) { res.status(500).send('Failed'); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Aggregator Online`));
