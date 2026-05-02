const { db, newId } = require('./db');

const Mood = {
  find({ userId }, { limit = 90 } = {}) {
    return db.prepare('SELECT * FROM moods WHERE user_id = ? ORDER BY date DESC LIMIT ?')
      .all(userId, limit)
      .map(Mood._format);
  },

  create({ userId, emoji, label, score, note }) {
    const id = newId();
    db.prepare(`
      INSERT INTO moods (id, user_id, emoji, label, score, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, emoji, label, score, note || '');
    const row = db.prepare('SELECT * FROM moods WHERE id = ?').get(id);
    return Mood._format(row);
  },

  _format(row) {
    return {
      _id: row.id,
      userId: row.user_id,
      emoji: row.emoji,
      label: row.label,
      score: row.score,
      note: row.note,
      date: row.date,
    };
  },
};

module.exports = Mood;
