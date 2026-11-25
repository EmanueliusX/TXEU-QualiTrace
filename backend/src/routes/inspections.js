const express = require('express');
const { getDb } = require('../database');
const {
  OPEN_INSPECTION_SQL, inspectionExpiry, localInspectionTimestamp,
  purgeExpiredInspections, scheduleInspectionCleanup,
} = require('../inspectionTime');

const router = express.Router();

function sendInspectionUnavailable(res) {
  return res.status(404).json({
    code: 'INSPECTION_UNAVAILABLE',
    error: 'Inspecția nu mai este disponibilă. Porniți o inspecție nouă.',
  });
}

router.param('id', (req, res, next, id) => {
  const db = getDb();
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
  if (!inspection) return sendInspectionUnavailable(res);
  if (inspection.status === 'in_progress' && !(inspectionExpiry(inspection.created_at) > Date.now())) {
    purgeExpiredInspections(db);
    return sendInspectionUnavailable(res);
  }
  req.inspection = inspection;
  next();
});

// POST /api/inspections — start a new inspection session.
// Requires a template (fields) defined for (part_number, operation_id).
router.post('/', (req, res) => {
  const { job_number, part_number, operation_id, operator_badge } = req.body;
  if (!job_number || !part_number || !operation_id) {
    return res.status(400).json({ error: 'job_number, part_number și operation_id sunt obligatorii' });
  }
  const db = getDb();
  const op = db.prepare('SELECT * FROM operations WHERE id = ? AND active = 1').get(operation_id);
  if (!op) return res.status(404).json({ error: 'Operație negăsită sau inactivă' });

  const partNumberUp = String(part_number).toUpperCase().trim();
  const fields = db.prepare(`
    SELECT * FROM measurement_fields
    WHERE operation_id = ? AND part_number = ? AND active = 1
    ORDER BY order_index, id
  `).all(operation_id, partNumberUp);

  if (fields.length === 0) {
    return res.status(404).json({
      error: `Niciun șablon definit pentru Part Number "${partNumberUp}" și operația "${op.code}". Contactați adminul de calitate.`
    });
  }

  let operator_id = null;
  if (operator_badge) {
    const op_user = db.prepare(`SELECT id, role FROM users WHERE badge_id = ? AND active = 1`).get(operator_badge);
    if (op_user) operator_id = op_user.id;
  }

  const inspection = db.transaction(() => {
    const createdAt = localInspectionTimestamp();
    const result = db.prepare(`
      INSERT INTO inspections (job_number, part_number, operation_id, operator_id, operator_badge, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      String(job_number).toUpperCase().trim(),
      partNumberUp,
      operation_id,
      operator_id,
      operator_badge || null,
      createdAt
    );

    const measurement = db.prepare('INSERT INTO measurements (inspection_id, field_id, measured_at) VALUES (?, ?, ?)');
    for (const field of fields) measurement.run(result.lastInsertRowid, field.id, createdAt);
    return db.prepare('SELECT * FROM inspections WHERE id = ?').get(result.lastInsertRowid);
  }).immediate();
  scheduleInspectionCleanup(db);

  res.status(201).json({ inspection, fields, operation: op });
});

// GET /api/inspections/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const { inspection } = req;

  const measurements = db.prepare(`
    SELECT m.*, f.name, f.unit, f.nominal_value, f.min_value, f.max_value, f.description, f.order_index
    FROM measurements m
    JOIN measurement_fields f ON f.id = m.field_id
    WHERE m.inspection_id = ?
    ORDER BY f.order_index, f.id
  `).all(req.params.id);

  const operation = db.prepare('SELECT * FROM operations WHERE id = ?').get(inspection.operation_id);
  const expiresInMs = inspection.status === 'in_progress'
    ? Math.max(0, inspectionExpiry(inspection.created_at) - Date.now())
    : null;
  res.json({ inspection, measurements, operation, expires_in_ms: expiresInMs });
});

// PUT /api/inspections/:id/measure
router.put('/:id/measure', (req, res) => {
  const { field_id, value } = req.body;
  if (field_id === undefined || value === undefined) {
    return res.status(400).json({ error: 'field_id și value sunt obligatorii' });
  }
  const db = getDb();
  const { inspection } = req;
  if (inspection.status !== 'in_progress') return res.status(400).json({ error: 'Inspecția nu mai poate fi modificată' });

  const field = db.prepare(`
    SELECT f.* FROM measurement_fields f
    JOIN measurements m ON m.field_id = f.id
    WHERE m.inspection_id = ? AND f.id = ?
  `).get(inspection.id, field_id);
  if (!field) return res.status(404).json({ error: 'Câmp negăsit' });

  const numVal = parseFloat(value);
  const status = (!isNaN(numVal) && numVal >= field.min_value && numVal <= field.max_value) ? 'pass' : 'fail';

  const measurement = db.prepare(`
    UPDATE measurements SET value = ?, status = ?, measured_at = ?
    WHERE inspection_id = ? AND field_id = ?
      AND EXISTS (SELECT 1 FROM inspections WHERE id = measurements.inspection_id AND ${OPEN_INSPECTION_SQL})
    RETURNING *
  `).get(numVal, status, localInspectionTimestamp(), inspection.id, field_id);
  if (!measurement) return sendInspectionUnavailable(res);

  res.json({ measurement, status });
});

// POST /api/inspections/:id/validate — validate inspection with badge (auditor or higher)
router.post('/:id/validate', (req, res) => {
  const { badge_id } = req.body;
  if (!badge_id) return res.status(400).json({ error: 'badge_id obligatoriu' });

  const db = getDb();
  const { inspection } = req;
  if (inspection.status !== 'in_progress') return res.status(400).json({ error: 'Inspecția a fost deja finalizată' });

  const validator = db.prepare('SELECT * FROM users WHERE badge_id = ? AND active = 1').get(badge_id);
  if (!validator) return res.status(403).json({ error: 'Badge necunoscut sau inactiv' });

  const measurements = db.prepare('SELECT * FROM measurements WHERE inspection_id = ?').all(inspection.id);
  const allPass = measurements.length > 0 && measurements.every(m => m.status === 'pass');

  if (!allPass) return res.status(400).json({ error: 'Nu toate măsurătorile sunt în toleranță' });

  const result = db.prepare(`
    UPDATE inspections SET status = 'pass', validated_by = ?, validated_at = ?
    WHERE id = ? AND ${OPEN_INSPECTION_SQL}
  `).run(validator.id, localInspectionTimestamp(), inspection.id);
  if (!result.changes) return sendInspectionUnavailable(res);

  res.json({ success: true, validated_by: validator.name });
});

module.exports = router;
