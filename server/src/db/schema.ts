import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

export function readSchemaVersion(database: Database.Database): number {
  return Number(database.pragma('user_version', { simple: true })) || 0;
}

export function assertSupportedSchema(database: Database.Database): void {
  const current = readSchemaVersion(database);
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `VidArch data uses schema ${current}, but this application supports up to schema ${SCHEMA_VERSION}. ` +
      'Restore the matching/newer application image instead of downgrading.',
    );
  }
}

export function addColumnIfMissing(
  database: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    throw new Error('Unsafe SQLite schema identifier.');
  }
  const columns = database.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (columns.some((candidate) => candidate.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function recordCurrentSchema(database: Database.Database): void {
  database.pragma(`user_version = ${SCHEMA_VERSION}`);
}
