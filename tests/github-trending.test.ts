/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';

import { collectGitHubTrending, parseGitHubTrendingPage, type GitHubPeriod } from '../src/collectors/github-trending.js';
import html from './fixtures/github-trending.html?raw';

describe('parseGitHubTrendingPage', () => {
  it('extracts repo metadata and per-period star deltas', () => {
    const items = parseGitHubTrendingPage(html, 'daily');

    expect(items).toEqual([
      {
        source: 'GH',
        sourceKey: 'zed-industries/zed',
        name: 'zed',
        description: 'Code editor for high-agency developers',
        language: 'Rust',
        url: 'https://github.com/zed-industries/zed',
        totalStars: 52731,
        ghTodayChange: 842,
        ghWeeklyChange: null,
        ghMonthlyChange: null
      }
    ]);
  });

  it('ignores malformed articles without a repository link', () => {
    const malformedHtml = `${html}
<article class="Box-row"><h2>No link</h2></article>`;

    expect(parseGitHubTrendingPage(malformedHtml, 'daily')).toEqual([
      {
        source: 'GH',
        sourceKey: 'zed-industries/zed',
        name: 'zed',
        description: 'Code editor for high-agency developers',
        language: 'Rust',
        url: 'https://github.com/zed-industries/zed',
        totalStars: 52731,
        ghTodayChange: 842,
        ghWeeklyChange: null,
        ghMonthlyChange: null
      }
    ]);
  });

  it('falls back to the full repo key when the repo name segment is missing', () => {
    const malformedHtml = html.replace('/zed-industries/zed', '/zed-industries');

    expect(parseGitHubTrendingPage(malformedHtml, 'daily')).toEqual([
      {
        source: 'GH',
        sourceKey: 'zed-industries',
        name: 'zed-industries',
        description: 'Code editor for high-agency developers',
        language: 'Rust',
        url: 'https://github.com/zed-industries',
        totalStars: 52731,
        ghTodayChange: 842,
        ghWeeklyChange: null,
        ghMonthlyChange: null
      }
    ]);
  });


  it('defaults invalid star counts and trend deltas safely', () => {
    const malformedHtml = html
      .replace('52,731', 'not-a-number')
      .replace('842 stars today', 'stars today');

    expect(parseGitHubTrendingPage(malformedHtml, 'daily')).toEqual([
      {
        source: 'GH',
        sourceKey: 'zed-industries/zed',
        name: 'zed',
        description: 'Code editor for high-agency developers',
        language: 'Rust',
        url: 'https://github.com/zed-industries/zed',
        totalStars: 0,
        ghTodayChange: null,
        ghWeeklyChange: null,
        ghMonthlyChange: null
      }
    ]);
  });
});

describe('collectGitHubTrending', () => {
  it('merges daily, weekly, and monthly sightings by repo', async () => {
    const fetchText = async (period: GitHubPeriod) => html.replace('842 stars today', period === 'daily' ? '842 stars today' : period === 'weekly' ? '1900 stars this week' : '4300 stars this month');

    const repos = await collectGitHubTrending(fetchText);

    expect(repos[0]).toMatchObject({
      sourceKey: 'zed-industries/zed',
      ghTodayChange: 842,
      ghWeeklyChange: 1900,
      ghMonthlyChange: 4300
    });
  });

  it('preserves the first totalStars value when later periods disagree', async () => {
    const fetchText = async (period: GitHubPeriod) => {
      const totalStars = period === 'daily' ? '52,731' : period === 'weekly' ? '99,999' : '12,345';
      const trendText = period === 'daily' ? '842 stars today' : period === 'weekly' ? '1900 stars this week' : '4300 stars this month';

      return html.replace('52,731', totalStars).replace('842 stars today', trendText);
    };

    const repos = await collectGitHubTrending(fetchText);

    expect(repos[0]).toMatchObject({
      sourceKey: 'zed-industries/zed',
      totalStars: 52731,
      ghTodayChange: 842,
      ghWeeklyChange: 1900,
      ghMonthlyChange: 4300
    });
  });

  it('starts fetching each period before awaiting responses', async () => {
    const requestedPeriods: GitHubPeriod[] = [];
    const resolvers = new Map<GitHubPeriod, (value: string) => void>();
    const htmlByPeriod = {
      daily: html.replace('842 stars today', '842 stars today'),
      weekly: html.replace('842 stars today', '1900 stars this week'),
      monthly: html.replace('842 stars today', '4300 stars this month')
    } satisfies Record<GitHubPeriod, string>;
    const fetchText = (period: GitHubPeriod) => {
      requestedPeriods.push(period);

      return new Promise<string>((resolve) => {
        resolvers.set(period, resolve);
      });
    };

    const pendingRepos = collectGitHubTrending(fetchText);
    await Promise.resolve();

    expect(requestedPeriods).toEqual(['daily', 'weekly', 'monthly']);

    for (const period of requestedPeriods) {
      resolvers.get(period)?.(htmlByPeriod[period]);
    }

    const repos = await pendingRepos;

    expect(repos[0]).toMatchObject({
      sourceKey: 'zed-industries/zed',
      ghTodayChange: 842,
      ghWeeklyChange: 1900,
      ghMonthlyChange: 4300
    });
  });
});
