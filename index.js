require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

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

const stealthHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://comick.io/'
};

// ==========================================
// THE BATTERING RAM: COMICK API EXTRACTOR
// ==========================================

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Target title required' });

        console.log(`[Battering Ram] Engaging Comick API for: ${title}`);

        const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const encoded = encodeURIComponent(cleanTitle);

        // THE MULTI-BREACH: Tests every known domain and uses the Tachiyomi disguise
        const targets = [
            `https://api.comick.io/v1.0/search/?q=${encoded}&limit=1&tachiyomi=true`,
            `https://api.comick.dev/v1.0/search/?q=${encoded}&limit=1&tachiyomi=true`,
            `https://api.comick.fun/v1.0/search/?q=${encoded}&limit=1&tachiyomi=true`
        ];

        let searchRes = null;
        let successfulDomain = '';

        for (const url of targets) {
            try {
                console.log(`[Battering Ram] Testing breach point: ${new URL(url).hostname}...`);
                searchRes = await axios.get(url, { headers: stealthHeaders });
                if (searchRes.data && searchRes.data.length > 0) {
                    successfulDomain = new URL(url).hostname;
                    console.log(`[Battering Ram] Wall breached at ${successfulDomain}!`);
                    break; 
                }
            } catch (e) {
                console.log(`[Battering Ram] Point blocked (404/403). Switching doors...`);
            }
        }

        if (!searchRes || !searchRes.data || searchRes.data.length === 0) {
            console.log(`[Battering Ram] All breach points failed or target missing.`);
            return res.json({ chapters: [], source: 'comick' });
        }

        const targetHid = searchRes.data[0].hid;
        console.log(`[Battering Ram] Target acquired. HID: ${targetHid}`);

        // Extract Chapters from the domain that worked
        const chapUrl = `https://${successfulDomain}/comic/${targetHid}/chapters?lang=en&limit=500&tachiyomi=true`;
        const chapRes = await axios.get(chapUrl, { headers: stealthHeaders });
        
        let chapters = [];
        if (chapRes.data && chapRes.data.chapters) {
            const seen = new Set();
            chapters = chapRes.data.chapters.filter(c => {
                if (!c.chap) return true;
                if (seen.has(c.chap)) return false;
                seen.add(c.chap);
                return true;
            }).map(c => ({
                id: c.hid, 
                attributes: { chapter: c.chap, title: c.title || '' }
            }));
        }

        console.log(`[Battering Ram] Success. Extracted ${chapters.length} chapters.`);
        res.json({ chapters: chapters, source: 'comick' });

    } catch (error) {
        console.error('[Battering Ram] Critical System Failure:', error.message);
        res.status(500).json({ error: 'Failed to breach target servers' });
    }
});

app.get('/api/scrape/images', async (req, res) => {
    try {
        const { chapterId } = req.query;
        if (!chapterId) return res.status(400).json({ error: 'Chapter ID required' });

        let chapRes;
        try {
            chapRes = await axios.get(`https://api.comick.io/chapter/${chapterId}?tachiyomi=true`, { headers: stealthHeaders });
        } catch (e) {
            chapRes = await axios.get(`https://api.comick.dev/chapter/${chapterId}?tachiyomi=true`, { headers: stealthHeaders });
        }
        
        if (chapRes.data && chapRes.data.chapter && chapRes.data.chapter.images) {
            const images = chapRes.data.chapter.images.map(img => img.url);
            return res.json({ images });
        }
        res.json({ images: [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to extract images' });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        weapons: "Multi-Breach Comick Ram Loaded",
        shields: "Raised"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
