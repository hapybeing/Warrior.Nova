require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio'); 

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false })); // Crucial for image proxying

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

        const searchUrl = `${PILL_BASE}/search?q=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(searchUrl, { headers: stealthHeaders });
        const $search = cheerio.load(searchRes.data);

        // === THE SMART TITLE MATCHER ===
        // Break the search title into lowercase words, ignoring symbols
        const searchWords = title.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 2);
        
        let targetHref = null;

        $search('a[href^="/manga/"]').each((i, el) => {
            const href = $search(el).attr('href');
            const hrefLower = href.toLowerCase();
            
            if (searchWords.length === 0) return;

            // Check how many words from the title are actually in the manga's URL
            let matchCount = 0;
            searchWords.forEach(word => {
                if (hrefLower.includes(word)) {
                    matchCount++;
                }
            });

            // If we found a match and haven't locked onto a target yet
            // We also actively avoid the text "-novel" version unless necessary
            if (matchCount > 0 && !targetHref) {
                if (!hrefLower.includes('-novel')) {
                    targetHref = href;
                }
            }
        });

        // If the smart matcher found nothing, it means MangaPill doesn't have it under that exact name
        if (!targetHref) {
            console.log(`[Extractor] Target "${title}" not found on MangaPill database.`);
            return res.json({ chapters: [], source: 'mangapill' });
        }

        const mangaUrl = `${PILL_BASE}${targetHref}`;
        console.log(`[Extractor] Locked onto true target: ${mangaUrl}`);

        const mangaRes = await axios.get(mangaUrl, { headers: stealthHeaders });
        const $manga = cheerio.load(mangaRes.data);
        
        let chapters = [];
        $manga('a[href^="/chapters/"]').each((i, el) => {
            const chapUrl = $manga(el).attr('href');
            const chapText = $manga(el).text().trim().replace(/Chapter /i, '') || 'Oneshot';
            const safeId = Buffer.from(chapUrl).toString('base64');
            
            if (!chapters.find(c => c.id === safeId)) {
                chapters.push({ id: safeId, attributes: { chapter: chapText, title: '' } });
            }
        });

        chapters.reverse();
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

        const targetPath = Buffer.from(chapterId, 'base64').toString('ascii');
        const chapUrl = `${PILL_BASE}${targetPath}`;
        
        const chapRes = await axios.get(chapUrl, { headers: stealthHeaders });
        const $ = cheerio.load(chapRes.data);
        
        let images = [];
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

// ==========================================
// THE IMAGE SHIELD (HOTLINK BYPASS)
// ==========================================
app.get('/api/proxy/image', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send('URL required');

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 
                'Referer': 'https://mangapill.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error('[Proxy] Image Shield Failed:', error.message);
        res.status(500).send('Image Proxy Failed');
    }
});

app.get('/', (req, res) => {
    res.json({ status: "Warrior.Nova is online.", armor: "Active", shields: "Proxy Active" });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
