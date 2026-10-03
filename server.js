import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("تحذير: لم يتم العثور على GEMINI_API_KEY في ملف .env. يرجى إضافته ليعمل الخادم بنجاح.");
}

// تهيئة عميل Google Gen AI
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// إعدادات البرمجيات الوسيطة
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// خدمة الملفات الثابتة للواجهة الأمامية
app.use(express.static('public'));

// مسار فحص الحالة
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// مسار تحليل وتلخيص المستندات
app.post('/api/analyze', async (req, res) => {
  try {
    const { parts, model = 'gemini-3.8-flash' } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'محتوى المستند أو الأجزاء المرسلة غير صالحة.' });
    }

    const systemInstruction = "أنت محلل وثائق خبير. قم بمراجعة وتلخيص هذا المستند بشكل دقيق، منظم، ومقسم إلى نقاط رئيسية وخلاصة تنفيذية، باستخدام لغة عربية فصحى وتنسيق Markdown أنيق.";

    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2
      }
    });

    const responseText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ summary: responseText });
  } catch (error) {
    console.error('Analyze Error:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحليل المستند.' });
  }
});

// مسار الشات والمحادثة وتعديل الملخص
app.post('/api/chat', async (req, res) => {
  try {
    const { history, message, model = 'gemini-3.8-flash' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'الرسالة مطلوبة.' });
    }

    const conversationHistory = Array.isArray(history) ? [...history] : [];
    conversationHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const systemInstruction = "أنت مساعد تحليلي مرتبط بالمستند المرفوع والملخص الحالي. ساعد المستخدم في الإجابة بدقة أو تعديل صياغة الملخص. إذا طلب تعديل الملخص بشكل صريح أو إعادة كتابته، ابدأ ردك بـ [تحديث_الملخص] متبوعاً بالنص الجديد للملخص، ثم اكتب توضيحك للمستخدم.";

    const response = await ai.models.generateContent({
      model: model,
      contents: conversationHistory,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3
      }
    });

    const reply = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ reply });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء معالجة المحادثة.' });
  }
});

app.listen(PORT, () => {
  console.log(`خادم مُدارِك يعمل الآن بأمان على: http://localhost:${PORT}`);
});
