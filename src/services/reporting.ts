export type HomebrewSource = 'HB' | 'HBC';

export type ReportRow = {
  name: string;
  url: string | null;
  metricValue: number;
  language?: string | null;
  description: string | null;
  liveChange?: number | null;
  alltimeChange?: number | null;
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
  const sign = direction === 'up' ? '+' : '';
  return `**${sign}${change}%** ${icon} `;
}

export function renderDailyReport(input: {
  githubNewcomers: ReportRow[];
  githubRisers: GitHubRisingReportRow[];
  homebrewNewcomers: HomebrewReportRow[];
  homebrewRisers: HomebrewRisingReportRow[];
  homebrewLosers: HomebrewLosingReportRow[];
}): string {
  const lines = ['# Trending tools', '', '## GitHub', '', '### Newcomers'];

  for (const row of input.githubNewcomers) {
    lines.push(`${formatName(row.name, row.url)} - ${row.metricValue} ⭐`);
    lines.push(`- *${row.language ?? 'Unknown'}*`);
    lines.push(row.description ?? '');
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const row of input.githubRisers) {
    lines.push(`${formatChange(row.liveChange, 'up')}${formatName(row.name, row.url)} - ${row.metricValue} ⭐`);
    lines.push(`- *${row.language ?? 'Unknown'}*`);
    lines.push(row.description ?? '');
    lines.push('');
  }

  lines.push('## HomeBrew (30 days)', '', '### Newcomers', '');
  for (const row of input.homebrewNewcomers) {
    lines.push(`${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('install', row.source, row.name)}\``);
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const row of input.homebrewRisers) {
    lines.push(`${formatChange(row.liveChange, 'up')}${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('install', row.source, row.name)}\``);
    lines.push('');
  }

  lines.push('### Losers', '');
  for (const row of input.homebrewLosers) {
    lines.push(`${formatChange(row.alltimeChange, 'down')}${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('uninstall', row.source, row.name)}\``);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}
