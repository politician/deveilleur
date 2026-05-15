type ReportRow = {
  name: string;
  url: string | null;
  metricValue: number;
  language?: string | null;
  description: string | null;
  source?: 'HB' | 'HBC';
  liveChange?: number | null;
  alltimeChange?: number | null;
};

function brewPrefix(source: 'HB' | 'HBC'): string {
  return source === 'HBC' ? '🖥️' : '>_';
}

function brewCommand(verb: 'install' | 'uninstall', source: 'HB' | 'HBC', name: string): string {
  const caskFlag = source === 'HBC' ? '--cask ' : '';
  return `brew ${verb} ${caskFlag}${name}`.trim();
}

export function renderDailyReport(input: {
  githubNewcomers: ReportRow[];
  githubRisers: ReportRow[];
  homebrewNewcomers: ReportRow[];
  homebrewRisers: ReportRow[];
  homebrewLosers: ReportRow[];
}): string {
  const lines = ['# Trending tools', '', '## GitHub', '', '### Newcomers'];

  for (const row of input.githubNewcomers) {
    lines.push(`[**${row.name}**](${row.url}) - ${row.metricValue} ⭐`);
    lines.push(`- *${row.language ?? 'Unknown'}*`);
    lines.push(row.description ?? '');
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const row of input.githubRisers) {
    lines.push(`**+${row.liveChange}%** 📈 [**${row.name}**](${row.url}) - ${row.metricValue} ⭐`);
    lines.push(`- *${row.language ?? 'Unknown'}*`);
    lines.push(row.description ?? '');
    lines.push('');
  }

  lines.push('## HomeBrew (30 days)', '', '### Newcomers', '');
  for (const row of input.homebrewNewcomers) {
    lines.push(`${brewPrefix(row.source!)} [**${row.name}**](${row.url}) - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('install', row.source!, row.name)}\``);
    lines.push('');
  }

  lines.push('### Risers', '');
  for (const row of input.homebrewRisers) {
    lines.push(`**+${row.liveChange}%** 📈 ${brewPrefix(row.source!)} [**${row.name}**](${row.url}) - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('install', row.source!, row.name)}\``);
    lines.push('');
  }

  lines.push('### Losers', '');
  for (const row of input.homebrewLosers) {
    lines.push(`**${row.alltimeChange}%** 📉 ${brewPrefix(row.source!)} [**${row.name}**](${row.url}) - ${row.metricValue} 📥`);
    lines.push(row.description ?? '');
    lines.push(`\`${brewCommand('uninstall', row.source!, row.name)}\``);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}
