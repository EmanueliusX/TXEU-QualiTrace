const express = require('express');
const { getDb } = require('../database');
const { requireQualityAdminOrAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/operations  — public for auditor flow; ?all=1 returns inactive too (admin use)
router.get('/', (req, res) => {
  const db = getDb();
  const ops = req.query.all === '1'
    ? db.prepare('SELECT * FROM operations ORDER BY code').all()
    : db.prepare('SELECT * FROM operations WHERE active = 1 ORDER BY code').all();
  res.json(ops);
});

// GET /api/operations/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(req.params.id);
  if (!op) return res.status(404).json({ error: 'Operație negăsită' });
  res.json(op);
});

// GET /api/operations/:id/fields?part_number=PN  — fields for a (part, operation) template
router.get('/:id/fields', (req, res) => {
  const { part_number } = req.query;
  if (!part_number) {
    return res.status(400).json({ error: 'part_number obligatoriu' });
  }
  const db = getDb();
  const fields = db.prepare(`
    SELECT * FROM measurement_fields
    WHERE operation_id = ? AND part_number = ? AND active = 1
    ORDER BY order_index, id
  `).all(req.params.id, String(part_number).toUpperCase());
  res.json(fields);
});

// POST /api/operations  — quality_admin or admin
router.post('/', requireQualityAdminOrAdmin, (req, res) => {
  const { code, name, description } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Cod și nume obligatorii' });
  const db = getDb();
  const existing = db.prepare('SELECT id FROM operations WHERE code = ?').get(code);
  if (existing) return res.status(409).json({ error: 'Cod operație deja există' });
  const result = db.prepare('INSERT INTO operations (code, name, description) VALUES (?, ?, ?)').run(code, name, description || null);
  const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(op);
});

// PUT /api/operations/:id
router.put('/:id', requireQualityAdminOrAdmin, (req, res) => {
  const { code, name, description, active } = req.body;
  const db = getDb();
  const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(req.params.id);
  if (!op) return res.status(404).json({ error: 'Operație negăsită' });
  db.prepare(`
    UPDATE operations SET code = ?, name = ?, description = ?, active = ? WHERE id = ?
  `).run(
    code ?? op.code,
    name ?? op.name,
    description !== undefined ? description : op.description,
    active !== undefined ? (active ? 1 : 0) : op.active,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM operations WHERE id = ?').get(req.params.id));
});

// DELETE /api/operations/:id
router.delete('/:id', requireQualityAdminOrAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE operations SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
