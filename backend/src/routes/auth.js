const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'qualitrace-secret';

// Login:
//   admin        → badge + PIN (obligatoriu)
//   quality_admin → badge only (fără PIN)
router.post('/login', (req, res) => {
  const { badge_id, pin } = req.body;
  if (!badge_id) {
    return res.status(400).json({ error: 'Badge ID obligatoriu' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE badge_id = ? AND active = 1').get(badge_id);
  if (!user || (user.role !== 'admin' && user.role !== 'quality_admin')) {
    return res.status(401).json({ error: 'Badge necunoscut sau acces refuzat' });
  }
  // admin needs PIN always; quality_admin uses badge-only
  if (user.role === 'admin') {
    if (!pin) return res.status(400).json({ error: 'PIN obligatoriu pentru administrator' });
    if (!user.pin_hash || !bcrypt.compareSync(pin, user.pin_hash)) {
      return res.status(401).json({ error: 'PIN incorect' });
    }
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, badge_id: user.badge_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, badge_id: user.badge_id, role: user.role } });
});

// Validate any badge — no auth required (used by auditor flow)
router.post('/validate-badge', (req, res) => {
  const { badge_id } = req.body;
  if (!badge_id) {
    return res.status(400).json({ error: 'Badge ID obligatoriu' });
  }
  const db = getDb();
  const user = db.prepare('SELECT id, name, badge_id, role, active FROM users WHERE badge_id = ?').get(badge_id);
  if (!user || !user.active) {
    return res.status(404).json({ error: 'Badge necunoscut sau inactiv' });
  }
  res.json({ user });
});

module.exports = router;
