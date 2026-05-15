import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../db/schema.js';

// --- JSON report types ---

export type HomebrewKind = 'formula' | 'cask';

export interface GithubEntry {
  name: string;
  url: string | null;
  stars: number;
  language: string | null;
  description: string | null;
}

export interface GithubRiserEntry extends GithubEntry {
  changePercent: number | null;
}

export interface HomebrewEntry {
  name: string;
  url: string | null;
  installs: number;
  description: string | null;
  kind: HomebrewKind;
}

export interface HomebrewRiserEntry extends HomebrewEntry {
  changePercent: number | null;
}

export interface HomebrewLoserEntry extends HomebrewEntry {
  changePercent: number | null;
}

export interface ReportJson {
  github: {
    newcomers: GithubEntry[];
    risers: GithubRiserEntry[];
  };
  homebrew: {
    newcomers: HomebrewEntry[];
    risers: HomebrewRiserEntry[];
    losers: HomebrewLoserEntry[];
  };
}

// --- Helpers ---

export function brewKind(source: 'HB' | 'HBC'): HomebrewKind {
  return source === 'HBC' ? 'cask' : 'formula';
}

export function brewPrefix(kind: HomebrewKind): string {
  return kind === 'cask' ? '🖥️' : '`>_`';
}

export function brewCommand(
  verb: 'install' | 'uninstall',
  kind: HomebrewKind,
  name: string
): string {
  const caskFlag = kind === 'cask' ? '--cask ' : '';
  return `brew ${verb} ${caskFlag}${name}`.trim();
}

// --- Markdown rendering ---

function formatName(name: string, url: string | null): string {
  return url ? `[**${name}**](${url})` : `**${name}**`;
}

function formatChange(
  change: number | null | undefined,
  direction: 'up' | 'down'
): string {
  if (change == null) return '';
  const icon = direction === 'up' ? '📈' : '📉';
  const normalized = direction === 'up' ? Math.abs(change) : -Math.abs(change);
  const sign = normalized > 0 ? '+' : '';
  return `**${sign}${normalized}%** ${icon}`;
}

export function renderDailyReport(report: ReportJson): string {
  const lines = ['# Trending tools', '', '## GitHub', '', '### Newcomers', ''];

  for (const entry of report.github.newcomers) {
    const lang = entry.language ? ` · *${entry.language}*` : '';
    lines.push(`${formatName(entry.name, entry.url)} - ${entry.stars} ⭐${lang}`);
    if (entry.description) lines.push(entry.description);
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const entry of report.github.risers) {
    const change = formatChange(entry.changePercent, 'up');
    const lang = entry.language ? ` · *${entry.language}*` : '';
    lines.push(
      `${change}${change ? ' ' : ''}${formatName(entry.name, entry.url)} - ${entry.stars} ⭐${lang}`
    );
    if (entry.description) lines.push(entry.description);
    lines.push('');
  }

  lines.push('## Homebrew (30 days)', '', '### Newcomers', '');
  for (const entry of report.homebrew.newcomers) {
    lines.push(
      `${brewPrefix(entry.kind)} ${formatName(entry.name, entry.url)} - ${entry.installs} 📥`
    );
    if (entry.description) lines.push(entry.description);
    lines.push(`\`${brewCommand('install', entry.kind, entry.name)}\``);
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const entry of report.homebrew.risers) {
    const change = formatChange(entry.changePercent, 'up');
    lines.push(
      `${change}${change ? ' ' : ''}${brewPrefix(entry.kind)} ${formatName(entry.name, entry.url)} - ${entry.installs} 📥`
    );
    if (entry.description) lines.push(entry.description);
    lines.push(`\`${brewCommand('install', entry.kind, entry.name)}\``);
    lines.push('');
  }

  lines.push('### Losers', '');
  for (const entry of report.homebrew.losers) {
    const change = formatChange(entry.changePercent, 'down');
    lines.push(
      `${change}${change ? ' ' : ''}${brewPrefix(entry.kind)} ${formatName(entry.name, entry.url)} - ${entry.installs} 📥`
    );
    if (entry.description) lines.push(entry.description);
    lines.push(`\`${brewCommand('uninstall', entry.kind, entry.name)}\``);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

// --- DB queries ---

export async function selectReportData(
  db: Kysely<DatabaseSchema>,
  runDate: string
): Promise<ReportJson> {
  const rawGhNewcomers = await db
    .selectFrom('entries')
    .innerJoin('daily_metrics', 'daily_metrics.entry_id', 'entries.id')
    .select([
      'entries.name',
      'entries.url',
      'entries.language',
      'entries.description',
      'daily_metrics.metric_value'
    ])
    .where('entries.source', '=', 'GH')
    .where('entries.first_seen_at', '=', runDate)
    .where('daily_metrics.metric_date', '=', runDate)
    .orderBy('daily_metrics.metric_value', 'desc')
    .limit(25)
    .execute();

  const rawGhRisers = await db
    .selectFrom('entries')
    .innerJoin('daily_metrics', 'daily_metrics.entry_id', 'entries.id')
    .select([
      'entries.name',
      'entries.url',
      'entries.language',
      'entries.description',
      'daily_metrics.metric_value',
      'daily_metrics.live_change'
    ])
    .where('entries.source', '=', 'GH')
    .where('daily_metrics.metric_date', '=', runDate)
    .where('daily_metrics.live_change', 'is not', null)
    .where('daily_metrics.live_change', '>', 0)
    .where('entries.first_seen_at', '!=', runDate)
    .orderBy('daily_metrics.live_change', 'desc')
    .limit(10)
    .execute();

  const rawHbNewcomers = await db
    .selectFrom('entries')
    .innerJoin('daily_metrics', 'daily_metrics.entry_id', 'entries.id')
    .select([
      'entries.name',
      'entries.url',
      'entries.description',
      'entries.source',
      'daily_metrics.metric_value'
    ])
    .where('entries.source', 'in', ['HB', 'HBC'])
    .where('entries.first_seen_at', '=', runDate)
    .where('entries.dependency', '=', 0)
    .where('daily_metrics.metric_date', '=', runDate)
    .orderBy('daily_metrics.metric_value', 'desc')
    .limit(25)
    .execute();

  const rawHbRisers = await db
    .selectFrom('entries')
    .innerJoin('daily_metrics', 'daily_metrics.entry_id', 'entries.id')
    .select([
      'entries.name',
      'entries.url',
      'entries.description',
      'entries.source',
      'daily_metrics.metric_value',
      'daily_metrics.live_change'
    ])
    .where('entries.source', 'in', ['HB', 'HBC'])
    .where('entries.dependency', '=', 0)
    .where('daily_metrics.metric_date', '=', runDate)
    .where('daily_metrics.live_change', 'is not', null)
    .where('daily_metrics.live_change', '>', 0)
    .where('entries.first_seen_at', '!=', runDate)
    .orderBy('daily_metrics.live_change', 'desc')
    .limit(10)
    .execute();

  const rawHbLosers = await db
    .selectFrom('entries')
    .innerJoin('daily_metrics', 'daily_metrics.entry_id', 'entries.id')
    .select([
      'entries.name',
      'entries.url',
      'entries.description',
      'entries.source',
      'daily_metrics.metric_value',
      'daily_metrics.alltime_change'
    ])
    .where('entries.source', 'in', ['HB', 'HBC'])
    .where('entries.dependency', '=', 0)
    .where('daily_metrics.metric_date', '=', runDate)
    .where('daily_metrics.alltime_change', 'is not', null)
    .where('daily_metrics.alltime_change', '<', 0)
    .orderBy('daily_metrics.alltime_change', 'asc')
    .limit(10)
    .execute();

  return {
    github: {
      newcomers: rawGhNewcomers.map((row) => ({
        name: row.name,
        url: row.url,
        stars: row.metric_value,
        language: row.language,
        description: row.description
      })),
      risers: rawGhRisers.map((row) => ({
        name: row.name,
        url: row.url,
        stars: row.metric_value,
        language: row.language,
        description: row.description,
        changePercent: row.live_change
      }))
    },
    homebrew: {
      newcomers: rawHbNewcomers.map((row) => ({
        name: row.name,
        url: row.url,
        installs: row.metric_value,
        description: row.description,
        kind: brewKind(row.source as 'HB' | 'HBC')
      })),
      risers: rawHbRisers.map((row) => ({
        name: row.name,
        url: row.url,
        installs: row.metric_value,
        description: row.description,
        kind: brewKind(row.source as 'HB' | 'HBC'),
        changePercent: row.live_change
      })),
      losers: rawHbLosers.map((row) => ({
        name: row.name,
        url: row.url,
        installs: row.metric_value,
        description: row.description,
        kind: brewKind(row.source as 'HB' | 'HBC'),
        changePercent: row.alltime_change
      }))
    }
  };
}
