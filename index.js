const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const http = require('http');

// --- سيرفر وهمي لمنع توقف الخدمة ---
http.createServer((req, res) => {
  res.write('Luffy Bot is Running!');
  res.end();
}).listen(process.env.PORT || 8000);

// --- الإعدادات ---
const ADMIN_NUMBER = '967775298782@s.whatsapp.net'; 
const BOT_NUMBER = '967712538107'; 

let storeSettings = {
    isOpen: true,
    ucPrice: "لم يحدد بعد",
    news: "أهلاً بكم في متجر لوفي الذكي"
};

async function startLuffyBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"] 
    });

    if (!sock.authState.creds.registered) {
        console.log('⏳ جاري طلب كود الربط للرقم: ' + BOT_NUMBER);
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(BOT_NUMBER);
                console.log('---------------------------------------');
                console.log(`🔥 كود الربط الخاص بك هو: "${code}"`);
                console.log('---------------------------------------');
            } catch (error) {
                console.error('❌ فشل طلب الكود:', error);
            }
        }, 10000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startLuffyBot();
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isAdmin = (remoteJid === ADMIN_NUMBER);

        if (isAdmin) {
            if (text.startsWith('تحديث السعر ')) {
                storeSettings.ucPrice = text.replace('تحديث السعر ', '');
                return await sock.sendMessage(remoteJid, { text: `✅ تم تحديث السعر إلى: ${storeSettings.ucPrice}` });
            }
        }

        if (text === 'الاسعار' || text === 'أسعار') {
            const response = `✨ *أسعار شحن UC* ✨\n\n💰 السعر: ${storeSettings.ucPrice}\n📢 خبر: ${storeSettings.news}`;
            await sock.sendMessage(remoteJid, { text: response });
        }
    });
}

startLuffyBot();
                                                                                          
