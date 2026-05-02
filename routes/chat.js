const express = require('express');
const router  = express.Router();
const fetch   = require('node-fetch');
const authMiddleware = require('../middleware/auth');
const Conversation   = require('../models/Conversation');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: call Groq API (text chat)
// Docs: https://console.groq.com/docs/openai
// ─────────────────────────────────────────────────────────────────────────────
async function callGroq(messages, systemPrompt) {
  const body = {
    model: 'llama-3.1-8b-instant',
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages.map((m) => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: typeof m.content === 'string' ? m.content : m.content?.[0]?.text || '',
      })),
    ],
    max_tokens: 600,
    temperature: 0.7,
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: call Groq vision API (image analysis)
// Model: meta-llama/llama-4-scout-17b-16e-instruct (supports vision on Groq)
// ─────────────────────────────────────────────────────────────────────────────
async function callGroqVision(base64, mediaType, prompt) {
  const body = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: 'text', text: prompt },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0.7,
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq Vision error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: persist a pair of messages to the DB (skips guests)
// Works with the SQLite-backed Conversation model
// ─────────────────────────────────────────────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function persistMessages(userId, chatId, userText, aiText, extra = {}) {
  try {
    Conversation.upsert({ chatId, userId }, {
      set: { lang: extra.lang },
      push: {
        messages: [
          { role: 'user', text: userText, time: now() },
          { role: 'ai',   text: aiText,   time: now() },
        ],
      },
    });
  } catch (e) {
    console.warn('[chat] DB persist warning:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat  — main text chat
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { messages, system, lang = 'fr', chatId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages[] requis.' });
    }

    const reply = await callGroq(messages, system);

    if (!req.user?.isGuest && chatId) {
      const userText = messages[messages.length - 1]?.content || '';
      persistMessages(req.user.id, chatId, userText, reply, { lang });
    }

    return res.json({ reply });
  } catch (err) {
    console.error('[chat]', err.message);
    return res.status(500).json({ error: "Erreur lors de la communication avec l'IA." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/image  — medical image analysis via Groq vision
// ─────────────────────────────────────────────────────────────────────────────
router.post('/image', authMiddleware, async (req, res) => {
  try {
    const { base64, mediaType = 'image/jpeg', lang = 'fr', chatId } = req.body;

    if (!base64) {
      return res.status(400).json({ error: 'base64 image requis.' });
    }

    const prompt =
      lang === 'en'
        ? 'You are a medical assistant. Analyze this medical image carefully and provide: 1) What you observe in the image, 2) Possible conditions it may indicate, 3) Recommended next steps or when to see a doctor. Always remind the user to consult a healthcare professional for a proper diagnosis.'
        : lang === 'ar'
        ? 'أنت مساعد طبي. قم بتحليل هذه الصورة الطبية بعناية وقدم: 1) ما تلاحظه في الصورة، 2) الحالات المحتملة التي قد تشير إليها، 3) الخطوات الموصى بها أو متى تزور الطبيب. تذكر دائماً المستخدم باستشارة متخصص رعاية صحية للحصول على تشخيص صحيح.'
        : 'Tu es un assistant médical. Analyse cette image médicale attentivement et fournis: 1) Ce que tu observes dans l\'image, 2) Les conditions possibles qu\'elle pourrait indiquer, 3) Les prochaines étapes recommandées ou quand consulter un médecin. Rappelle toujours à l\'utilisateur de consulter un professionnel de santé pour un diagnostic correct.';

    const reply = await callGroqVision(base64, mediaType, prompt);

    if (!req.user?.isGuest && chatId) {
      persistMessages(req.user.id, chatId, '📷 Image médicale partagée', reply);
    }

    return res.json({ reply });
  } catch (err) {
    console.error('[chat/image]', err.message);
    return res.status(500).json({ error: "Erreur d'analyse de l'image." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/share  — toggle share link for a conversation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/share', authMiddleware, async (req, res) => {
  try {
    if (req.user?.isGuest) {
      return res.status(403).json({ error: 'Créez un compte pour partager.' });
    }

    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ error: 'chatId requis.' });

    const conv = Conversation.findOne({ chatId, userId: req.user.id });
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });

    const updated = Conversation.toggleShare(chatId, req.user.id);
    const shareUrl = updated.shareEnabled
      ? `${process.env.APP_URL || 'http://localhost:5000'}/api/chat/share/${updated.shareId}`
      : null;

    return res.json({ shareEnabled: updated.shareEnabled, shareUrl, shareId: updated.shareId });
  } catch (err) {
    console.error('[chat/share]', err.message);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/share/:shareId  — public read of a shared conversation
// ─────────────────────────────────────────────────────────────────────────────
router.get('/share/:shareId', (req, res) => {
  try {
    const conv = Conversation.findOne({ shareId: req.params.shareId, shareEnabled: true });
    if (!conv) {
      return res.status(404).json({ error: 'Lien invalide ou partage désactivé.' });
    }
    return res.json({
      chatId:      conv.chatId,
      createdAt:   conv.createdAt,
      messages:    conv.messages,
      patientName: conv.userId?.name || 'Anonyme',
    });
  } catch (err) {
    console.error('[chat/share/:id]', err.message);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/history  — list user's past conversations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', authMiddleware, (req, res) => {
  try {
    if (req.user?.isGuest) return res.json([]);
    const convs = Conversation.find({ userId: req.user.id });
    return res.json(convs);
  } catch (err) {
    console.error('[chat/history]', err.message);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/history  — save/update metadata for a conversation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/history', authMiddleware, (req, res) => {
  try {
    if (req.user?.isGuest) return res.json({ ok: true });
    const { chatId, symptoms, conditions, lang } = req.body;
    Conversation.upsert({ chatId, userId: req.user.id }, { set: { symptoms, conditions, lang } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[chat/history POST]', err.message);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
