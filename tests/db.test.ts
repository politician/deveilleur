import Database from 'better-sqlite3';
import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';

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

  it('enables foreign keys when a connection is created', async () => {
    const pragmaSpy = vi.spyOn(Database.prototype, 'pragma');

    const db = createDatabase(':memory:');

    expect(pragmaSpy).toHaveBeenCalledWith('foreign_keys = ON');

    pragmaSpy.mockRestore();
    await db.destroy();
  });
});
