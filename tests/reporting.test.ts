import { describe, expect, it } from 'vitest';

import {
  brewCommand,
  brewKind,
  brewPrefix,
  renderDailyReport,
  renderTelegramReport,
  type GithubEntry,
  type GithubRiserEntry,
  type HomebrewEntry,
  type HomebrewKind,
  type HomebrewLoserEntry,
  type HomebrewRiserEntry,
  type ReportJson
} from '../src/services/reporting.js';

const kind: HomebrewKind = 'formula';

// @ts-expect-error Homebrew rows must declare their kind.
const invalidHomebrewRow: HomebrewEntry = {
  name: 'missing-kind',
  url: null,
  installs: 1,
  description: null
};

const invalidBaseRow: GithubEntry = {
  name: 'unexpected-change',
  url: null,
  stars: 1,
  language: null,
  description: null,
  // @ts-expect-error Base GitHub entries must not expose changePercent.
  changePercent: 5
};

const invalidNewcomerRow: HomebrewEntry = {
  name: 'unexpected-change',
  url: null,
  installs: 1,
  description: null,
  kind: 'formula',
  // @ts-expect-error Homebrew newcomer rows must not expose changePercent.
  changePercent: -5
};

void invalidHomebrewRow;
void invalidBaseRow;
void invalidNewcomerRow;
void kind;

function emptyReport(): ReportJson {
  return {
    github: { newcomers: [], risers: [] },
    homebrew: { newcomers: [], risers: [], losers: [] }
  };
}

describe('renderDailyReport', () => {
  it('exports the homebrew helpers as part of the reporting API', () => {
    expect(brewKind('HB')).toBe('formula');
    expect(brewKind('HBC')).toBe('cask');
    expect(brewPrefix('formula')).toBe('`>_`');
    expect(brewPrefix('cask')).toBe('🖥️');
    expect(brewCommand('install', 'formula', 'bat')).toBe('brew install bat');
    expect(brewCommand('uninstall', 'cask', 'raycast')).toBe(
      'brew uninstall --cask raycast'
    );
  });

  it('renders GH, HB, and HBC sections with the required formatting', () => {
    const report: ReportJson = {
      github: {
        newcomers: [
          {
            name: 'zed',
            url: 'https://github.com/zed-industries/zed',
            stars: 52731,
            language: 'Rust',
            description: 'Code editor for high-agency developers'
          }
        ],
        risers: []
      },
      homebrew: {
        newcomers: [
          {
            name: 'bat',
            url: 'https://github.com/sharkdp/bat',
            installs: 120034,
            description: 'Clone of cat(1) with wings.',
            kind: 'formula'
          }
        ],
        risers: [],
        losers: [
          {
            name: 'raycast',
            url: 'https://www.raycast.com/',
            installs: 15500,
            description: 'Control your tools with a few keystrokes',
            kind: 'cask',
            changePercent: -35
          }
        ]
      }
    };

    const markdown = renderDailyReport(report);

    expect(markdown).toContain('## Homebrew (30 days)');
    expect(markdown).toContain(
      '### Newcomers\n\n[**zed**](https://github.com/zed-industries/zed) - 52731 ⭐ · *Rust*'
    );
    expect(markdown).toContain(
      '`>_` [**bat**](https://github.com/sharkdp/bat) - 120034 📥'
    );
    expect(markdown).toContain(
      '🖥️ [**raycast**](https://www.raycast.com/) - 15500 📥'
    );
    expect(markdown).toContain('`brew uninstall --cask raycast`');
  });

  it('renders plain bold text when a row URL is null', () => {
    const report = emptyReport();
    report.homebrew.newcomers = [
      {
        name: 'ghostty',
        url: null,
        installs: 4200,
        description: 'Fast, feature-rich terminal emulator',
        kind: 'cask'
      }
    ];

    const markdown = renderDailyReport(report);

    expect(markdown).toContain('🖥️ **ghostty** - 4200 📥');
    expect(markdown).not.toContain('[**ghostty**](null)');
  });

  it('omits missing change values instead of rendering null%', () => {
    const report: ReportJson = {
      github: {
        newcomers: [],
        risers: [
          {
            name: 'zed',
            url: 'https://github.com/zed-industries/zed',
            stars: 52731,
            language: 'Rust',
            description: 'Code editor for high-agency developers',
            changePercent: null
          }
        ]
      },
      homebrew: {
        newcomers: [],
        risers: [
          {
            name: 'bat',
            url: 'https://github.com/sharkdp/bat',
            installs: 120034,
            description: 'Clone of cat(1) with wings.',
            kind: 'formula',
            changePercent: null
          }
        ],
        losers: [
          {
            name: 'ghostty',
            url: null,
            installs: 4200,
            description: 'Fast, feature-rich terminal emulator',
            kind: 'cask',
            changePercent: null
          }
        ]
      }
    };

    const markdown = renderDailyReport(report);

    expect(markdown).toContain(
      '[**zed**](https://github.com/zed-industries/zed) - 52731 ⭐'
    );
    expect(markdown).toContain(
      '`>_` [**bat**](https://github.com/sharkdp/bat) - 120034 📥'
    );
    expect(markdown).toContain('🖥️ **ghostty** - 4200 📥');
    expect(markdown).not.toContain('null%');
  });

  it('renders losers with a negative all-time percentage even when the stored value is unsigned', () => {
    const report = emptyReport();
    report.homebrew.losers = [
      {
        name: 'raycast',
        url: 'https://www.raycast.com/',
        installs: 15500,
        description: 'Control your tools with a few keystrokes',
        kind: 'cask',
        changePercent: 35
      }
    ];

    const markdown = renderDailyReport(report);

    expect(markdown).toContain(
      '**-35%** 📉 🖥️ [**raycast**](https://www.raycast.com/) - 15500 📥'
    );
    expect(markdown).not.toContain('**35%** 📉');
  });

  it('renders rising entries with a single explicit space after the formatted change', () => {
    const report = emptyReport();
    report.homebrew.risers = [
      {
        name: 'bat',
        url: 'https://github.com/sharkdp/bat',
        installs: 120034,
        description: 'Clone of cat(1) with wings.',
        kind: 'formula',
        changePercent: 12
      }
    ];

    const markdown = renderDailyReport(report);

    expect(markdown).toContain(
      '**+12%** 📈 `>_` [**bat**](https://github.com/sharkdp/bat) - 120034 📥'
    );
    expect(markdown).not.toContain('**+12%** 📈  `>_`');
  });

  it('renders language inline and omits it when null', () => {
    const report: ReportJson = {
      github: {
        newcomers: [
          {
            name: 'zed',
            url: 'https://github.com/zed-industries/zed',
            stars: 52731,
            language: 'Rust',
            description: 'Code editor'
          },
          {
            name: 'docs',
            url: 'https://github.com/org/docs',
            stars: 100,
            language: null,
            description: 'Documentation'
          }
        ],
        risers: []
      },
      homebrew: { newcomers: [], risers: [], losers: [] }
    };

    const markdown = renderDailyReport(report);

    expect(markdown).toContain(
      '[**zed**](https://github.com/zed-industries/zed) - 52731 ⭐ · *Rust*'
    );
    expect(markdown).toContain(
      '[**docs**](https://github.com/org/docs) - 100 ⭐\nDocumentation'
    );
    expect(markdown).not.toContain('- *');
    expect(markdown).not.toContain('Unknown');
  });

  it('renders Telegram Bot API HTML with escaped text and links', () => {
    const report = emptyReport();
    report.github.newcomers = [
      {
        name: 'a < b & c',
        url: 'https://github.com/org/tool?x=1&y=2',
        stars: 123,
        language: 'TypeScript & HTML',
        description: 'Use <script> safely & ship reports'
      }
    ];
    report.homebrew.newcomers = [
      {
        name: 'raycast',
        url: 'https://www.raycast.com/',
        installs: 15500,
        description: 'Control tools with <shortcuts> & snippets',
        kind: 'cask'
      }
    ];

    const html = renderTelegramReport(report, '2026-05-20');

    expect(html).toContain('<b>Déveilleur daily report — 2026-05-20</b>');
    expect(html).toContain('<b>GitHub</b>');
    expect(html).toContain(
      '<a href="https://github.com/org/tool?x=1&amp;y=2"><b>a &lt; b &amp; c</b></a> - 123 ⭐ · <i>TypeScript &amp; HTML</i>'
    );
    expect(html).toContain('Use &lt;script&gt; safely &amp; ship reports');
    expect(html).toContain('<code>brew install --cask raycast</code>');
    expect(html).not.toContain('##');
    expect(html).not.toContain('[**');
    expect(html).not.toContain('`brew');
  });
});
