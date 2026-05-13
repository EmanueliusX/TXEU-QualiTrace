const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'qualitrace.db');

let db;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations();
    initSchema();
  }
  return db;
}

function runMigrations() {
  // If old measurement_fields schema exists (without part_number) → drop & recreate.
  const tableInfo = db.prepare("PRAGMA table_info(measurement_fields)").all();
  if (tableInfo.length > 0) {
    const hasPartNumber = tableInfo.some(c => c.name === 'part_number');
    if (!hasPartNumber) {
      console.log('[migrate] Old schema detected — recreating tables with role/template support...');
      db.exec(`
        DROP TABLE IF EXISTS measurements;
        DROP TABLE IF EXISTS inspections;
        DROP TABLE IF EXISTS measurement_fields;
        DROP TABLE IF EXISTS operations;
        DROP TABLE IF EXISTS users;
      `);
    }
  }
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      badge_id TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'quality_admin', 'auditor')),
      pin_hash TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS measurement_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT NOT NULL,
      operation_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT DEFAULT 'mm',
      nominal_value REAL,
      min_value REAL NOT NULL,
      max_value REAL NOT NULL,
      order_index INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operation_id) REFERENCES operations(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_fields_part_op ON measurement_fields(part_number, operation_id, active);

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_number TEXT NOT NULL,
      part_number TEXT NOT NULL,
      operation_id INTEGER NOT NULL,
      operator_id INTEGER,
      operator_badge TEXT,
      status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'pass', 'fail')),
      validated_by INTEGER,
      validated_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operation_id) REFERENCES operations(id),
      FOREIGN KEY (operator_id) REFERENCES users(id),
      FOREIGN KEY (validated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      value REAL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pass', 'fail', 'pending')),
      measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (field_id) REFERENCES measurement_fields(id)
    );
  `);

  // Seed initial data if DB is empty
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    const adminPin = bcrypt.hashSync('1234', 10);
    const qaPin = bcrypt.hashSync('5678', 10);

    db.prepare(`INSERT INTO users (name, badge_id, role, pin_hash) VALUES ('System Admin', 'ADMIN001', 'admin', ?)`).run(adminPin);
    db.prepare(`INSERT INTO users (name, badge_id, role, pin_hash) VALUES ('Andrei Marinescu', 'QA001', 'quality_admin', ?)`).run(qaPin);
    db.prepare(`INSERT INTO users (name, badge_id, role) VALUES ('Ion Popescu', 'AUD001', 'auditor')`).run();
    db.prepare(`INSERT INTO users (name, badge_id, role) VALUES ('Maria Ionescu', 'AUD002', 'auditor')`).run();

    db.prepare(`INSERT INTO operations (code, name, description) VALUES ('OP-D01', 'Inspecție Diametru Exterior', 'Verificare dimensiuni exterioare cu subler')`).run();
    db.prepare(`INSERT INTO operations (code, name, description) VALUES ('OP-L01', 'Inspecție Lungime', 'Verificare lungime totală și parțială')`).run();
    db.prepare(`INSERT INTO operations (code, name, description) VALUES ('OP-G01', 'Inspecție Grosime', 'Verificare grosime material')`).run();

    // Seed templates: (part_number, operation_id) → fields
    const stmtField = db.prepare(`
      INSERT INTO measurement_fields
      (part_number, operation_id, name, description, unit, nominal_value, min_value, max_value, order_index, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const qaUserId = 2;

    // PN-12345-A → OP-D01 (Diametru)
    stmtField.run('PN-12345-A', 1, 'Diametru D1', 'Diametru exterior mare', 'mm', 25.00, 24.95, 25.05, 1, qaUserId);
    stmtField.run('PN-12345-A', 1, 'Diametru D2', 'Diametru exterior mic', 'mm', 18.00, 17.95, 18.05, 2, qaUserId);
    stmtField.run('PN-12345-A', 1, 'Diametru D3', 'Diametru alezaj', 'mm', 10.00, 9.97, 10.03, 3, qaUserId);

    // PN-12345-A → OP-L01 (Lungime)
    stmtField.run('PN-12345-A', 2, 'Lungime L1', 'Lungime totală', 'mm', 100.00, 99.80, 100.20, 1, qaUserId);
    stmtField.run('PN-12345-A', 2, 'Lungime L2', 'Lungime secțiune A', 'mm', 50.00, 49.90, 50.10, 2, qaUserId);

    // PN-67890-B → OP-G01 (Grosime)
    stmtField.run('PN-67890-B', 3, 'Grosime G1', 'Grosime nominală', 'mm', 5.00, 4.95, 5.05, 1, qaUserId);
    stmtField.run('PN-67890-B', 3, 'Grosime G2', 'Grosime minimă', 'mm', 4.80, 4.75, 4.85, 2, qaUserId);
  }
}

module.exports = { getDb };
