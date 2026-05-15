import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('main', () => {
  it('prints the run-daily usage when called with --help', async () => {
    const { main } = await import('../src/cli.js');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await main(['--help']);

    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith('Usage: tool-discovery run-daily');
  });

  it('prints the report path after run-daily succeeds', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.doMock('../src/collectors/github-trending.js', () => ({
      collectGitHubTrending: vi.fn().mockResolvedValue([]),
      fetchGitHubTrendingPage: vi.fn()
    }));
    vi.doMock('../src/collectors/homebrew.js', () => ({
      fetchHomebrewAnalytics: vi.fn().mockResolvedValue([])
    }));
    vi.doMock('../src/commands/run-daily.js', () => ({
      runDaily: vi.fn().mockResolvedValue({
        outputPath: 'reports/2026-05-13.md',
        markdown: '# Trending tools\n',
        reportRecorded: true
      })
    }));

    const { main } = await import('../src/cli.js');

    const exitCode = await main(['run-daily']);

    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith('Report written to reports/2026-05-13.md');
  });
});
