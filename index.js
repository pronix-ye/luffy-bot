const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');

// إعدادات البوت الأساسية
const ADMIN_NUMBER = '967775298782@s.whatsapp.net';
const MY_PHONE_NUMBER = '967775298782'; // الرقم الذي سيتم ربط البوت به

let storeSettings = {
    isOpen: true,
    ucPrice: "لم يحدد",
    news: "أهلاً بكم في متجر لوفي"
};

async function startLuffyBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // تعطيل الباركود
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- طريقة الربط عبر الكود النصي ---
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(MY_PHONE_NUMBER);
            console.log('---------------------------------------');
            console.log('🔥 كود الربط الخاص بك هو:', code);
            console.log('---------------------------------------');
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startLuffyBot();
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح! البوت جاهز الآن.');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isAdmin = (remoteJid === ADMIN_NUMBER);

        if (isAdmin) {
            if (text.startsWith('تحديث السعر ')) {
                storeSettings.ucPrice = text.replace('تحديث السعر ', '');
                await sock.sendMessage(remoteJid, { text: `✅ تم التحديث: ${storeSettings.ucPrice}` });
            }
            if (text === 'اغلاق المحل') {
                storeSettings.isOpen = false;
                await sock.sendMessage(remoteJid, { text: '🔒 مغلق' });
            }
            if (text === 'فتح المحل') {
                storeSettings.isOpen = true;
                await sock.sendMessage(remoteJid, { text: '🔓 مفتوح' });
            }
        }

        if (text === 'الاسعار' || text === 'أسعار') {
            if (!storeSettings.isOpen) {
                await sock.sendMessage(remoteJid, { text: "المحل مغلق حالياً." });
            } else {
                await sock.sendMessage(remoteJid, { text: `✨ متجر لوفي ✨\n💰 السعر: ${storeSettings.ucPrice}\n📢 الخبر: ${storeSettings.news}` });
            }
        }
    });
}

startLuffyBot();
                                
