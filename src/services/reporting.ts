type HomebrewSource = 'HB' | 'HBC';

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

function brewPrefix(source: HomebrewSource): string {
  return source === 'HBC' ? '🖥️' : '>_';
}

function brewCommand(verb: 'install' | 'uninstall', source: HomebrewSource, name: string): string {
  const caskFlag = source === 'HBC' ? '--cask ' : '';
  return `brew ${verb} ${caskFlag}${name}`.trim();
}

function formatName(name: string, url: string | null): string {
  return url ? `[**${name}**](${url})` : `**${name}**`;
}

export function renderDailyReport(input: {
  githubNewcomers: ReportRow[];
  githubRisers: ReportRow[];
  homebrewNewcomers: HomebrewReportRow[];
  homebrewRisers: HomebrewReportRow[];
  homebrewLosers: HomebrewReportRow[];
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
    lines.push(`**+${row.liveChange}%** 📈 ${formatName(row.name, row.url)} - ${row.metricValue} ⭐`);
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
    lines.push(`**+${row.liveChange}%** 📈 ${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('install', row.source, row.name)}\``);
    lines.push('');
  }

  lines.push('### Losers', '');
  for (const row of input.homebrewLosers) {
    lines.push(`**${row.alltimeChange}%** 📉 ${brewPrefix(row.source)} ${formatName(row.name, row.url)} - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('uninstall', row.source, row.name)}\``);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}
