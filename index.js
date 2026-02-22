require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio'); // The Scalpel

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(helmet());

// ==========================================
// THE AEGIS PROTOCOL
// ==========================================
const allowedOrigins = ['https://nova-iota-gules.vercel.app', 'http://localhost:3000'];
app.use(cors({
    origin: (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error('Blocked by Aegis'))
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 150, 
    message: { error: 'Shield Wall activated.' }
});
app.use(limiter);
app.use(express.json());

// ==========================================
// THE MANGAPILL PRECISION EXTRACTOR
// ==========================================

const PILL_BASE = 'https://mangapill.com';
const stealthHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
};

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Target title required' });

        console.log(`[Extractor] Searching MangaPill for: ${title}`);

        // 1. Search MangaPill's HTML
        const searchUrl = `${PILL_BASE}/search?q=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(searchUrl, { headers: stealthHeaders });
        const $search = cheerio.load(searchRes.data);

        // PRECISION TARGETING: Find the first link that explicitly goes to a manga page
        const firstResult = $search('a[href^="/manga/"]').first().attr('href');
        
        if (!firstResult) {
            console.log(`[Extractor] Target not found on MangaPill.`);
            return res.json({ chapters: [], source: 'mangapill' });
        }

        const mangaUrl = `${PILL_BASE}${firstResult}`;
        console.log(`[Extractor] Target acquired: ${mangaUrl}`);

        // 2. Fetch the Manga Page and slice out chapters
        const mangaRes = await axios.get(mangaUrl, { headers: stealthHeaders });
        const $manga = cheerio.load(mangaRes.data);
        
        let chapters = [];
        
        // PRECISION TARGETING: Find all links that explicitly go to a chapter
        $manga('a[href^="/chapter/"]').each((i, el) => {
            const chapUrl = $manga(el).attr('href');
            const chapText = $manga(el).text().trim().replace(/Chapter /i, '') || 'Oneshot';
            
            const safeId = Buffer.from(chapUrl).toString('base64');
            
            // Prevent duplicates just in case MangaPill lists a chapter twice
            if (!chapters.find(c => c.id === safeId)) {
                chapters.push({
                    id: safeId,
                    attributes: { chapter: chapText, title: '' }
                });
            }
        });

        // MangaPill lists chapters newest first, let's reverse it so Chapter 1 is at the top
        chapters.reverse();

        console.log(`[Extractor] Success. Extracted ${chapters.length} chapters.`);
        res.json({ chapters: chapters, source: 'mangapill' });

    } catch (error) {
        console.error('[Extractor] Breach Failed:', error.message);
        res.status(500).json({ error: 'Failed to scrape target' });
    }
});

app.get('/api/scrape/images', async (req, res) => {
    try {
        const { chapterId } = req.query;
        if (!chapterId) return res.status(400).json({ error: 'Chapter ID required' });

        // Decode the URL
        const targetPath = Buffer.from(chapterId, 'base64').toString('ascii');
        const chapUrl = `${PILL_BASE}${targetPath}`;
        
        console.log(`[Extractor] Ripping images from ${chapUrl}...`);
        const chapRes = await axios.get(chapUrl, { headers: stealthHeaders });
        const $ = cheerio.load(chapRes.data);
        
        let images = [];
        
        // MangaPill lazy-loads images, grab data-src first, then fallback to src
        $('picture img, img[data-src]').each((i, el) => {
            const imgUrl = $(el).attr('data-src') || $(el).attr('src');
            if (imgUrl) images.push(imgUrl);
        });
        
        res.json({ images });
    } catch (error) {
        console.error('[Extractor] Image Rip Failed:', error.message);
        res.status(500).json({ error: 'Failed to extract images' });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        weapons: "MangaPill Precision Extractor",
        shields: "Raised"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});

