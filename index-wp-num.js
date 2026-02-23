const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode-terminal'); // Shows QR in terminal for ease
const fs = require('fs');

// ---------------- CONFIG ---------------- //
const MESSAGE = "Hello! This is a personalized message from our service.";
const DELAY_MS = 5000; // 5 seconds delay between messages to avoid bans
// ---------------------------------------- //
const client = new Client({
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Use with caution, but helps with permissions
        ],
    }
});

// Display QR in Terminal
client.on('qr', (qr) => {
    console.log('Scan this QR code with WhatsApp:');
    QRCode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client is ready!');

    // Read numbers from text file
    let numbers;
    try {
        const data = fs.readFileSync('numbers.txt', 'utf-8');
        numbers = data.split(/\r?\n/).filter(line => line.trim() !== "");
    } catch (err) {
        console.error("❌ Could not read numbers.txt:", err.message);
        return;
    }

    console.log(`📂 Found ${numbers.length} numbers. Starting broadcast...`);

    for (let i = 0; i < numbers.length; i++) {
        const rawNumber = numbers[i].trim();
        const chatId = `${rawNumber}@c.us`;

        try {
            // Optional: Check if number exists on WhatsApp first
            const isRegistered = await client.isRegisteredUser(chatId);
            
            if (isRegistered) {
                await client.sendMessage(chatId, MESSAGE);
                console.log(`[${i + 1}/${numbers.length}] ✅ Sent to: ${rawNumber}`);
            } else {
                console.log(`[${i + 1}/${numbers.length}] ❌ Skipped: ${rawNumber} (Not on WhatsApp)`);
            }
        } catch (error) {
            console.error(`[${i + 1}/${numbers.length}] 🛑 Error sending to ${rawNumber}:`, error.message);
        }

        // Wait before sending the next one
        if (i < numbers.length - 1) {
            console.log(`⏳ Waiting ${DELAY_MS / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log('\n✨ All messages processed!');
});

client.initialize();