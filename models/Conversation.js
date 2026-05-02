const { db, newId } = require('./db');
const { v4: uuidv4 } = require('uuid');

const Conversation = {
  findOne({ chatId, userId, shareId, shareEnabled }) {
    let row;
    if (shareId !== undefined) {
      row = db.prepare(`
        SELECT c.*, u.name as user_name FROM conversations c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.share_id = ? AND c.share_enabled = 1
      `).get(shareId);
    } else {
      row = db.prepare(`
        SELECT * FROM conversations WHERE chat_id = ? AND user_id = ?
      `).get(chatId, userId);
    }
    return row ? Conversation._format(row) : null;
  },

  find({ userId }, { limit = 50 } = {}) {
    const rows = db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?').all(userId, limit);
    return rows.map(Conversation._format);
  },

  // Upsert — insert or update conversation, optionally push messages
  upsert({ chatId, userId }, { set = {}, push = {} } = {}) {
    let row = db.prepare(`
      SELECT * FROM conversations WHERE chat_id = ? AND user_id = ?
    `).get(chatId, userId);

    if (!row) {
      // Create new
      const id = newId();
      const shareId = uuidv4();
      db.prepare(`
        INSERT INTO conversations (id, user_id, chat_id, share_id, lang, symptoms, conditions, messages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, userId, chatId, shareId,
        set.lang || 'fr',
        set.symptoms || '',
        JSON.stringify(set.conditions || []),
        JSON.stringify([])
      );
      row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    }

    // Apply $set fields
    if (Object.keys(set).length) {
      const updates = [];
      const vals = [];
      if (set.lang)       { updates.push('lang = ?');       vals.push(set.lang); }
      if (set.symptoms !== undefined) { updates.push('symptoms = ?'); vals.push(set.symptoms); }
      if (set.conditions) { updates.push('conditions = ?'); vals.push(JSON.stringify(set.conditions)); }
      updates.push("updated_at = datetime('now')");
      db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE chat_id = ? AND user_id = ?`)
        .run(...vals, chatId, userId);
    }

    // Apply $push.messages
    if (push.messages && push.messages.length) {
      const current = JSON.parse(row.messages || '[]');
      const updated = [...current, ...push.messages];
      db.prepare(`UPDATE conversations SET messages = ?, updated_at = datetime('now') WHERE chat_id = ? AND user_id = ?`)
        .run(JSON.stringify(updated), chatId, userId);
    }

    row = db.prepare('SELECT * FROM conversations WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
    return Conversation._format(row);
  },

  toggleShare(chatId, userId) {
    const row = db.prepare('SELECT * FROM conversations WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
    if (!row) return null;
    const newVal = row.share_enabled ? 0 : 1;
    db.prepare('UPDATE conversations SET share_enabled = ? WHERE chat_id = ? AND user_id = ?')
      .run(newVal, chatId, userId);
    return Conversation._format(db.prepare('SELECT * FROM conversations WHERE chat_id = ? AND user_id = ?').get(chatId, userId));
  },

  _format(row) {
    return {
      _id: row.id,
      chatId: row.chat_id,
      userId: { _id: row.user_id, name: row.user_name || '' },
      shareId: row.share_id,
      shareEnabled: !!row.share_enabled,
      lang: row.lang,
      symptoms: row.symptoms,
      conditions: JSON.parse(row.conditions || '[]'),
      messages: JSON.parse(row.messages || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

module.exports = Conversation;
