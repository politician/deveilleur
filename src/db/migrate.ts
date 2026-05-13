import { sql, type Kysely } from 'kysely';

import type { DatabaseSchema } from './schema.js';

export async function migrate(db: Kysely<DatabaseSchema>): Promise<void> {
  await sql`
    create table if not exists entries (
      id integer primary key autoincrement,
      source text not null,
      source_key text not null,
      name text not null,
      description text,
      language text,
      url text,
      dependency integer not null default 0,
      first_seen_at text not null,
      updated_at text not null,
      unique(source, source_key)
    )
  `.execute(db);

  await sql`
    create table if not exists daily_metrics (
      id integer primary key autoincrement,
      entry_id integer not null references entries(id),
      metric_date text not null,
      metric_value integer not null,
      live_change real,
      alltime_change real,
      gh_today_change integer,
      gh_weekly_change integer,
      gh_monthly_change integer,
      created_at text not null,
      unique(entry_id, metric_date)
    )
  `.execute(db);

  await sql`
    create table if not exists run_reports (
      id integer primary key autoincrement,
      run_date text not null unique,
      output_path text not null,
      created_at text not null
    )
  `.execute(db);
}
