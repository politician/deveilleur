import fs from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runDaily } from '../src/commands/run-daily.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('runDaily', () => {
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
