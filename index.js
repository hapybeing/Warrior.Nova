require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const cheerio = require('cheerio'); 

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: 'https://nova-iota-gules.vercel.app' }));
app.use(express.json());

const N_BASE = 'https://manganato.com';
const stealthHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://manganato.com/'
};

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Title required' });

        // 1. Search Manganato
        const searchUrl = `https://manganato.com/search/story/${title.toLowerCase().replace(/ /g, '_')}`;
        const searchRes = await axios.get(searchUrl, { headers: stealthHeaders });
        const $search = cheerio.load(searchRes.data);

        // Find the most relevant search result
        const firstResult = $search('.search-story-item a.item-title').first().attr('href');
        
        if (!firstResult) {
            return res.json({ chapters: [], source: 'manganato' });
        }

        // 2. Fetch Chapters
        const mangaRes = await axios.get(firstResult, { headers: stealthHeaders });
        const $manga = cheerio.load(mangaRes.data);
        
        let chapters = [];
        $manga('.row-content-chapter li a').each((i, el) => {
            const chapUrl = $manga(el).attr('href');
            const chapName = $manga(el).text().trim();
            const safeId = Buffer.from(chapUrl).toString('base64');
            
            chapters.push({
                id: safeId,
                attributes: { chapter: chapName.match(/\d+/)?.[0] || '?', title: chapName }
            });
        });

        res.json({ chapters });
    } catch (error) {
        res.status(500).json({ error: 'Scrape failed' });
    }
});

app.get('/api/scrape/images', async (req, res) => {
    try {
        const { chapterId } = req.query;
        const targetUrl = Buffer.from(chapterId, 'base64').toString('ascii');
        
        const chapRes = await axios.get(targetUrl, { headers: stealthHeaders });
        const $ = cheerio.load(chapRes.data);
        
        let images = [];
        $('.container-chapter-reader img').each((i, el) => {
            const imgUrl = $(el).attr('src');
            if (imgUrl) images.push(imgUrl);
        });
        
        res.json({ images });
    } catch (error) {
        res.status(500).json({ error: 'Image rip failed' });
    }
});

app.get('/api/proxy/image', async (req, res) => {
    try {
        const { url } = req.query;
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'Referer': 'https://chapmanganato.to/' }
        });
        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        res.status(500).send('Proxy failed');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Aggregator Online`));
