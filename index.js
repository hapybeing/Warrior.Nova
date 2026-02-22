require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio'); // The Scalpel returns

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = [
    'https://nova-iota-gules.vercel.app', 
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by Aegis: Unauthorized Origin'));
        }
    }
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 150, 
    message: { error: 'Shield Wall activated: Stop spamming the server.' }
});
app.use(limiter);
app.use(express.json());

// ==========================================
// THE GHOST PROXY: ALLORIGINS + MANGANATO
// ==========================================

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Target title required' });

        console.log(`[Ghost Proxy] Engaging target: ${title}`);

        // 1. Format the target URL for Manganato
        const searchTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
        const targetUrl = `https://manganato.com/search/story/${searchTitle}`;
        
        // 2. Wrap the target URL in the AllOrigins Ghost Proxy to bypass Cloudflare
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        
        console.log(`[Ghost Proxy] Routing search through AllOrigins...`);
        const searchRes = await axios.get(proxyUrl);
        
        // AllOrigins hides the HTML inside the "contents" property
        const html = searchRes.data.contents;
        const $search = cheerio.load(html);
        
        const firstResult = $search('.search-story-item a.item-title').first();
        if (!firstResult.length) {
            console.log(`[Ghost Proxy] Target not found.`);
            return res.json({ chapters: [], source: 'manganato-proxy' });
        }

        const mangaUrl = firstResult.attr('href');
        console.log(`[Ghost Proxy] Target acquired: ${mangaUrl}. Ripping chapters...`);

        // 3. Route the chapter page through the Ghost Proxy as well
        const mangaProxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(mangaUrl)}`;
        const mangaRes = await axios.get(mangaProxyUrl);
        const $manga = cheerio.load(mangaRes.data.contents);
        
        let chapters = [];
        $manga('.row-content-chapter li a.chapter-name').each((i, el) => {
            const chapNode = $manga(el);
            let chapText = chapNode.text().replace(/Chapter/i, '').trim();
            const chapUrl = chapNode.attr('href');
            
            // Encode the URL so it travels safely to your frontend
            const safeId = Buffer.from(chapUrl).toString('base64');
            
            chapters.push({
                id: safeId, 
                attributes: { chapter: chapText, title: '' }
            });
        });

        console.log(`[Ghost Proxy] Success. Extracted ${chapters.length} chapters.`);
        res.json({ chapters: chapters, source: 'manganato-proxy' });

    } catch (error) {
        console.error('[Ghost Proxy] Breach Failed:', error.message);
        res.status(500).json({ error: 'Failed to breach target servers' });
    }
});

// Steal the actual image links through the proxy
app.get('/api/scrape/images', async (req, res) => {
    try {
        const { chapterId } = req.query;
        if (!chapterId) return res.status(400).json({ error: 'Chapter ID required' });

        // Decode the URL we passed from the frontend
        const targetUrl = Buffer.from(chapterId, 'base64').toString('ascii');
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        
        console.log(`[Ghost Proxy] Ripping images for chapter...`);
        const chapRes = await axios.get(proxyUrl);
        const $ = cheerio.load(chapRes.data.contents);
        
        let images = [];
        $('.container-chapter-reader img').each((i, el) => {
            images.push($(el).attr('src'));
        });
        
        res.json({ images });
    } catch (error) {
        console.error('[Ghost Proxy] Image Rip Failed:', error.message);
        res.status(500).json({ error: 'Failed to extract images' });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        weapons: "Ghost Proxy (AllOrigins + Manganato)",
        shields: "Raised"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
