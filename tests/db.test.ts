import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { createDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';

describe('database migration', () => {
  it('creates the expected tables', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const tables = await sql<{ name: string }>`
      select name
      from sqlite_master
      where type = 'table'
    `.execute(db);

    expect(tables.rows.map((table) => table.name)).toEqual(
      expect.arrayContaining(['entries', 'daily_metrics', 'run_reports'])
    );

    await db.destroy();
  });
});
