const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  if (req.user?.isGuest) return res.json([]);
  return res.json(Reminder.find({ userId: req.user.id }));
});

router.post('/', authMiddleware, (req, res) => {
  if (req.user?.isGuest) return res.status(403).json({ error: 'Créez un compte pour sauvegarder.' });
  const { medName, dosage, time, frequency } = req.body;
  if (!medName || !time) return res.status(400).json({ error: 'medName et time requis.' });
  const reminder = Reminder.create({ userId: req.user.id, medName, dosage, time, frequency });
  return res.status(201).json(reminder);
});

router.patch('/:id/toggle', authMiddleware, (req, res) => {
  const reminder = Reminder.toggle(req.params.id, req.user.id);
  if (!reminder) return res.status(404).json({ error: 'Rappel introuvable.' });
  return res.json(reminder);
});

router.delete('/:id', authMiddleware, (req, res) => {
  Reminder.delete(req.params.id, req.user.id);
  return res.json({ ok: true });
});

module.exports = router;
