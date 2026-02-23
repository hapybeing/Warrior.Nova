require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Completely bypasses CORS restrictions
app.use(cors({ origin: '*' })); 
app.use(express.json());

const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

// ROUTE 1: ALIAS SEARCH
app.get('/api/comick/search', async (req, res) => {
    try {
        const { q } = req.query;
        const r = await axios.get(`https://api.comick.io/v1.0/search?q=${encodeURIComponent(q)}&limit=1`, { headers });
        res.json(r.data);
    } catch (e) { res.status(500).json({ error: 'Search Bridge Failed' }); }
});

// ROUTE 2: CHAPTER LIST
app.get('/api/comick/chapters', async (req, res) => {
    try {
        const { hid } = req.query;
        const r = await axios.get(`https://api.comick.io/comic/${hid}/chapters?lang=en&limit=500`, { headers });
        res.json(r.data);
    } catch (e) { res.status(500).json({ error: 'Chapter Bridge Failed' }); }
});

// ROUTE 3: HIGH-RES IMAGES
app.get('/api/comick/images', async (req, res) => {
    try {
        const { hid } = req.query;
        const r = await axios.get(`https://api.comick.io/chapter/${hid}`, { headers });
        res.json(r.data);
    } catch (e) { res.status(500).json({ error: 'Image Bridge Failed' }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`ComicK API Bridge Online`));
