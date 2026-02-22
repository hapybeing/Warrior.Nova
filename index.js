require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio'); // The Scalpel

const app = express();
const PORT = process.env.PORT || 10000;

// Trust Render's proxy to prevent rate-limit crashes
app.set('trust proxy', 1);

// ==========================================
// THE AEGIS PROTOCOL: SECURITY SYSTEM
// ==========================================
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
// THE GHOST PROXY V2: CORSPROXY + MANGANATO
// ==========================================

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Target title required' });

        console.log(`[Ghost Proxy V2] Engaging target: ${title}`);

        const searchTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
        const targetUrl = `https://manganato.com/search/story/${searchTitle}`;
        
        // NEW MASK: CorsProxy.io
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        console.log(`[Ghost Proxy V2] Routing search through CorsProxy...`);
        
        const searchRes = await axios.get(proxyUrl);
        const $search = cheerio.load(searchRes.data);
        
        const firstResult = $search('.search-story-item a.item-title').first();
        if (!firstResult.length) {
            console.log(`[Ghost Proxy V2] Target not found.`);
            return res.json({ chapters: [], source: 'manganato-proxy-v2' });
        }

        const mangaUrl = firstResult.attr('href');
        console.log(`[Ghost Proxy V2] Target acquired: ${mangaUrl}. Ripping chapters...`);

        const mangaProxyUrl = `https://corsproxy.io/?${encodeURIComponent(mangaUrl)}`;
        const mangaRes = await axios.get(mangaProxyUrl);
        const $manga = cheerio.load(mangaRes.data);
        
        let chapters = [];
        $manga('.row-content-chapter li a.chapter-name').each((i, el) => {
            const chapNode = $manga(el);
            let chapText = chapNode.text().replace(/Chapter/i, '').trim();
            const chapUrl = chapNode.attr('href');
            
            const safeId = Buffer.from(chapUrl).toString('base64');
            
            chapters.push({
                id: safeId, 
                attributes: { chapter: chapText, title: '' }
            });
        });

        console.log(`[Ghost Proxy V2] Success. Extracted ${chapters.length} chapters.`);
        res.json({ chapters: chapters, source: 'manganato-proxy-v2' });

    } catch (error) {
        const status = error.response ? error.response.status : error.message;
        console.error(`[Ghost Proxy V2] Breach Failed (Status: ${status})`);
        res.status(500).json({ error: 'Failed to breach target servers' });
    }
});

app.get('/api/scrape/images', async (req, res) => {
    try {
        const { chapterId } = req.query;
        if (!chapterId) return res.status(400).json({ error: 'Chapter ID required' });

        const targetUrl = Buffer.from(chapterId, 'base64').toString('ascii');
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        console.log(`[Ghost Proxy V2] Ripping images for chapter...`);
        const chapRes = await axios.get(proxyUrl);
        const $ = cheerio.load(chapRes.data);
        
        let images = [];
        $('.container-chapter-reader img').each((i, el) => {
            images.push($(el).attr('src'));
        });
        
        res.json({ images });
    } catch (error) {
        console.error('[Ghost Proxy V2] Image Rip Failed:', error.message);
        res.status(500).json({ error: 'Failed to extract images' });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        weapons: "Ghost Proxy V2 (CorsProxy)",
        shields: "Raised"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
