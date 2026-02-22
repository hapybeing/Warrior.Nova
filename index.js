require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

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
// THE ALLIANCE V2: MULTI-NODE ROUTER
// ==========================================

const CONSUMET_URL = 'https://api.consumet.org/manga';
const PROVIDERS = ['mangakakalot', 'mangasee123', 'manganato'];

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Target title required' });

        console.log(`[The Alliance V2] Searching network for: ${title}`);
        
        let searchRes = null;
        let activeProvider = '';

        // 1. Rapid-fire test every provider in the network
        for (const provider of PROVIDERS) {
            try {
                console.log(`[The Alliance V2] Pinging ${provider} node...`);
                const url = `${CONSUMET_URL}/${provider}/${encodeURIComponent(title)}`;
                const res = await axios.get(url, { timeout: 8000 }); // 8-second patience limit
                
                if (res.data && res.data.results && res.data.results.length > 0) {
                    searchRes = res.data;
                    activeProvider = provider;
                    console.log(`[The Alliance V2] Target found on ${provider}!`);
                    break; // Stop searching once we find it
                }
            } catch (e) {
                console.log(`[The Alliance V2] ${provider} is blind or unresponsive. Skipping.`);
            }
        }

        if (!searchRes) {
            console.log(`[The Alliance V2] Target missing from all tracked nodes.`);
            return res.json({ chapters: [], source: 'consumet-multi' });
        }

        const targetId = searchRes.results[0].id;
        console.log(`[The Alliance V2] Extracting chapter list from ${activeProvider}...`);

        // 2. Grab the chapters from the winning provider
        const infoUrl = `${CONSUMET_URL}/${activeProvider}/info?id=${targetId}`;
        const infoRes = await axios.get(infoUrl);
        
        if (!infoRes.data.chapters) {
            return res.json({ chapters: [], source: 'consumet-multi' });
        }

        // 3. Format chapters and embed the provider's name into the ID for later
        const chapters = infoRes.data.chapters.map(c => {
            // Secret Code format: "providerName::chapterId"
            const rawId = `${activeProvider}::${c.id}`;
            const safeId = Buffer.from(rawId).toString('base64');
            const chapNum = c.title.replace(/[^0-9.]/g, '') || c.id; 

            return {
                id: safeId, 
                attributes: { chapter: chapNum, title: c.title || '' }
            };
        });

        console.log(`[The Alliance V2] Success. Extracted ${chapters.length} chapters.`);
        res.json({ chapters: chapters, source: `consumet-${activeProvider}` });

    } catch (error) {
        console.error(`[The Alliance V2] Network Collapse:`, error.message);
        res.status(500).json({ error: 'Failed to contact Alliance network' });
    }
});

app.get('/api/scrape/images', async (req, res) => {
    try {
        const { chapterId } = req.query;
        if (!chapterId) return res.status(400).json({ error: 'Chapter ID required' });

        // 1. Decode the secret code to find out which provider has the images
        const decoded = Buffer.from(chapterId, 'base64').toString('ascii');
        const [provider, targetId] = decoded.split('::');
        
        if (!provider || !targetId) {
            return res.status(400).json({ error: 'Invalid Chapter ID signature' });
        }

        console.log(`[The Alliance V2] Ripping images from ${provider}...`);
        
        // 2. Ask the specific provider for the image links
        const readUrl = `${CONSUMET_URL}/${provider}/read?chapterId=${targetId}`;
        const readRes = await axios.get(readUrl);
        
        if (readRes.data && readRes.data.length > 0) {
            const images = readRes.data.map(page => page.img);
            return res.json({ images });
        }
        
        res.json({ images: [] });
    } catch (error) {
        console.error('[The Alliance V2] Image Rip Failed:', error.message);
        res.status(500).json({ error: 'Failed to extract images' });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        weapons: "The Alliance V2 (Multi-Node Router)",
        shields: "Raised"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
