const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_ROLES = ['admin', 'quality_admin', 'auditor'];

// GET /api/users
router.get('/', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, badge_id, role, active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// POST /api/users
router.post('/', requireAdmin, (req, res) => {
  const { name, badge_id, role, pin } = req.body;
  if (!name || !badge_id || !role) {
    return res.status(400).json({ error: 'Câmpuri obligatorii: name, badge_id, role' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Rol invalid' });
  }
  if (role === 'admin' && !pin) {
    return res.status(400).json({ error: 'PIN obligatoriu pentru administratorul sistem' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE badge_id = ?').get(badge_id);
  if (existing) {
    return res.status(409).json({ error: 'Badge ID deja există' });
  }
  const pin_hash = pin ? bcrypt.hashSync(pin, 10) : null;
  const result = db.prepare('INSERT INTO users (name, badge_id, role, pin_hash) VALUES (?, ?, ?, ?)').run(name, badge_id, role, pin_hash);
  const user = db.prepare('SELECT id, name, badge_id, role, active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { name, badge_id, role, pin, active } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilizator negăsit' });

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Rol invalid' });
  }

  const pin_hash = pin ? bcrypt.hashSync(pin, 10) : user.pin_hash;
  db.prepare(`
    UPDATE users SET name = ?, badge_id = ?, role = ?, pin_hash = ?, active = ?
    WHERE id = ?
  `).run(
    name ?? user.name,
    badge_id ?? user.badge_id,
    role ?? user.role,
    pin_hash,
    active !== undefined ? (active ? 1 : 0) : user.active,
    req.params.id
  );
  const updated = db.prepare('SELECT id, name, badge_id, role, active, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/users/:id (soft delete)
router.delete('/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilizator negăsit' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
