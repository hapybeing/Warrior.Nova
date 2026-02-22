require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// THE AEGIS PROTOCOL: SECURITY SYSTEM
// ==========================================

// 1. THE ARMOR: Scrambles headers and blocks malicious injection attacks
app.use(helmet());

// 2. THE BOUNCER: Only allows your specific Vercel website to talk to it
const allowedOrigins = [
    'https://nova-iota-gules.vercel.app' // Your frontend
];

app.use(cors({
    origin: function (origin, callback) {
        // If there is no origin (like a server ping), or the origin is Nova, let it in
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // If anyone else tries to connect, drop the connection
            callback(new Error('Blocked by Aegis: Unauthorized Origin'));
        }
    }
}));

// 3. THE SHIELD WALL: Prevents DDoS attacks by limiting pings
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150, // Limit each IP to 150 requests per window
    message: { error: 'Shield Wall activated: Stop spamming the server.' }
});
app.use(limiter);

// Middleware to parse incoming JSON data
app.use(express.json());

// ==========================================
// CORE ROUTES
// ==========================================

// The Health Check: A simple ping to see if the Warrior is alive
app.get('/', (req, res) => {
    res.json({
        status: "Warrior.Nova is online.",
        armor: "Active",
        shields: "Raised"
    });
});

// Wake up the server
app.listen(PORT, () => {
    console.log(`Warrior.Nova standing guard on port ${PORT}`);
});
