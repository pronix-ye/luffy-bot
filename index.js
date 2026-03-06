const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');

// --- الإعدادات ---
const ADMIN_NUMBER = '967775298782@s.whatsapp.net'; // رقمك الشخصي (الأدمن)
const BOT_NUMBER = '967712538107'; // الرقم الذي سيتم ربط البوت به (رقم البوت)

let storeSettings = {
    isOpen: true,
    ucPrice: "لم يحدد بعد",
    news: "أهلاً بكم في متجر لوفي الذكي"
};

async function startLuffyBot() {
    // حفظ الجلسة في مجلد auth_info
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // سنستخدم الكود النصي بدلاً من الباركود
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- طلب كود الربط (Pairing Code) ---
    if (!sock.authState.creds.registered) {
        console.log('⏳ جاري طلب كود الربط للرقم: ' + BOT_NUMBER);
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(BOT_NUMBER);
                console.log('---------------------------------------');
                console.log('🔥 كود الربط الخاص بك هو:', code);
                console.log('---------------------------------------');
                console.log('💡 افتح الواتساب (رقم 712538107) > الأجهزة المرتبطة > ربط برقم هاتف');
            } catch (error) {
                console.log('❌ فشل طلب الكود، تأكد أن الرقم صحيح وليس عليه قيود:', error);
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
            console.log('✅ تم الاتصال بنجاح! البوت (712538107) جاهز للعمل.');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        
        // التحقق هل المرسل هو أنت (الأدمن)
        const isAdmin = (remoteJid === ADMIN_NUMBER);

        // --- أوامر الإدارة (من رقمك الشخصي 775298782 فقط) ---
        if (isAdmin) {
            if (text.startsWith('تحديث السعر ')) {
                storeSettings.ucPrice = text.replace('تحديث السعر ', '');
                return await sock.sendMessage(remoteJid, { text: `✅ أبشر يا مدير! تم تحديث سعر الـ UC إلى: ${storeSettings.ucPrice}` });
            }
            if (text === 'اغلاق المحل') {
                storeSettings.isOpen = false;
                return await sock.sendMessage(remoteJid, { text: '🔒 تم إغلاق استقبال الطلبات.' });
            }
            if (text === 'فتح المحل') {
                storeSettings.isOpen = true;
                return await sock.sendMessage(remoteJid, { text: '🔓 تم فتح المحل لاستقبال الزبائن.' });
            }
            if (text.startsWith('تحديث الخبر ')) {
                storeSettings.news = text.replace('تحديث الخبر ', '');
                return await sock.sendMessage(remoteJid, { text: '📢 تم تحديث الإعلان للزيائن.' });
            }
        }

        // --- ردود الزبائن (لأي شخص يراسل رقم البوت) ---
        if (text === 'الاسعار' || text === 'أسعار') {
            if (!storeSettings.isOpen) {
                await sock.sendMessage(remoteJid, { text: "عذراً، المتجر مغلق حالياً. نعود للعمل قريباً! 🏪" });
            } else {
                const response = `✨ *أسعار شحن UC ببجي* ✨\n\n💰 السعر الحالي: ${storeSettings.ucPrice}\n📢 الخبر: ${storeSettings.news}\n\nللطلب يرجى التواصل مع الإدارة.`;
                await sock.sendMessage(remoteJid, { text: response });
            }
        }
    });
}

// تشغيل البوت
startLuffyBot();
