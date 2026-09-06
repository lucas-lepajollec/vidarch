import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vidarch-database-'));
process.env.DATA_DIR = path.join(root, 'data');
process.env.DOWNLOADS_DIR = path.join(root, 'downloads');

const { db, initDatabase } = await import('./database.js');

after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('database initialization', () => {
  it('creates the current schema and remains idempotent', () => {
    initDatabase();
    db.prepare("INSERT INTO settings (key, value) VALUES ('migration_marker', 'keep-me')").run();
    initDatabase();

    assert.equal(Number(db.pragma('user_version', { simple: true })), 1);
    assert.equal(
      (db.prepare("SELECT value FROM settings WHERE key = 'migration_marker'").get() as { value: string }).value,
      'keep-me',
    );
  });
});
