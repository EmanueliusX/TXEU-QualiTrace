const express = require('express');
const { getDb } = require('../database');
const { requireQualityAdminOrAdmin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/inspections
router.get('/inspections', requireQualityAdminOrAdmin, (req, res) => {
  const { from, to, status, operation_id, limit = 100, offset = 0 } = req.query;
  const db = getDb();

  let query = `
    SELECT
      i.*,
      o.name as operation_name,
      o.code as operation_code,
      u.name as operator_name,
      v.name as validated_by_name
    FROM inspections i
    LEFT JOIN operations o ON o.id = i.operation_id
    LEFT JOIN users u ON u.id = i.operator_id
    LEFT JOIN users v ON v.id = i.validated_by
    WHERE 1=1
  `;
  const params = [];

  if (from) { query += ' AND date(i.created_at) >= ?'; params.push(from); }
  if (to) { query += ' AND date(i.created_at) <= ?'; params.push(to); }
  if (status) { query += ' AND i.status = ?'; params.push(status); }
  if (operation_id) { query += ' AND i.operation_id = ?'; params.push(operation_id); }

  query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const rows = db.prepare(query).all(...params);

  // Stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
      SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail_count,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count
    FROM inspections
  `).get();

  res.json({ inspections: rows, stats });
});

// GET /api/reports/inspections/:id — full detail
router.get('/inspections/:id', requireQualityAdminOrAdmin, (req, res) => {
  const db = getDb();
  const inspection = db.prepare(`
    SELECT i.*, o.name as operation_name, o.code as operation_code,
      u.name as operator_name, v.name as validated_by_name
    FROM inspections i
    LEFT JOIN operations o ON o.id = i.operation_id
    LEFT JOIN users u ON u.id = i.operator_id
    LEFT JOIN users v ON v.id = i.validated_by
    WHERE i.id = ?
  `).get(req.params.id);
  if (!inspection) return res.status(404).json({ error: 'Inspecție negăsită' });

  const measurements = db.prepare(`
    SELECT m.*, f.name, f.unit, f.nominal_value, f.min_value, f.max_value, f.description
    FROM measurements m
    JOIN measurement_fields f ON f.id = m.field_id
    WHERE m.inspection_id = ?
    ORDER BY f.order_index, f.id
  `).all(req.params.id);

  res.json({ inspection, measurements });
});

// DELETE /api/reports/inspections/:id — hard delete (admin only)
router.delete('/inspections/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const inspection = db.prepare('SELECT id FROM inspections WHERE id = ?').get(req.params.id);
  if (!inspection) return res.status(404).json({ error: 'Inspecție negăsită' });
  db.prepare('DELETE FROM measurements WHERE inspection_id = ?').run(req.params.id);
  db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
