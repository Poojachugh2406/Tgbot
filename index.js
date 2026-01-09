/**
 * Telegram ➜ WhatsApp Bridge (Node.js)
 * -----------------------------------
 * - Receives messages from Python bot via HTTP
 * - Sends them to a WhatsApp Group using whatsapp-web.js
 */
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const express = require('express');

// ---------------- CONFIG ---------------- //
const WHATSAPP_GROUP_NAME = 'Lightning Offers'; // MUST MATCH EXACTLY
const PORT = 3000;
// ---------------------------------------- //

const app = express();
app.use(express.json()); // modern body parser

// WhatsApp state flags
let isClientReady = false;
let cachedGroup = null;

// 1️⃣ SETUP WHATSAPP CLIENTconst dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
// 
// const { Client, LocalAuth } = require('whatsapp-web.js');

process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
process.env.PUPPETEER_NAVIGATION_TIMEOUT = '13000000';

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "tg-wa-bridge"
    }),
    puppeteer: {
        headless: false,              // MUST be false
        slowMo: 50,                   // 👈 CRITICAL
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=site-per-process',
            '--disable-features=IsolateOrigins',
            '--window-size=1280,800'
        ]
    }
});


// 2️⃣ QR CODE HANDLING
client.on('qr', qr => {
    QRCode.toFile('./qr.png', qr, err => {
        if (err) {
            console.error('❌ QR save error:', err);
        } else {
            console.log('\n=================================================');
            console.log('📱 QR GENERATED');
            console.log('👉 Open "qr.png" and scan with WhatsApp');
            console.log('=================================================\n');
        }
    });
});
client.on('ready', async () => {
    console.log('\n✅ WhatsApp Client READY (basic)');
    isClientReady = true;

    // ⏳ Give WhatsApp Web time to sync chats
    console.log('⏳ Waiting for WhatsApp chat sync...');
    await new Promise(res => setTimeout(res, 300000)); // 30 seconds

    let chats;
    try {
        chats = await client.getChats();
    } catch (err) {
        console.error('❌ Failed to fetch chats:', err.message);
        return;
    }

    console.log('\n📋 WhatsApp Groups Found:');
    chats
        .filter(chat => chat.isGroup)
        .forEach(chat => console.log(`- ${chat.name}`));

    cachedGroup = chats.find(
        chat => chat.isGroup && chat.name.trim() === WHATSAPP_GROUP_NAME.trim()
    );

    if (!cachedGroup) {
        console.error(`❌ Group "${WHATSAPP_GROUP_NAME}" NOT FOUND`);
        console.error('👉 Make sure this WhatsApp account is inside the group');
    } else {
        console.log(`✅ Messages will be sent to: "${cachedGroup.name}"`);
    }
});

// 4️⃣ START WHATSAPP
console.log('⏳ Starting WhatsApp client...');
client.initialize();

// 5️⃣ API ENDPOINT (CALLED BY PYTHON)
app.post('/send-message', async (req, res) => {
    if (!isClientReady) {
        return res.status(503).json({
            status: 'error',
            reason: 'WhatsApp client not ready'
        });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({
            status: 'error',
            reason: 'Invalid or empty message'
        });
    }

    console.log(`📥 Received from Python:\n${message}\n`);

    try {
        if (!cachedGroup) {
            return res.status(404).json({
                status: 'error',
                reason: 'WhatsApp group not found'
            });
        }

        await cachedGroup.sendMessage(message);

        console.log('🚀 Message forwarded to WhatsApp\n');

        res.json({ status: 'success' });
    } catch (err) {
        console.error('❌ WhatsApp send error:', err);
        res.status(500).json({
            status: 'error',
            reason: err.message
        });
    }
});

// 6️⃣ START SERVER
app.listen(PORT, () => {
    console.log(`🌐 Node server running at http://localhost:${PORT}`);
    console.log('📡 Waiting for Python bot messages...\n');
});
