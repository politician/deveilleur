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
    expect(log).toHaveBeenCalledWith('Usage: tool-discovery run-daily [--telegram-html]');
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

  it('passes --telegram-html through to run-daily and prints the companion path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const runDaily = vi.fn().mockResolvedValue({
      outputPath: 'reports/2026-05-13.md',
      markdown: '# Trending tools\n',
      telegramHtmlPath: 'reports/2026-05-13.telegram.html',
      telegramHtml: '<b>Déveilleur daily report — 2026-05-13</b>\n',
      reportRecorded: true
    });

    vi.doMock('../src/collectors/github-trending.js', () => ({
      collectGitHubTrending: vi.fn().mockResolvedValue([]),
      fetchGitHubTrendingPage: vi.fn()
    }));
    vi.doMock('../src/collectors/homebrew.js', () => ({
      fetchHomebrewAnalytics: vi.fn().mockResolvedValue([])
    }));
    vi.doMock('../src/commands/run-daily.js', () => ({ runDaily }));

    const { main } = await import('../src/cli.js');

    const exitCode = await main(['run-daily', '--telegram-html']);

    expect(exitCode).toBe(0);
    expect(runDaily).toHaveBeenCalledWith(
      expect.objectContaining({ outputFormats: ['markdown', 'telegram-html'] })
    );
    expect(log).toHaveBeenCalledWith(
      'Telegram HTML report written to reports/2026-05-13.telegram.html'
    );
  });
});
