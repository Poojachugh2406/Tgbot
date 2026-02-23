const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('--- Starting Script ---');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false, 
        // Force the browser to wait and stay open
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-shm-usage',
        ],
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('SUCCESS: Client is ready!');
});

// IMPORTANT: Catch errors during the launch phase
client.initialize().catch(err => {
    console.error('FATAL ERROR DURING INITIALIZATION:', err);
});

console.log('Requesting browser launch...');