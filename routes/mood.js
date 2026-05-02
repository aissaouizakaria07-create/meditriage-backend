const express = require('express');
const router = express.Router();
const Mood = require('../models/Mood');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  if (req.user?.isGuest) return res.json([]);
  return res.json(Mood.find({ userId: req.user.id }));
});

router.post('/', authMiddleware, (req, res) => {
  if (req.user?.isGuest) return res.status(403).json({ error: 'Créez un compte pour sauvegarder.' });
  const { emoji, label, score, note } = req.body;
  if (!emoji || score == null) return res.status(400).json({ error: 'emoji et score requis.' });
  const entry = Mood.create({ userId: req.user.id, emoji, label, score, note });
  return res.status(201).json(entry);
});

module.exports = router;
