const INSPECTION_TTL_MINUTES = 60;
const INSPECTION_TTL_MS = INSPECTION_TTL_MINUTES * 60_000;
const expiryCutoff = `julianday('now', '-${INSPECTION_TTL_MINUTES} minutes')`;

const OPEN_INSPECTION_SQL = `status = 'in_progress' AND julianday(created_at) > ${expiryCutoff}`;

const localClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  fractionalSecondDigits: 3, hourCycle: 'h23', timeZoneName: 'longOffset',
});

function parseInspectionTimestamp(value) {
  if (typeof value !== 'string' || !value) return NaN;
  const iso = value.replace(' ', 'T');
  // Older SQLite rows contain UTC timestamps without an offset.
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : `${iso}Z`);
}

function localInspectionTimestamp(date = new Date()) {
  const parts = Object.fromEntries(localClock.formatToParts(date).map(({ type, value }) => [type, value]));
  const { year, month, day, hour, minute, second, fractionalSecond, timeZoneName } = parts;
  const offset = timeZoneName.slice(3) || '+00:00';
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fractionalSecond}${offset}`;
}

function localInspectionDate(value) {
  const instant = parseInspectionTimestamp(value);
  return Number.isFinite(instant) ? localInspectionTimestamp(new Date(instant)).slice(0, 10) : null;
}

function inspectionExpiry(createdAt) {
  return parseInspectionTimestamp(createdAt) + INSPECTION_TTL_MS;
}

function purgeExpiredInspections(db) {
  const cutoff = new Date(Date.now() - INSPECTION_TTL_MS).toISOString();
  const expired = `status = 'in_progress' AND julianday(created_at) <= julianday(?)`;
  if (!db.prepare(`SELECT 1 FROM inspections WHERE ${expired} LIMIT 1`).get(cutoff)) return;

  db.transaction(() => {
    db.prepare(`
      DELETE FROM measurements
      WHERE inspection_id IN (SELECT id FROM inspections WHERE ${expired})
    `).run(cutoff);
    db.prepare(`DELETE FROM inspections WHERE ${expired}`).run(cutoff);
  }).immediate();
}

let cleanupTimer;

function scheduleInspectionCleanup(db) {
  clearTimeout(cleanupTimer);
  let delay;
  try {
    purgeExpiredInspections(db);
    const next = db.prepare(`
      SELECT created_at FROM inspections
      WHERE status = 'in_progress' AND julianday(created_at) IS NOT NULL
      ORDER BY julianday(created_at)
      LIMIT 1
    `).get();
    if (!next) return;
    delay = Math.max(1, Math.min(INSPECTION_TTL_MS, inspectionExpiry(next.created_at) - Date.now()));
  } catch (error) {
    console.error('Inspection cleanup failed:', error);
    delay = 30_000;
  }
  cleanupTimer = setTimeout(() => scheduleInspectionCleanup(db), delay).unref();
}

module.exports = {
  OPEN_INSPECTION_SQL, inspectionExpiry, localInspectionDate, localInspectionTimestamp,
  purgeExpiredInspections, scheduleInspectionCleanup,
};
