import { describe, expect, it } from 'vitest';

import { collectGitHubTrending, parseGitHubTrendingPage, type GitHubPeriod } from '../src/collectors/github-trending.js';
// @ts-expect-error Vite resolves ?raw imports at runtime.
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
