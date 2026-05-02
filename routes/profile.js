const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  if (req.user?.isGuest) return res.json({ profile: {} });
  const user = User.findById(req.user.id);
  return res.json({ profile: user?.profile || {} });
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    if (req.user?.isGuest) return res.json({ ok: true });
    const { name, age, sex, bloodType, allergies, conditions } = req.body;
    const updated = await User.updateProfile(req.user.id, { name, age, sex, bloodType, allergies, conditions });
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[profile PUT]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
