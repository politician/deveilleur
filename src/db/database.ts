import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import type { DatabaseSchema } from './schema.js';

export function createDatabase(filename: string): Kysely<DatabaseSchema> {
  const sqlite = new Database(filename);
  sqlite.pragma('foreign_keys = ON');

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqlite })
  });
}
