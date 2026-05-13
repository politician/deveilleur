import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../db/schema.js';

function pctChange(previous: number, current: number): number | null {
  if (previous === 0) {
    return null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
}

async function buildMetricRow(
  db: Kysely<DatabaseSchema>,
  input: {
    entryId: number;
    metricDate: string;
    metricValue: number;
    ghTodayChange: number | null;
    ghWeeklyChange: number | null;
    ghMonthlyChange: number | null;
    createdAt: string;
  },
  source: DatabaseSchema['entries']['source']
) {
  const previous = await db
    .selectFrom('daily_metrics')
    .select(['metric_value'])
    .where('entry_id', '=', input.entryId)
    .where('metric_date', '<', input.metricDate)
    .orderBy('metric_date', 'desc')
    .executeTakeFirst();

  const first = await db
    .selectFrom('daily_metrics')
    .select(['metric_value'])
    .where('entry_id', '=', input.entryId)
    .where('metric_date', '<=', input.metricDate)
    .orderBy('metric_date', 'asc')
    .executeTakeFirst();

  return {
    entry_id: input.entryId,
    metric_date: input.metricDate,
    metric_value: input.metricValue,
    live_change: previous ? pctChange(previous.metric_value, input.metricValue) : null,
    alltime_change: source === 'GH' || !first ? null : pctChange(first.metric_value, input.metricValue),
    gh_today_change: input.ghTodayChange,
    gh_weekly_change: input.ghWeeklyChange,
    gh_monthly_change: input.ghMonthlyChange,
    created_at: input.createdAt
  };
}

export async function recordDailyMetric(
  db: Kysely<DatabaseSchema>,
  input: {
    entryId: number;
    metricDate: string;
    metricValue: number;
    ghTodayChange: number | null;
    ghWeeklyChange: number | null;
    ghMonthlyChange: number | null;
  }
) {
  const entry = await db
    .selectFrom('entries')
    .select(['source'])
    .where('id', '=', input.entryId)
    .executeTakeFirstOrThrow();

  const row = await buildMetricRow(
    db,
    {
      entryId: input.entryId,
      metricDate: input.metricDate,
      metricValue: input.metricValue,
      ghTodayChange: input.ghTodayChange,
      ghWeeklyChange: input.ghWeeklyChange,
      ghMonthlyChange: input.ghMonthlyChange,
      createdAt: input.metricDate
    },
    entry.source
  );

  await db
    .insertInto('daily_metrics')
    .values(row)
    .onConflict((oc) => oc.columns(['entry_id', 'metric_date']).doUpdateSet(row))
    .execute();

  const laterRows = await db
    .selectFrom('daily_metrics')
    .select([
      'metric_date',
      'metric_value',
      'gh_today_change',
      'gh_weekly_change',
      'gh_monthly_change',
      'created_at'
    ])
    .where('entry_id', '=', input.entryId)
    .where('metric_date', '>', input.metricDate)
    .orderBy('metric_date', 'asc')
    .execute();

  for (const laterRow of laterRows) {
    const recomputedRow = await buildMetricRow(
      db,
      {
        entryId: input.entryId,
        metricDate: laterRow.metric_date,
        metricValue: laterRow.metric_value,
        ghTodayChange: laterRow.gh_today_change,
        ghWeeklyChange: laterRow.gh_weekly_change,
        ghMonthlyChange: laterRow.gh_monthly_change,
        createdAt: laterRow.created_at
      },
      entry.source
    );

    await db
      .insertInto('daily_metrics')
      .values(recomputedRow)
      .onConflict((oc) => oc.columns(['entry_id', 'metric_date']).doUpdateSet(recomputedRow))
      .execute();
  }

  return db
    .selectFrom('daily_metrics')
    .selectAll()
    .where('entry_id', '=', input.entryId)
    .where('metric_date', '=', input.metricDate)
    .executeTakeFirstOrThrow();
}
