import type { Generated } from 'kysely';

export type Source = 'GH' | 'HB' | 'HBC';

export interface EntriesTable {
  id: Generated<number>;
  source: Source;
  source_key: string;
  name: string;
  description: string | null;
  language: string | null;
  url: string | null;
  dependency: Generated<number>;
  first_seen_at: string;
  updated_at: string;
}

export interface DailyMetricsTable {
  id: Generated<number>;
  entry_id: number;
  metric_date: string;
  metric_value: number;
  live_change: number | null;
  alltime_change: number | null;
  gh_today_change: number | null;
  gh_weekly_change: number | null;
  gh_monthly_change: number | null;
  created_at: string;
}

export interface RunReportsTable {
  id: Generated<number>;
  run_date: string;
  output_path: string;
  created_at: string;
}

export interface DatabaseSchema {
  entries: EntriesTable;
  daily_metrics: DailyMetricsTable;
  run_reports: RunReportsTable;
}
