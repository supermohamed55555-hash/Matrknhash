const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fetch = require('node-fetch'); // Ensure node-fetch is used if on older node, else native fetch

router.post('/check-fitment', async (req, res) => {
    try {
        const { productId, userText } = req.body;
        let product = null;
        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
            product = await Product.findById(productId);
        }

        const compatibilityData = product && product.compatibility && product.compatibility.length > 0
            ? product.compatibility.map(c => `- ${c.brand} ${c.model} | ${c.yearStart} – ${c.yearEnd}`).join('\n')
            : "لا توجد بيانات توافق محددة لهذه القطعة.";

        const aiPrompt = `
أنت "المهندس عبود"، خبير فني مخضرم في ميكانيكا وصيانة السيارات بموقع "متركنهاش". 
صديق للعملاء، تقني، ومباشر، وبتتكلم بلهجة مصرية عامية "صنايعية شاطرة".

بيانات القطعة الحالية: ${product ? product.name : "غير محددة"}
بيانات التوافق: ${compatibilityData}

سؤال العميل:
"${userText}"

مهامك:
1. لو السؤال عن توافق القطعة المذكورة: افحص التوافق بناءً على البيانات المتوفرة.
2. لو السؤال عام في العربيات وبرا نطاق القطعة: جاوب كخبير مخضرم.
3. لو السؤال برا العربييات خالص: اعتذر بلطافة وقوله إن تخصصك في العربيات بس.

قواعد الإجابة:
- في التوافق: ابدأ بـ "مبروك يا بطل" لو بتركب، أو "للأسف ماتركبش" لو مش بتركب، واشرح السبب التقني بالتفصيل.
- في الأسئلة العامة: جاوب كخبير تقني حقيقي. لو المشكلة معقدة، قسم إجابتك لخطوات تشخيص (Diagnostic steps) وحلول محتملة.
- متخليش سؤال يعجزك؛ لو المعلومة مش كاملة، اطلب تفاصيل إضافية (زي نوع الموتور أو ظروف المشكلة) واقترح احتمالات بناءً على خبرتك.
- خلي ردك وافي وشامل، وماتقيدش نفسك بطول معين طالما الكلام تقني ومفيد.
- حافظ على اللهجة المصرية العامية "الشاطرة" والروح الودودة.
        `;

        const groqKey = process.env.GROQ_API_KEY;

        if (groqKey && !groqKey.startsWith('YOUR_')) {
            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messages: [
                            { role: 'system', content: 'أنت "المهندس عبود"، خبير فني مخضرم في ميكانيكا وصيانة السيارات بموقع "متركنهاش".' },
                            { role: 'user', content: aiPrompt }
                        ],
                        model: 'llama-3.3-70b-versatile',
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const aiResponse = data.choices[0].message.content.trim();
                    let status = 'warning';
                    const resp = aiResponse.toLowerCase();
                    if (resp.includes('مبروك') || resp.includes('مناسبة') || resp.includes('تنفع') || resp.includes('تركب')) status = 'success';
                    if (resp.includes('للأسف') || resp.includes('ما تتركبش') || resp.includes('غير مناسبة') || resp.includes('ماتركبش')) status = 'error';
                    return res.json({ status, reason: aiResponse });
                }
            } catch (err) {
                logger.error('GROQ AI Error:', err);
            }
        }

        // Fallback or No Key
        res.json({ status: 'warning', reason: 'المهندس عبود مشغول دلوقتي، جرب كمان شوية أو تأكد من بيانات التوافق المكتوبة.' });

    } catch (err) {
        logger.error('Fitment Error:', err);
        res.status(500).json({ error: 'Internal Error' });
    }
});

module.exports = router;
