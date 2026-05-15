import fs from 'node:fs/promises';
import { sql } from 'kysely';

import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { createDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import type { RunDailyGithubItem, RunDailyHomebrewItem } from '../src/commands/run-daily.js';
import { runDaily } from '../src/commands/run-daily.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('runDaily', () => {
  it('exports named item input types', () => {
    expectTypeOf<RunDailyGithubItem['source']>().toEqualTypeOf<'GH'>();
    expectTypeOf<RunDailyHomebrewItem['source']>().toEqualTypeOf<'HB' | 'HBC'>();
  });

  it('writes a dated report file and records it in the database', async () => {
    const outputPath = 'reports/2026-05-13.md';

    try {
      const result = await runDaily({
        runDate: '2026-05-13',
        databasePath: ':memory:',
        reportsDir: 'reports',
        githubItems: [
          {
            source: 'GH',
            sourceKey: 'zed-industries/zed',
            name: 'zed',
            description: 'Code editor for high-agency developers',
            language: 'Rust',
            url: 'https://github.com/zed-industries/zed',
            totalStars: 52731,
            ghTodayChange: 842,
            ghWeeklyChange: 1900,
            ghMonthlyChange: 4300
          }
        ],
        homebrewItems: [
          {
            source: 'HB',
            sourceKey: 'bat',
            name: 'bat',
            description: 'Clone of cat(1) with wings.',
            language: null,
            url: 'https://github.com/sharkdp/bat',
            dependency: false,
            metricValue: 120034
          }
        ]
      });

      expect(result.outputPath).toBe(outputPath);
      expect(result.markdown).toContain('# Trending tools');
      expect(result.reportRecorded).toBe(true);
    } finally {
      await fs.rm(outputPath, { force: true });
    }
  });

  it('stores an ISO created_at timestamp and keeps it immutable on conflict', async () => {
    const databasePath = 'data/run-daily-created-at.sqlite';
    const outputPath = 'reports/2026-05-13.md';

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date('2026-05-13T08:00:00.000Z'));
      await runDaily({
        runDate: '2026-05-13',
        databasePath,
        reportsDir: 'reports',
        githubItems: [],
        homebrewItems: []
      });

      vi.setSystemTime(new Date('2026-05-13T09:30:00.000Z'));
      await runDaily({
        runDate: '2026-05-13',
        databasePath,
        reportsDir: 'reports',
        githubItems: [],
        homebrewItems: []
      });

      const db = createDatabase(databasePath);
      await migrate(db);

      const row = await sql<{ created_at: string }>`
        select created_at
        from run_reports
        where run_date = '2026-05-13'
      `.execute(db);

      await db.destroy();

      expect(row.rows[0]?.created_at).toBe('2026-05-13T08:00:00.000Z');
    } finally {
      vi.useRealTimers();
      await fs.rm(databasePath, { force: true });
      await fs.rm(outputPath, { force: true });
    }
  });

  it('destroys the database when report writing fails', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    vi.doMock('node:fs/promises', () => ({
      default: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockRejectedValue(new Error('write failed'))
      }
    }));
    vi.doMock('../src/db/database.js', () => ({
      createDatabase: vi.fn(() => ({ destroy }))
    }));
    vi.doMock('../src/db/migrate.js', () => ({
      migrate: vi.fn().mockResolvedValue(undefined)
    }));
    vi.doMock('../src/services/catalog.js', () => ({
      upsertEntry: vi.fn()
    }));
    vi.doMock('../src/services/metrics.js', () => ({
      recordDailyMetric: vi.fn()
    }));
    vi.doMock('../src/services/reporting.js', () => ({
      selectReportData: vi.fn().mockResolvedValue({
        githubNewcomers: [],
        githubRisers: [],
        homebrewNewcomers: [],
        homebrewRisers: [],
        homebrewLosers: []
      }),
      renderDailyReport: vi.fn().mockReturnValue('# Report')
    }));

    const { runDaily: mockedRunDaily } = await import('../src/commands/run-daily.js');

    await expect(
      mockedRunDaily({
        runDate: '2026-05-13',
        databasePath: ':memory:',
        reportsDir: 'reports',
        githubItems: [],
        homebrewItems: []
      })
    ).rejects.toThrow('write failed');
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
