/**
 * Telegram ➜ WhatsApp Bridge (Node.js)
 * -----------------------------------
 * - Receives text/images from Python bot via HTTP
 * - Routes dynamically to different WhatsApp Groups
 */
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Added MessageMedia here
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const express = require('express');

const PORT = 3000;
const app = express();

// 🚨 CRITICAL: Increased limits to handle large Base64 images
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// WhatsApp state flag
let isClientReady = false;
dns.setDefaultResultOrder('ipv4first');

// 1️⃣ SETUP WHATSAPP CLIENT
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



// Helper Function: Find chat dynamically by name
async function getTargetGroup(groupName) {
    const chats = await client.getChats();
    return chats.find(chat => chat.isGroup && chat.name.toLowerCase() === groupName.toLowerCase());
}

// 5️⃣ API ENDPOINT (CALLED BY PYTHON)
app.post('/send-message', async (req, res) => {
    if (!isClientReady) {
        return res.status(503).json({ status: 'error', reason: 'WhatsApp client not ready' });
    }

    // Extract message, media (base64 string), and the target group name
    const { message, media, group_id } = req.body;

    if (!group_id) {
        return res.status(400).json({ status: 'error', reason: 'No group_id provided' });
    }

    if (!message && !media) {
        return res.status(400).json({ status: 'error', reason: 'No message or media provided' });
    }

    try {
        // Find the specific group requested by Python
        const targetChat = await getTargetGroup(group_id);

        if (!targetChat) {
            console.error(`❌ Group "${group_id}" NOT FOUND`);
            return res.status(404).json({ status: 'error', reason: `Group '${group_id}' not found in WhatsApp` });
        }

        console.log(`\n📥 Forwarding to: "${targetChat.name}"`);

        // Handle Image vs Text Sending
        if (media) {
            const mediaObj = new MessageMedia('image/jpeg', media);
            await targetChat.sendMessage(mediaObj, { caption: message + "\n Dm on wa.me/7719401702\n Queries may not be replied on any other number" });
            console.log('🚀 Image + Caption forwarded successfully!\n');
        } else {
            await targetChat.sendMessage(message);
            console.log('🚀 Text forwarded successfully!\n');
        }

        res.json({ status: 'success' });
    } catch (err) {
        console.error('❌ WhatsApp send error:', err);
        res.status(500).json({ status: 'error', reason: err.message });
    }
});

// 6️⃣ START SERVER
app.listen(PORT, () => {
    console.log(`🌐 Node server running at http://localhost:${PORT}`);
    console.log('📡 Waiting for Python bot messages...\n');
});

    // --- CRASH PREVENTION SAFETY NET ---
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION (Server kept running):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION (Server kept running):', reason);
}); 