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
const BOT_NUMBER = '967712538107'; // رقم البوت (بدون +)

let storeSettings = {
    isOpen: true,
    ucPrice: "لم يحدد بعد",
    news: "أهلاً بكم في متجر لوفي الذكي"
};

async function startLuffyBot() {
    // 1. إعداد حالة الاتصال وحفظ الجلسة
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"] // ضروري لتجنب مشاكل الربط
    });

    // 2. طلب كود الربط (Pairing Code) إذا لم يكن مسجلاً
    if (!sock.authState.creds.registered) {
        console.log('⏳ جاري طلب كود الربط للرقم: ' + BOT_NUMBER);
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(BOT_NUMBER);
                console.log('---------------------------------------');
                console.log('🔥 كود الربط الخاص بك هو:', code);
                console.log('---------------------------------------');
                console.log('💡 افتح واتساب > الأجهزة المرتبطة > ربط برقم هاتف > أدخل الكود أعلاه');
            } catch (error) {
                console.error('❌ فشل طلب الكود. تأكد من أن الرقم صحيح وغير مربوط بجهاز آخر:', error);
            }
        }, 10000); // تأخير 10 ثوانٍ لضمان جاهزية الاتصال
    }

    // 3. تحديث البيانات وحفظ الجلسة
    sock.ev.on('creds.update', saveCreds);

    // 4. مراقبة حالة الاتصال
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔄 تم إغلاق الاتصال، جاري إعادة المحاولة...', shouldReconnect);
            if (shouldReconnect) startLuffyBot();
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بنجاح! البوت جاهز الآن.');
        }
    });

    // 5. استقبال الرسائل ومعالجتها
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isAdmin = (remoteJid === ADMIN_NUMBER);

        // --- أوامر الإدارة ---
        if (isAdmin) {
            if (text.startsWith('تحديث السعر ')) {
                storeSettings.ucPrice = text.replace('تحديث السعر ', '');
                return await sock.sendMessage(remoteJid, { text: `✅ أبشر يا مدير! تم تحديث السعر إلى: ${storeSettings.ucPrice}` });
            }
            if (text === 'اغلاق المحل') {
                storeSettings.isOpen = false;
                return await sock.sendMessage(remoteJid, { text: '🔒 تم إغلاق استقبال الطلبات.' });
            }
            if (text === 'فتح المحل') {
                storeSettings.isOpen = true;
                return await sock.sendMessage(remoteJid, { text: '🔓 تم فتح المحل.' });
            }
        }

        // --- ردود الزبائن ---
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

// تشغيل البوت والتعامل مع أخطاء البداية
startLuffyBot().catch(err => console.error("حدث خطأ في التشغيل:", err));
                
