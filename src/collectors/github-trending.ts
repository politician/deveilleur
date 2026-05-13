import * as cheerio from 'cheerio';

export type GitHubPeriod = 'daily' | 'weekly' | 'monthly';

export interface GitHubTrendingItem {
  source: 'GH';
  sourceKey: string;
  name: string;
  description: string | null;
  language: string | null;
  url: string;
  totalStars: number;
  ghTodayChange: number | null;
  ghWeeklyChange: number | null;
  ghMonthlyChange: number | null;
}

function parseNumericValue(text: string, fallback: number | null): number | null {
  const digits = text.replace(/[^\d]/g, '').trim();
  if (digits.length === 0) {
    return fallback;
  }

  const value = Number.parseInt(digits, 10);
  return Number.isNaN(value) ? fallback : value;
}

export function parseGitHubTrendingPage(html: string, period: GitHubPeriod): GitHubTrendingItem[] {
  const $ = cheerio.load(html);

  return $('article.Box-row')
    .map((_, element) => {
      const repoPath = $(element).find('h2 a').attr('href');
      if (!repoPath) {
        return null;
      }

      const repoFullName = repoPath.trim().replace(/^\//, '').replace(/\s+/g, '');
      const repoName = repoFullName.split('/')[1] ?? repoFullName;
      const starValues = $(element)
        .find('a[href$="/stargazers"]')
        .map((__, link) => {
          return parseNumericValue($(link).text(), 0) ?? 0;
        })
        .get();
      const trendText = $(element)
        .find('span')
        .toArray()
        .map((node) => $(node).text())
        .find((text) => text.includes('stars'));
      const trendValue = trendText ? parseNumericValue(trendText, null) : null;

      return {
        source: 'GH' as const,
        sourceKey: repoFullName,
        name: repoName,
        description: $(element).find('p').text().trim() || null,
        language: $(element).find('[itemprop="programmingLanguage"]').text().trim() || null,
        url: `https://github.com/${repoFullName}`,
        totalStars: starValues[0] ?? 0,
        ghTodayChange: period === 'daily' ? trendValue : null,
        ghWeeklyChange: period === 'weekly' ? trendValue : null,
        ghMonthlyChange: period === 'monthly' ? trendValue : null
      };
    })
    .get()
    .filter((item): item is GitHubTrendingItem => item !== null);
}

export async function collectGitHubTrending(
  fetchText: (period: GitHubPeriod) => Promise<string>
): Promise<GitHubTrendingItem[]> {
  const periods: GitHubPeriod[] = ['daily', 'weekly', 'monthly'];
  const merged = new Map<string, GitHubTrendingItem>();

  for (const period of periods) {
    const items = parseGitHubTrendingPage(await fetchText(period), period);

    for (const item of items) {
      const existing = merged.get(item.sourceKey);
      merged.set(item.sourceKey, {
        ...item,
        ghTodayChange: item.ghTodayChange ?? existing?.ghTodayChange ?? null,
        ghWeeklyChange: item.ghWeeklyChange ?? existing?.ghWeeklyChange ?? null,
        ghMonthlyChange: item.ghMonthlyChange ?? existing?.ghMonthlyChange ?? null
      });
    }
  }

  return [...merged.values()];
}
