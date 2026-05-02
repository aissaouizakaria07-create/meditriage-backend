const bcrypt = require('bcryptjs');
const { db, newId } = require('./db');

const User = {
  // Create a new user (hashes password automatically)
  async create({ name, email, password }) {
    const hashed = await bcrypt.hash(password, 12);
    const id = newId();
    db.prepare(`
      INSERT INTO users (id, name, email, password)
      VALUES (?, ?, ?, ?)
    `).run(id, name, email.toLowerCase(), hashed);
    return User.findById(id);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? User._format(row) : null;
  },

  findOne({ email }) {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    return row ? User._format(row, true) : null; // include password for auth
  },

  async updateProfile(id, { name, age, sex, bloodType, allergies, conditions }) {
    db.prepare(`
      UPDATE users SET name=?, age=?, sex=?, blood_type=?, allergies=?, conditions=?
      WHERE id=?
    `).run(name || '', age || '', sex || '', bloodType || '', allergies || '', conditions || '', id);
    return User.findById(id);
  },

  async comparePassword(candidate, hashed) {
    return bcrypt.compare(candidate, hashed);
  },

  // Format row → JS object (strip password by default)
  _format(row, includePassword = false) {
    const user = {
      _id: row.id,
      id: row.id,
      name: row.name,
      email: row.email,
      isGuest: !!row.is_guest,
      isGoogle: !!row.is_google,
      profile: {
        age: row.age || '',
        sex: row.sex || '',
        bloodType: row.blood_type || '',
        allergies: row.allergies || '',
        conditions: row.conditions || '',
      },
      createdAt: row.created_at,
    };
    if (includePassword) user.password = row.password;
    return user;
  },
};

module.exports = User;
