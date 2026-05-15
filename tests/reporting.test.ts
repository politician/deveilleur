import { describe, expect, it } from 'vitest';

import {
  renderDailyReport,
  type HomebrewReportRow,
  type ReportRow
} from '../src/services/reporting.js';

// @ts-expect-error Homebrew rows must declare their source.
const invalidHomebrewRow: HomebrewReportRow = {
  name: 'missing-source',
  url: null,
  metricValue: 1,
  description: null
};

void invalidHomebrewRow;

describe('renderDailyReport', () => {
  it('renders GH, HB, and HBC sections with the required formatting', () => {
    const githubNewcomers: ReportRow[] = [
      {
        name: 'zed',
        url: 'https://github.com/zed-industries/zed',
        metricValue: 52731,
        language: 'Rust',
        description: 'Code editor for high-agency developers'
      }
    ];
    const homebrewNewcomers: HomebrewReportRow[] = [
      {
        name: 'bat',
        url: 'https://github.com/sharkdp/bat',
        metricValue: 120034,
        description: 'Clone of cat(1) with wings.',
        source: 'HB',
        liveChange: null,
        alltimeChange: null
      }
    ];
    const homebrewLosers: HomebrewReportRow[] = [
      {
        name: 'raycast',
        url: 'https://www.raycast.com/',
        metricValue: 15500,
        description: 'Control your tools with a few keystrokes',
        source: 'HBC',
        liveChange: -10,
        alltimeChange: -35
      }
    ];

    const markdown = renderDailyReport({
      githubNewcomers,
      githubRisers: [],
      homebrewNewcomers,
      homebrewRisers: [],
      homebrewLosers
    });

    expect(markdown).toContain('[**zed**](https://github.com/zed-industries/zed) - 52731 ⭐');
    expect(markdown).toContain('>_ [**bat**](https://github.com/sharkdp/bat) - 120034 📥');
    expect(markdown).toContain('🖥️ [**raycast**](https://www.raycast.com/) - 15500 📥');
    expect(markdown).toContain('`brew uninstall --cask raycast`');
  });

  it('renders plain bold text when a row URL is null', () => {
    const markdown = renderDailyReport({
      githubNewcomers: [],
      githubRisers: [],
      homebrewNewcomers: [
        {
          name: 'ghostty',
          url: null,
          metricValue: 4200,
          description: 'Fast, feature-rich terminal emulator',
          source: 'HBC',
          liveChange: null,
          alltimeChange: null
        }
      ],
      homebrewRisers: [],
      homebrewLosers: []
    });

    expect(markdown).toContain('🖥️ **ghostty** - 4200 📥');
    expect(markdown).not.toContain('[**ghostty**](null)');
  });
});
