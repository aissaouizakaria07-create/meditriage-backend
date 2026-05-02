const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function authMiddleware(req, res, next) {
  try {
    let token = req.cookies?.mt_token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Guest token — no DB lookup needed
    if (decoded.isGuest) {
      req.user = { id: decoded.id, _id: decoded.id, name: 'Visiteur', email: '', isGuest: true };
      return next();
    }

    const user = User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
};
