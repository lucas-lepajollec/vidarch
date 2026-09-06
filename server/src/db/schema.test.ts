import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  SCHEMA_VERSION,
  addColumnIfMissing,
  assertSupportedSchema,
  readSchemaVersion,
  recordCurrentSchema,
} from './schema.js';

describe('SQLite schema contract', () => {
  it('adopts an unversioned database without losing existing data', () => {
    const database = new Database(':memory:');
    database.exec("CREATE TABLE marker (value TEXT NOT NULL); INSERT INTO marker VALUES ('keep-me')");
    assertSupportedSchema(database);
    recordCurrentSchema(database);
    assert.equal(readSchemaVersion(database), SCHEMA_VERSION);
    assert.equal((database.prepare('SELECT value FROM marker').get() as { value: string }).value, 'keep-me');
    database.close();
  });

  it('adds known columns idempotently and surfaces invalid migrations', () => {
    const database = new Database(':memory:');
    database.exec('CREATE TABLE videos (id TEXT PRIMARY KEY)');
    addColumnIfMissing(database, 'videos', 'language', 'TEXT');
    addColumnIfMissing(database, 'videos', 'language', 'TEXT');
    const columns = database.pragma('table_info(videos)') as Array<{ name: string }>;
    assert.equal(columns.filter((column) => column.name === 'language').length, 1);
    assert.throws(() => addColumnIfMissing(database, 'missing_table', 'value', 'TEXT'));
    database.close();
  });

  it('rejects a database created by a newer application', () => {
    const database = new Database(':memory:');
    database.pragma(`user_version = ${SCHEMA_VERSION + 1}`);
    assert.throws(() => assertSupportedSchema(database), /supports up to schema 1/);
    database.close();
  });
});
