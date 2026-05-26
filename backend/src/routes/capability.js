const express = require('express');
const { getDb } = require('../database');
const { requireQualityAdminOrAdmin } = require('../middleware/auth');

const router = express.Router();

// --- Helpers statistice ---

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr, sample = true) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (sample ? arr.length - 1 : arr.length);
  return Math.sqrt(variance);
}

// Sigma "within" (short-term) estimat din media abaterilor standard ale subgrupurilor / c4
// Pentru subgrupuri mici folosim Rbar/d2 — dar pentru simplitate folosim sbar/c4
const C4_TABLE = {
  2: 0.7979, 3: 0.8862, 4: 0.9213, 5: 0.9400, 6: 0.9515,
  7: 0.9594, 8: 0.9650, 9: 0.9693, 10: 0.9727,
};

function sigmaWithin(subgroups) {
  // subgroups = array de array-uri de valori
  const valid = subgroups.filter(s => s.length >= 2);
  if (valid.length === 0) return 0;
  const stds = valid.map(s => stdDev(s, true));
  const sBar = mean(stds);
  const n = valid[0].length; // presupunem dim egală
  const c4 = C4_TABLE[n] || (4 * (n - 1)) / (4 * n - 3); // aproximare pentru n > 10
  return sBar / c4;
}

function computeIndices(values, subgroups, lsl, usl) {
  if (values.length < 2 || lsl === null || usl === null || lsl >= usl) {
    return { ok: false };
  }
  const xbar = mean(values);
  const sOverall = stdDev(values, true);
  const sWithin = sigmaWithin(subgroups);

  const safe = (n, d) => (d > 0 ? n / d : null);

  return {
    ok: true,
    n: values.length,
    subgroup_count: subgroups.length,
    subgroup_size: subgroups[0]?.length || 0,
    xbar,
    sigma_overall: sOverall,
    sigma_within: sWithin,
    lsl, usl,
    // Long-term (Pp/Ppk)
    pp:  safe(usl - lsl, 6 * sOverall),
    ppk: safe(Math.min(usl - xbar, xbar - lsl), 3 * sOverall),
    // Short-term (Cp/Cpk)
    cp:  safe(usl - lsl, 6 * sWithin),
    cpk: safe(Math.min(usl - xbar, xbar - lsl), 3 * sWithin),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

// --- Routes ---

// GET /api/capability/configs — toate config-urile de capabilitate
router.get('/configs', requireQualityAdminOrAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT cc.*, o.code as operation_code, o.name as operation_name
    FROM capability_configs cc
    JOIN operations o ON o.id = cc.operation_id
    ORDER BY cc.part_number, o.code
  `).all();
  res.json(rows);
});

// GET /api/capability/config?part_number=X&operation_id=Y
router.get('/config', requireQualityAdminOrAdmin, (req, res) => {
  const { part_number, operation_id } = req.query;
  if (!part_number || !operation_id) return res.status(400).json({ error: 'part_number și operation_id obligatorii' });
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM capability_configs WHERE part_number = ? AND operation_id = ?
  `).get(String(part_number).toUpperCase(), operation_id);
  res.json(row || null);
});

// POST /api/capability/config — creează sau actualizează (upsert)
router.post('/config', requireQualityAdminOrAdmin, (req, res) => {
  const { part_number, operation_id, samples_per_lot, lots_required, enabled } = req.body;
  if (!part_number || !operation_id) {
    return res.status(400).json({ error: 'part_number și operation_id obligatorii' });
  }
  const spl = parseInt(samples_per_lot, 10);
  const lr = parseInt(lots_required, 10);
  if (!(spl >= 1 && spl <= 50) || !(lr >= 1 && lr <= 100)) {
    return res.status(400).json({ error: 'samples_per_lot (1-50) și lots_required (1-100) trebuie valide' });
  }
  const db = getDb();
  const pn = String(part_number).toUpperCase().trim();
  db.prepare(`
    INSERT INTO capability_configs (part_number, operation_id, samples_per_lot, lots_required, enabled, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(part_number, operation_id) DO UPDATE SET
      samples_per_lot = excluded.samples_per_lot,
      lots_required   = excluded.lots_required,
      enabled         = excluded.enabled,
      updated_at      = CURRENT_TIMESTAMP
  `).run(pn, operation_id, spl, lr, enabled === false || enabled === 0 ? 0 : 1, req.user.id);
  const row = db.prepare(`SELECT * FROM capability_configs WHERE part_number = ? AND operation_id = ?`).get(pn, operation_id);
  res.json(row);
});

// DELETE /api/capability/config/:id
router.delete('/config/:id', requireQualityAdminOrAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM capability_configs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/capability/study?part_number=X&operation_id=Y
// Returnează studiul curent: progresul colectării + indicii calculați (dacă sunt date suficiente).
router.get('/study', requireQualityAdminOrAdmin, (req, res) => {
  const { part_number, operation_id } = req.query;
  if (!part_number || !operation_id) return res.status(400).json({ error: 'part_number și operation_id obligatorii' });
  const db = getDb();
  const pn = String(part_number).toUpperCase();

  const config = db.prepare(`
    SELECT * FROM capability_configs WHERE part_number = ? AND operation_id = ?
  `).get(pn, operation_id);
  if (!config) return res.json({ configured: false });

  const fields = db.prepare(`
    SELECT id, name, unit, nominal_value, min_value, max_value, order_index
    FROM measurement_fields
    WHERE part_number = ? AND operation_id = ? AND active = 1
    ORDER BY order_index, id
  `).all(pn, operation_id);

  // Inspecții PASS pentru această referință + operație
  const inspections = db.prepare(`
    SELECT id, job_number, created_at
    FROM inspections
    WHERE part_number = ? AND operation_id = ? AND status = 'pass'
    ORDER BY created_at DESC
  `).all(pn, operation_id);

  // Grupare pe loturi (job_number) - cele mai recente lots_required loturi cu samples_per_lot măsurători
  const byLot = new Map();
  for (const ins of inspections) {
    if (!byLot.has(ins.job_number)) byLot.set(ins.job_number, []);
    byLot.get(ins.job_number).push(ins);
  }

  // Status colectare pe lot (cel mai recent în față)
  const lotStats = [];
  for (const [job, list] of byLot) {
    lotStats.push({
      job_number: job,
      sample_count: list.length,
      target: config.samples_per_lot,
      complete: list.length >= config.samples_per_lot,
      latest_at: list[0].created_at,
    });
  }
  lotStats.sort((a, b) => (a.latest_at < b.latest_at ? 1 : -1));

  const completeLots = lotStats.filter(l => l.complete).slice(0, config.lots_required);
  const ready = completeLots.length >= config.lots_required;

  // Pentru fiecare câmp, calculăm indicii doar dacă avem date suficiente
  const perField = fields.map(f => {
    if (!ready) return { field: f, ok: false, reason: 'insufficient_data' };

    // Adunăm primele samples_per_lot măsurători din fiecare lot complet (cele mai vechi pentru stabilitate temporală)
    const subgroups = [];
    const allValues = [];
    for (const lot of completeLots) {
      const lotInspections = byLot.get(lot.job_number)
        .slice() // copy
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
        .slice(0, config.samples_per_lot);
      const vals = db.prepare(`
        SELECT value FROM measurements
        WHERE field_id = ? AND value IS NOT NULL AND inspection_id IN (${lotInspections.map(() => '?').join(',')})
      `).all(f.id, ...lotInspections.map(i => i.id)).map(r => r.value);
      if (vals.length === config.samples_per_lot) {
        subgroups.push(vals);
        allValues.push(...vals);
      }
    }

    if (subgroups.length < config.lots_required) return { field: f, ok: false, reason: 'missing_measurements' };

    return { field: f, ...computeIndices(allValues, subgroups, f.min_value, f.max_value) };
  });

  res.json({
    configured: true,
    config,
    fields_count: fields.length,
    lots: lotStats,
    complete_lots: completeLots.length,
    lots_required: config.lots_required,
    samples_per_lot: config.samples_per_lot,
    ready,
    results: perField,
  });
});

module.exports = router;
