const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

function signAndSend(res, user) {
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('mt_token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
  return res.json({ success: true, token, user });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court.' });
    const existing = User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email deja utilise.' });
    const user = await User.create({ name: name || email.split('@')[0], email, password });
    return signAndSend(res, user);
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
    const user = User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    const valid = await User.comparePassword(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    delete user.password;
    return signAndSend(res, user);
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/guest', (req, res) => {
  const guestId = 'guest_' + Date.now();
  const token = jwt.sign({ id: guestId, isGuest: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.cookie('mt_token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 24*60*60*1000 });
  return res.json({ success: true, token, user: { id: guestId, name: 'Visiteur', email: '', isGuest: true } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('mt_token');
  return res.json({ success: true });
});

router.get('/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
