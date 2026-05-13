import { describe, expect, it } from 'vitest';

import { createDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { upsertEntry } from '../src/services/catalog.js';
import { recordDailyMetric } from '../src/services/metrics.js';

describe('upsertEntry', () => {
  it('updates an existing entry without changing first_seen_at', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const firstId = await upsertEntry(db, {
      source: 'HB',
      sourceKey: 'bat',
      name: 'bat',
      description: 'Original',
      language: null,
      url: 'https://example.com/original',
      dependency: false,
      seenAt: '2026-05-13'
    });

    const secondId = await upsertEntry(db, {
      source: 'HB',
      sourceKey: 'bat',
      name: 'batcat',
      description: 'Updated',
      language: 'Rust',
      url: 'https://example.com/updated',
      dependency: true,
      seenAt: '2026-05-14'
    });

    const row = await db
      .selectFrom('entries')
      .selectAll()
      .where('id', '=', firstId)
      .executeTakeFirstOrThrow();

    expect(secondId).toBe(firstId);
    expect(row.name).toBe('batcat');
    expect(row.description).toBe('Updated');
    expect(row.language).toBe('Rust');
    expect(row.url).toBe('https://example.com/updated');
    expect(row.dependency).toBe(1);
    expect(row.first_seen_at).toBe('2026-05-13');
    expect(row.updated_at).toBe('2026-05-14');

    await db.destroy();
  });
});

describe('recordDailyMetric', () => {
  it('computes live_change and alltime_change for homebrew rows', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const entryId = await upsertEntry(db, {
      source: 'HB',
      sourceKey: 'bat',
      name: 'bat',
      description: 'Clone of cat(1) with wings.',
      language: null,
      url: 'https://github.com/sharkdp/bat',
      dependency: false,
      seenAt: '2026-05-13'
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-13',
      metricValue: 100,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    const second = await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-14',
      metricValue: 125,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    expect(second.live_change).toBe(25);
    expect(second.alltime_change).toBe(25);

    await db.destroy();
  });

  it('leaves alltime_change null for github rows', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const entryId = await upsertEntry(db, {
      source: 'GH',
      sourceKey: 'zed-industries/zed',
      name: 'zed',
      description: 'Code editor for high-agency developers',
      language: 'Rust',
      url: 'https://github.com/zed-industries/zed',
      dependency: false,
      seenAt: '2026-05-13'
    });

    const row = await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-13',
      metricValue: 52731,
      ghTodayChange: 842,
      ghWeeklyChange: 1900,
      ghMonthlyChange: 4300
    });

    expect(row.alltime_change).toBeNull();
    expect(row.gh_today_change).toBe(842);
    expect(row.gh_weekly_change).toBe(1900);
    expect(row.gh_monthly_change).toBe(4300);

    await db.destroy();
  });

  it('uses the most recent earlier metric when recording out of order', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const entryId = await upsertEntry(db, {
      source: 'HB',
      sourceKey: 'bat',
      name: 'bat',
      description: 'Clone of cat(1) with wings.',
      language: null,
      url: 'https://github.com/sharkdp/bat',
      dependency: false,
      seenAt: '2026-05-13'
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-13',
      metricValue: 100,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-15',
      metricValue: 200,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    const row = await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-14',
      metricValue: 150,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    expect(row.live_change).toBe(50);
    expect(row.alltime_change).toBe(50);

    await db.destroy();
  });

  it('recomputes later rows when an earlier metric is inserted later', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const entryId = await upsertEntry(db, {
      source: 'HB',
      sourceKey: 'bat',
      name: 'bat',
      description: 'Clone of cat(1) with wings.',
      language: null,
      url: 'https://github.com/sharkdp/bat',
      dependency: false,
      seenAt: '2026-05-13'
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-13',
      metricValue: 100,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-15',
      metricValue: 200,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-14',
      metricValue: 150,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    const row = await db
      .selectFrom('daily_metrics')
      .selectAll()
      .where('entry_id', '=', entryId)
      .where('metric_date', '=', '2026-05-15')
      .executeTakeFirstOrThrow();

    expect(row.live_change).toBe(33.33);
    expect(row.alltime_change).toBe(100);

    await db.destroy();
  });

  it('leaves live_change and alltime_change null when the baseline metric is zero', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const entryId = await upsertEntry(db, {
      source: 'HB',
      sourceKey: 'bat',
      name: 'bat',
      description: 'Clone of cat(1) with wings.',
      language: null,
      url: 'https://github.com/sharkdp/bat',
      dependency: false,
      seenAt: '2026-05-13'
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-13',
      metricValue: 0,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    const row = await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-14',
      metricValue: 125,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    expect(row.live_change).toBeNull();
    expect(row.alltime_change).toBeNull();

    await db.destroy();
  });
});
