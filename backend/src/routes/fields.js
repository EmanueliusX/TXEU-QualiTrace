const express = require('express');
const { getDb } = require('../database');
const { requireQualityAdminOrAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/fields?operation_id=X&part_number=Y
// Lists fields for a specific template (part_number + operation_id), or all summaries.
router.get('/', requireQualityAdminOrAdmin, (req, res) => {
  const db = getDb();
  const { operation_id, part_number } = req.query;
  if (operation_id && part_number) {
    const fields = db.prepare(`
      SELECT * FROM measurement_fields
      WHERE operation_id = ? AND part_number = ? AND active = 1
      ORDER BY order_index, id
    `).all(operation_id, String(part_number).toUpperCase());
    return res.json(fields);
  }
  // Otherwise: full listing with operation/part info
  const fields = db.prepare(`
    SELECT mf.*, o.name as operation_name, o.code as operation_code
    FROM measurement_fields mf
    JOIN operations o ON o.id = mf.operation_id
    WHERE mf.active = 1
    ORDER BY mf.part_number, o.code, mf.order_index
  `).all();
  res.json(fields);
});

// GET /api/fields/templates  — list of distinct (part_number, operation_id) with field counts
router.get('/templates', requireQualityAdminOrAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      mf.part_number,
      mf.operation_id,
      o.code as operation_code,
      o.name as operation_name,
      COUNT(*) as field_count,
      MAX(mf.created_at) as updated_at
    FROM measurement_fields mf
    JOIN operations o ON o.id = mf.operation_id
    WHERE mf.active = 1
    GROUP BY mf.part_number, mf.operation_id
    ORDER BY mf.part_number, o.code
  `).all();
  res.json(rows);
});

// POST /api/fields — create field on a (part_number, operation_id) template
router.post('/', requireQualityAdminOrAdmin, (req, res) => {
  const { part_number, operation_id, name, description, unit, nominal_value, min_value, max_value, order_index } = req.body;
  if (!part_number || !operation_id || !name || min_value === undefined || max_value === undefined) {
    return res.status(400).json({ error: 'Câmpuri obligatorii: part_number, operation_id, name, min_value, max_value' });
  }
  if (parseFloat(min_value) >= parseFloat(max_value)) {
    return res.status(400).json({ error: 'min_value trebuie să fie mai mic decât max_value' });
  }
  const db = getDb();
  const op = db.prepare('SELECT id FROM operations WHERE id = ? AND active = 1').get(operation_id);
  if (!op) return res.status(404).json({ error: 'Operație negăsită' });

  const partNumberUp = String(part_number).toUpperCase().trim();

  const result = db.prepare(`
    INSERT INTO measurement_fields (part_number, operation_id, name, description, unit, nominal_value, min_value, max_value, order_index, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    partNumberUp, operation_id, name,
    description || null, unit || 'mm',
    nominal_value !== undefined && nominal_value !== '' ? nominal_value : null,
    min_value, max_value, order_index || 0,
    req.user.id
  );
  res.status(201).json(db.prepare('SELECT * FROM measurement_fields WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/fields/:id
router.put('/:id', requireQualityAdminOrAdmin, (req, res) => {
  const { name, description, unit, nominal_value, min_value, max_value, order_index, active } = req.body;
  const db = getDb();
  const field = db.prepare('SELECT * FROM measurement_fields WHERE id = ?').get(req.params.id);
  if (!field) return res.status(404).json({ error: 'Câmp negăsit' });

  const newMin = min_value !== undefined ? parseFloat(min_value) : field.min_value;
  const newMax = max_value !== undefined ? parseFloat(max_value) : field.max_value;
  if (newMin >= newMax) return res.status(400).json({ error: 'min_value trebuie să fie mai mic decât max_value' });

  db.prepare(`
    UPDATE measurement_fields
    SET name = ?, description = ?, unit = ?, nominal_value = ?, min_value = ?, max_value = ?, order_index = ?, active = ?
    WHERE id = ?
  `).run(
    name ?? field.name,
    description !== undefined ? description : field.description,
    unit ?? field.unit,
    nominal_value !== undefined ? nominal_value : field.nominal_value,
    newMin, newMax,
    order_index !== undefined ? order_index : field.order_index,
    active !== undefined ? (active ? 1 : 0) : field.active,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM measurement_fields WHERE id = ?').get(req.params.id));
});

// DELETE /api/fields/:id (soft)
router.delete('/:id', requireQualityAdminOrAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE measurement_fields SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/fields/copy  — duplicate fields from one (part, op) to another part
router.post('/copy', requireQualityAdminOrAdmin, (req, res) => {
  const { source_part, source_operation_id, target_part } = req.body;
  if (!source_part || !source_operation_id || !target_part) {
    return res.status(400).json({ error: 'Câmpuri obligatorii: source_part, source_operation_id, target_part' });
  }
  const db = getDb();
  const fields = db.prepare(`
    SELECT * FROM measurement_fields
    WHERE part_number = ? AND operation_id = ? AND active = 1
  `).all(String(source_part).toUpperCase(), source_operation_id);

  if (fields.length === 0) return res.status(404).json({ error: 'Niciun câmp sursă găsit' });

  const targetUp = String(target_part).toUpperCase();
  const stmt = db.prepare(`
    INSERT INTO measurement_fields (part_number, operation_id, name, description, unit, nominal_value, min_value, max_value, order_index, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const f of fields) {
      stmt.run(targetUp, f.operation_id, f.name, f.description, f.unit,
        f.nominal_value, f.min_value, f.max_value, f.order_index, req.user.id);
    }
  });
  tx();
  res.json({ success: true, copied: fields.length });
});

module.exports = router;
