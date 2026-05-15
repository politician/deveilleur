export type HomebrewSource = 'HB' | 'HBC';

import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../db/schema.js';

export type ReportRow = {
  name: string;
  url: string | null;
  metricValue: number;
  language?: string | null;
  description: string | null;
};

export type HomebrewReportRow = ReportRow & {
  source: HomebrewSource;
};

export type GitHubRisingReportRow = ReportRow & {
  liveChange: number | null;
};

export type HomebrewRisingReportRow = HomebrewReportRow & {
  liveChange: number | null;
};

export type HomebrewLosingReportRow = HomebrewReportRow & {
  alltimeChange: number | null;
};

export function brewPrefix(source: HomebrewSource): string {
  return source === 'HBC' ? '🖥️' : '>_';
}

export function brewCommand(verb: 'install' | 'uninstall', source: HomebrewSource, name: string): string {
  const caskFlag = source === 'HBC' ? '--cask ' : '';
  return `brew ${verb} ${caskFlag}${name}`.trim();
}

function formatName(name: string, url: string | null): string {
  return url ? `[**${name}**](${url})` : `**${name}**`;
}

function formatChange(change: number | null | undefined, direction: 'up' | 'down'): string {
  if (change == null) {
    return '';
  }

  const icon = direction === 'up' ? '📈' : '📉';
  const normalizedChange = direction === 'up' ? Math.abs(change) : -Math.abs(change);
  const sign = normalizedChange > 0 ? '+' : '';
  return `**${sign}${normalizedChange}%** ${icon}`;
}

export function renderDailyReport(input: {
  githubNewcomers: ReportRow[];
  githubRisers: GitHubRisingReportRow[];
  homebrewNewcomers: HomebrewReportRow[];
  homebrewRisers: HomebrewRisingReportRow[];
  homebrewLosers: HomebrewLosingReportRow[];
}): string {
  const lines = ['# Trending tools', '', '## GitHub', '', '### Newcomers', ''];

  for (const row of input.githubNewcomers) {
    lines.push(`${formatName(row.name, row.url)} - ${row.metricValue} ⭐`);
    lines.push(`- *${row.language ?? 'Unknown'}*`);
    lines.push(row.description ?? '');
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const row of input.githubRisers) {
    const formattedChange = formatChange(row.liveChange, 'up');
    lines.push(`${formattedChange}${formattedChange ? ' ' : ''}${formatName(row.name, row.url)} - ${row.metricValue} ⭐`);
    lines.push(`- *${row.language ?? 'Unknown'}*`);
    lines.push(row.description ?? '');
    lines.push('');
  }

  lines.push('## Homebrew (30 days)', '', '### Newcomers', '');
  for (const row of input.homebrewNewcomers) {
    lines.push(`${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('install', row.source, row.name)}\``);
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const row of input.homebrewRisers) {
    const formattedChange = formatChange(row.liveChange, 'up');
    lines.push(`${formattedChange}${formattedChange ? ' ' : ''}${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('install', row.source, row.name)}\``);
    lines.push('');
  }

  lines.push('### Losers', '');
  for (const row of input.homebrewLosers) {
    const formattedChange = formatChange(row.alltimeChange, 'down');
    lines.push(`${formattedChange}${formattedChange ? ' ' : ''}${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('uninstall', row.source, row.name)}\``);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export async function selectReportData(
  db: Kysely<DatabaseSchema>,
  runDate: string
): Promise<{
  githubNewcomers: ReportRow[];
  githubRisers: GitHubRisingReportRow[];
  homebrewNewcomers: HomebrewReportRow[];
  homebrewRisers: HomebrewRisingReportRow[];
  homebrewLosers: HomebrewLosingReportRow[];
}> {
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

  const githubNewcomers: ReportRow[] = rawGhNewcomers.map((row) => ({
    name: row.name,
    url: row.url,
    metricValue: row.metric_value,
    language: row.language,
    description: row.description
  }));

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

  const githubRisers: GitHubRisingReportRow[] = rawGhRisers.map((row) => ({
    name: row.name,
    url: row.url,
    metricValue: row.metric_value,
    language: row.language,
    description: row.description,
    liveChange: row.live_change
  }));

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

  const homebrewNewcomers: HomebrewReportRow[] = rawHbNewcomers.map((row) => ({
    name: row.name,
    url: row.url,
    metricValue: row.metric_value,
    description: row.description,
    source: row.source as HomebrewSource
  }));

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

  const homebrewRisers: HomebrewRisingReportRow[] = rawHbRisers.map((row) => ({
    name: row.name,
    url: row.url,
    metricValue: row.metric_value,
    description: row.description,
    source: row.source as HomebrewSource,
    liveChange: row.live_change
  }));

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

  const homebrewLosers: HomebrewLosingReportRow[] = rawHbLosers.map((row) => ({
    name: row.name,
    url: row.url,
    metricValue: row.metric_value,
    description: row.description,
    source: row.source as HomebrewSource,
    alltimeChange: row.alltime_change
  }));

  return {
    githubNewcomers,
    githubRisers,
    homebrewNewcomers,
    homebrewRisers,
    homebrewLosers
  };
}
