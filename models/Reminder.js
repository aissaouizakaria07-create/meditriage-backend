const { db, newId } = require('./db');

const Reminder = {
  find({ userId }) {
    return db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY created_at DESC').all(userId)
      .map(Reminder._format);
  },

  create({ userId, medName, dosage, time, frequency }) {
    const id = newId();
    db.prepare(`
      INSERT INTO reminders (id, user_id, med_name, dosage, time, frequency)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, medName, dosage || '', time, frequency || 'daily');
    return Reminder._findById(id);
  },

  toggle(id, userId) {
    const row = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) return null;
    const newVal = row.active ? 0 : 1;
    db.prepare('UPDATE reminders SET active = ? WHERE id = ?').run(newVal, id);
    return Reminder._findById(id);
  },

  delete(id, userId) {
    db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(id, userId);
  },

  _findById(id) {
    const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    return row ? Reminder._format(row) : null;
  },

  _format(row) {
    return {
      _id: row.id,
      userId: row.user_id,
      medName: row.med_name,
      dosage: row.dosage,
      time: row.time,
      frequency: row.frequency,
      active: !!row.active,
      createdAt: row.created_at,
    };
  },
};

module.exports = Reminder;
