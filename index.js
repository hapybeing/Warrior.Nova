require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000; // Render defaults to 10000

// ==========================================
// THE AEGIS PROTOCOL: SECURITY SYSTEM
// ==========================================

app.use(helmet());

// The Bouncer: Only allow Nova frontend to talk to this server
const allowedOrigins = [
    'https://nova-iota-gules.vercel.app', 
    'http://localhost:3000' // For local testing if needed
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
// THE BATTERING RAM: MANGANATO EXTRACTOR
// ==========================================

// Disguise our server as a normal Chrome browser so Cloudflare doesn't block us
const stealthHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://manganato.com/'
};

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Target title required' });

        console.log(`[Battering Ram] Engaging target: ${title}`);

        // 1. Clean the title for Manganato's specific search engine
        const searchTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
        const searchUrl = `https://manganato.com/search/story/${searchTitle}`;

        // 2. Breach the search page
        const searchRes = await axios.get(searchUrl, { headers: stealthHeaders });
        const $search = cheerio.load(searchRes.data);
        
        // Find the first manga result
        const firstResult = $search('.search-story-item a.item-title').first();
        if (!firstResult.length) {
            console.log(`[Battering Ram] Target not found on Manganato.`);
            return res.json({ chapters: [], source: 'manganato' });
        }

        const mangaUrl = firstResult.attr('href');
        console.log(`[Battering Ram] Target acquired: ${mangaUrl}`);

        // 3. Breach the manga page and slice out the chapters
        const mangaRes = await axios.get(mangaUrl, { headers: stealthHeaders });
        const $manga = cheerio.load(mangaRes.data);
        let chapters = [];

        $manga('.row-content-chapter li a.chapter-name').each((i, el) => {
            const chapNode = $manga(el);
            let chapText = chapNode.text().replace(/Chapter/i, '').trim();
            const chapUrl = chapNode.attr('href');

            // We encode the URL to base64 so it can safely travel to your frontend without breaking
            const safeId = Buffer.from(chapUrl).toString('base64');

            chapters.push({
                id: safeId, 
                attributes: { chapter: chapText, title: '' }
            });
        });

        console.log(`[Battering Ram] Success. Extracted ${chapters.length} chapters.`);
        res.json({ chapters: chapters, source: 'manganato' });

    } catch (error) {
        console.error('[Battering Ram] Breach Failed:', error.message);
        res.status(500).json({ error: 'Failed to breach target servers' });
    }
});

// ==========================================
// CORE ROUTES
// ==========================================

app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        weapons: "Battering Ram Loaded",
        shields: "Raised"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
