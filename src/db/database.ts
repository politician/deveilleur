import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import type { DatabaseSchema } from './schema.js';

export function createDatabase(filename: string) {
  const sqlite = new Database(filename);

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqlite })
  });
}
