import Database from 'better-sqlite3';
import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';

describe('database migration', () => {
  it('wraps migration statements in a transaction', async () => {
    const db = createDatabase(':memory:');
    const transactionSpy = vi.spyOn(db, 'transaction');

    await migrate(db);

    expect(transactionSpy).toHaveBeenCalledTimes(1);

    await db.destroy();
  });

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

  it('deletes daily metrics when the parent entry is deleted', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    await sql`
      insert into entries (id, source, source_key, name, first_seen_at, updated_at)
      values (1, 'GH', 'entry-1', 'Entry 1', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
    `.execute(db);

    await sql`
      insert into daily_metrics (entry_id, metric_date, metric_value, created_at)
      values (1, '2025-01-01', 42, '2025-01-01T00:00:00Z')
    `.execute(db);

    await sql`
      delete from entries
      where id = 1
    `.execute(db);

    const metrics = await sql<{ count: number }>`
      select count(*) as count
      from daily_metrics
      where entry_id = 1
    `.execute(db);

    expect(metrics.rows[0]?.count).toBe(0);

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
