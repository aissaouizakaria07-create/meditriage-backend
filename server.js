require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Initialize SQLite DB (creates tables if they don't exist)
require('./models/db');

const authRoutes     = require('./routes/auth');
const chatRoutes     = require('./routes/chat');
const profileRoutes  = require('./routes/profile');
const reminderRoutes = require('./routes/reminders');
const moodRoutes     = require('./routes/mood');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'capacitor://localhost',
  'http://localhost',
  'https://dividing-lucrative-capacity.ngrok-free.dev',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
}));

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
}));

app.use('/api/chat', rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Limite de messages atteinte. Attendez une minute.' },
}));

app.use('/api/auth',      authRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/profile',   profileRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/mood',      moodRoutes);

// Add this BEFORE the catch-all route in server.js

app.get('/share/:shareId', async (req, res) => {
  try {
    const { db } = require('./models/db');
    const row = db.prepare(`
      SELECT c.*, u.name as user_name FROM conversations c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.share_id = ? AND c.share_enabled = 1
    `).get(req.params.shareId);

    if (!row) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:4rem;background:#0a1a10;color:#fff">
          <h2>❌ Lien invalide ou partage désactivé</h2>
          <a href="/" style="color:#00C896">Retour à MediAssist</a>
        </body></html>
      `);
    }

    const messages = JSON.parse(row.messages || '[]');
    const msgsHtml = messages.map(m => `
      <div style="margin:12px 0;display:flex;justify-content:${m.role==='user'?'flex-end':'flex-start'}">
        <div style="max-width:80%;padding:12px 16px;border-radius:18px;background:${m.role==='user'?'#00C896':'#1a2e20'};color:${m.role==='user'?'#0a1a10':'#e0ffe8'};font-size:13px;line-height:1.6;white-space:pre-wrap">
          ${m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}
          <div style="font-size:10px;opacity:.6;margin-top:4px;text-align:right">${m.time||''}</div>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>Consultation MediAssist — ${row.user_name||'Patient'}</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#0a1a10;color:#e0ffe8;font-family:'Segoe UI',sans-serif;min-height:100vh}
          .header{background:#0d2018;border-bottom:1px solid #1e3d2a;padding:16px 20px;display:flex;align-items:center;gap:12px}
          .logo{width:36px;height:36px;background:#00C896;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px}
          .chat{max-width:680px;margin:0 auto;padding:20px}
          .meta{background:#0d2018;border:1px solid #1e3d2a;border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:#7ec8a0}
          a{color:#00C896}
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">❤️</div>
          <div>
            <div style="font-weight:700;font-size:16px">MediAssist AI</div>
            <div style="font-size:11px;color:#7ec8a0">Consultation partagée</div>
          </div>
        </div>
        <div class="chat">
          <div class="meta">
            👤 Patient : <strong>${row.user_name||'Anonyme'}</strong> &nbsp;|&nbsp;
            📅 ${new Date(row.created_at).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'})} &nbsp;|&nbsp;
            💬 ${messages.length} messages
            <br/><br/>⚠️ Cette consultation est partagée à titre indicatif. Elle ne remplace pas un avis médical professionnel.
          </div>
          ${msgsHtml}
          <div style="text-align:center;margin-top:32px;font-size:12px;color:#7ec8a0">
            <a href="/">Créer votre consultation sur MediAssist AI →</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch(err) {
    console.error('[share page]', err);
    res.status(500).send('Erreur serveur');
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const htmlPath  = path.join(__dirname, 'public', 'mediassist_ai_fixed.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  if (fs.existsSync(htmlPath))  return res.sendFile(htmlPath);
  res.status(404).send('Frontend not found. Put your HTML file in the public/ folder.');
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: 'sqlite', time: new Date().toISOString() }));

app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`   → Base de données : SQLite (meditriage.db)`);
  console.log(`   → Health check    : http://localhost:${PORT}/api/health`);
});
