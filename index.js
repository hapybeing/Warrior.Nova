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
// THE ALLIANCE: CONSUMET NETWORK
// ==========================================

// We target Consumet's dedicated Manganato provider
const CONSUMET_BASE = 'https://api.consumet.org/manga/manganato';

app.get('/api/scrape/chapters', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) return res.status(400).json({ error: 'Target title required' });

        console.log(`[The Alliance] Contacting Consumet Node for: ${title}`);

        // 1. Ask Consumet to search their Manganato index
        const searchRes = await axios.get(`${CONSUMET_BASE}/${encodeURIComponent(title)}`);
        
        if (!searchRes.data.results || searchRes.data.results.length === 0) {
            console.log(`[The Alliance] Target not found on network.`);
            return res.json({ chapters: [], source: 'consumet-manganato' });
        }

        // Grab the exact ID of the first match
        const targetId = searchRes.data.results[0].id;
        console.log(`[The Alliance] Target acquired. ID: ${targetId}`);

        // 2. Ask Consumet for the chapter list of that exact ID
        const infoRes = await axios.get(`${CONSUMET_BASE}/info?id=${targetId}`);
        
        if (!infoRes.data.chapters) {
            return res.json({ chapters: [], source: 'consumet-manganato' });
        }

        // Format the chapters so your frontend can read them perfectly
        const chapters = infoRes.data.chapters.map(c => {
            // Consumet hands us a clean chapter ID, we just encode it for safety
            const safeId = Buffer.from(c.id).toString('base64');
            // Extract the chapter number from titles like "Chapter 200"
            const chapNum = c.title.replace(/[^0-9.]/g, '') || c.id; 

            return {
                id: safeId, 
                attributes: { chapter: chapNum, title: c.title || '' }
            };
        });

        console.log(`[The Alliance] Success. Extracted ${chapters.length} chapters.`);
        res.json({ chapters: chapters, source: 'consumet-manganato' });

    } catch (error) {
        const status = error.response ? error.response.status : error.message;
        console.error(`[The Alliance] Network Failure (Status: ${status})`);
        res.status(500).json({ error: 'Failed to contact Alliance network' });
    }
});

app.get('/api/scrape/images', async (req, res) => {
    try {
        const { chapterId } = req.query;
        if (!chapterId) return res.status(400).json({ error: 'Chapter ID required' });

        // Decode the ID we created earlier
        const targetId = Buffer.from(chapterId, 'base64').toString('ascii');
        
        console.log(`[The Alliance] Ripping images for chapter...`);
        const readRes = await axios.get(`${CONSUMET_BASE}/read?chapterId=${targetId}`);
        
        if (readRes.data && readRes.data.length > 0) {
            // Consumet returns an array of objects like { page: 1, img: "url" }
            const images = readRes.data.map(page => page.img);
            return res.json({ images });
        }
        
        res.json({ images: [] });
    } catch (error) {
        console.error('[The Alliance] Image Rip Failed:', error.message);
        res.status(500).json({ error: 'Failed to extract images' });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        weapons: "The Alliance (Consumet Network)",
        shields: "Raised"
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
