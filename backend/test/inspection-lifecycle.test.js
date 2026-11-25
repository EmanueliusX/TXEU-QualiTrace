const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const express = require('express');
const jwt = require('jsonwebtoken');
const { inspectionExpiry, localInspectionTimestamp, scheduleInspectionCleanup } = require('../src/inspectionTime');

test('inspection timestamps follow Romanian daylight saving and retain elapsed time', () => {
  const first = localInspectionTimestamp(new Date('2026-10-25T00:45:00.123Z'));
  const second = localInspectionTimestamp(new Date('2026-10-25T01:45:00.123Z'));
  assert.equal(first, '2026-10-25T03:45:00.123+03:00');
  assert.equal(second, '2026-10-25T03:45:00.123+02:00');
  assert.equal(inspectionExpiry(first), Date.parse(second));
  assert.equal(inspectionExpiry('2026-10-25 00:45:00'), Date.parse('2026-10-25T01:45:00Z'));
});

test('unfinished inspections expire from creation and completed inspections remain in local-date reports', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qualitrace-inspection-'));
  process.env.DB_DATA_DIR = dir;
  process.env.JWT_SECRET = 'isolated-inspection-test-secret';
  const db = require('../src/database').getDb();
  const app = express();
  app.use(express.json());
  app.use('/inspections', require('../src/routes/inspections'));
  app.use('/reports', require('../src/routes/reports'));
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await new Promise(resolve => server.once('listening', resolve));

  const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET);
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, url, body, status = 200) {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, status, `${method} ${url}: ${JSON.stringify(data)}`);
    return data;
  }

  const start = () => call('POST', '/inspections', {
    job_number: 'JOB-TTL', part_number: 'PN-12345-A', operation_id: 1, operator_badge: 'AUD001',
  }, 201);
  const findInspection = db.prepare('SELECT * FROM inspections WHERE id = ?');
  const measurements = db.prepare('SELECT * FROM measurements WHERE inspection_id = ?');
  const setCreatedAt = db.prepare('UPDATE inspections SET created_at = ? WHERE id = ?');

  const { inspection, fields } = await start();
  const id = inspection.id;
  assert.match(findInspection.get(id).created_at, /\+0[23]:00$/);
  const originalLifetime = (await call('GET', `/inspections/${id}`)).expires_in_ms;
  assert.ok(originalLifetime > 3_590_000 && originalLifetime <= 3_600_000);
  const { measurement } = await call('PUT', `/inspections/${id}/measure`, {
    field_id: fields[0].id, value: fields[0].nominal_value,
  });
  assert.match(measurement.measured_at, /\+0[23]:00$/);
  assert.equal(findInspection.get(id).created_at, inspection.created_at);
  assert.ok((await call('GET', `/inspections/${id}`)).expires_in_ms <= originalLifetime);

  setCreatedAt.run(localInspectionTimestamp(new Date(Date.now() - 3_600_000)), id);
  const expired = await call('POST', `/inspections/${id}/validate`, { badge_id: 'AUD001' }, 404);
  assert.equal(expired.code, 'INSPECTION_UNAVAILABLE');
  assert.equal(findInspection.get(id), undefined);
  assert.deepEqual(measurements.all(id), []);

  const { inspection: restarted } = await start();
  assert.notEqual(restarted.id, id);
  assert.ok(measurements.all(restarted.id).every(m => m.status === 'pending'));
  for (const field of fields) {
    await call('PUT', `/inspections/${restarted.id}/measure`, { field_id: field.id, value: field.nominal_value });
  }
  await call('POST', `/inspections/${restarted.id}/validate`, { badge_id: 'AUD001' });
  assert.match(findInspection.get(restarted.id).validated_at, /\+0[23]:00$/);
  assert.equal((await call('GET', `/inspections/${restarted.id}`)).expires_in_ms, null);
  setCreatedAt.run('2024-07-02T00:10:00.000+03:00', restarted.id);

  const insertLegacy = db.prepare(`
    INSERT INTO inspections (job_number, part_number, operation_id, status, created_at)
    VALUES ('JOB-LEGACY', 'PN-12345-A', 1, ?, ?)
  `);
  const legacy = insertLegacy.run('fail', '2024-07-01 21:30:00').lastInsertRowid;
  const abandoned = insertLegacy.run('in_progress', '2024-07-01 21:30:00').lastInsertRowid;
  const addMeasurement = db.prepare('INSERT INTO measurements (inspection_id, field_id) VALUES (?, ?)');
  addMeasurement.run(abandoned, fields[0].id);
  scheduleInspectionCleanup(db);
  assert.equal(findInspection.get(abandoned), undefined);
  assert.deepEqual(measurements.all(abandoned), []);

  const dates = '?from=2024-07-02&to=2024-07-02';
  const report = await call('GET', '/reports/inspections' + dates);
  assert.deepEqual(report.inspections.map(row => row.id), [legacy, restarted.id]);
  assert.equal(measurements.all(restarted.id).length, fields.length);

  const nearExpiry = insertLegacy.run('in_progress', localInspectionTimestamp(new Date(Date.now() - 3_599_700))).lastInsertRowid;
  addMeasurement.run(nearExpiry, fields[0].id);
  scheduleInspectionCleanup(db);
  const waitUntil = Date.now() + 2_000;
  while (findInspection.get(nearExpiry) && Date.now() < waitUntil) await sleep(25);
  assert.equal(findInspection.get(nearExpiry), undefined);
  assert.deepEqual(measurements.all(nearExpiry), []);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
});
