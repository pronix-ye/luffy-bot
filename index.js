const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeInMemoryStore 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');

// رقمك كمسؤول (تم ضبطه بناءً على طلبك)
const ADMIN_NUMBER = '967775298782@s.whatsapp.net';

// ذاكرة مؤقتة للبيانات (تتحدث عبر رسائلك)
let storeSettings = {
    isOpen: true,
    ucPrice: "لم يتم تحديد السعر بعد",
    news: "أهلاً بكم في متجر لوفي الذكي"
};

async function startLuffyBot() {
    // حفظ الجلسة في مجلد 'auth_info' لكي لا يطلب الباركود كل مرة
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // سيعرض الباركود في Logs السيرفر أو الترمكس
        browser: ["Luffy Store", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('تم فصل الاتصال، جاري إعادة المحاولة...', shouldReconnect);
            if (shouldReconnect) startLuffyBot();
        } else if (connection === 'open') {
            console.log('✅ البوت متصل الآن وجاهز لاستقبال الطلبات!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isAdmin = (remoteJid === ADMIN_NUMBER);

        // --- قسم أوامر الأدمن (أنت فقط من يتحكم) ---
        if (isAdmin) {
            if (text.startsWith('تحديث السعر ')) {
                storeSettings.ucPrice = text.replace('تحديث السعر ', '');
                return await sock.sendMessage(remoteJid, { text: `✅ أبشر يا مدير! تم تحديث السعر إلى: ${storeSettings.ucPrice}` });
            }

            if (text === 'اغلاق المحل') {
                storeSettings.isOpen = false;
                return await sock.sendMessage(remoteJid, { text: '🔒 تم إغلاق استقبال الطلبات بنجاح.' });
            }

            if (text === 'فتح المحل') {
                storeSettings.isOpen = true;
                return await sock.sendMessage(remoteJid, { text: '🔓 تم فتح المحل، الزبائن يمكنهم رؤية الأسعار الآن.' });
            }

            if (text.startsWith('تحديث الخبر ')) {
                storeSettings.news = text.replace('تحديث الخبر ', '');
                return await sock.sendMessage(remoteJid, { text: '📢 تم تحديث شريط الأخبار للزبائن.' });
            }
        }

        // --- قسم ردود الزبائن ---
        if (text === 'الاسعار' || text === 'أسعار') {
            if (!storeSettings.isOpen) {
                await sock.sendMessage(remoteJid, { text: "عذراً منك، المتجر مغلق حالياً. يرجى التواصل معنا لاحقاً. 🏪" });
            } else {
                const response = `✨ *متجر لوفي الذكي (Luffy Store)* ✨\n\n` +
                                 `💰 *سعر الشحن الحالي:* ${storeSettings.ucPrice}\n` +
                                 `📢 *أحدث العروض:* ${storeSettings.news}\n\n` +
                                 `لطلب الشحن، أجب برقم الطلب أو تواصل مع الإدارة مباشرة.`;
                await sock.sendMessage(remoteJid, { text: response });
            }
        }
    });
}

startLuffyBot();
                                                   
