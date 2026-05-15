import { describe, expect, it } from 'vitest';

import { renderDailyReport } from '../src/services/reporting.js';

describe('renderDailyReport', () => {
  it('renders GH, HB, and HBC sections with the required formatting', () => {
    const markdown = renderDailyReport({
      githubNewcomers: [
        {
          name: 'zed',
          url: 'https://github.com/zed-industries/zed',
          metricValue: 52731,
          language: 'Rust',
          description: 'Code editor for high-agency developers'
        }
      ],
      githubRisers: [],
      homebrewNewcomers: [
        {
          name: 'bat',
          url: 'https://github.com/sharkdp/bat',
          metricValue: 120034,
          description: 'Clone of cat(1) with wings.',
          source: 'HB',
          liveChange: null,
          alltimeChange: null
        }
      ],
      homebrewRisers: [],
      homebrewLosers: [
        {
          name: 'raycast',
          url: 'https://www.raycast.com/',
          metricValue: 15500,
          description: 'Control your tools with a few keystrokes',
          source: 'HBC',
          liveChange: -10,
          alltimeChange: -35
        }
      ]
    });

    expect(markdown).toContain('[**zed**](https://github.com/zed-industries/zed) - 52731 ⭐');
    expect(markdown).toContain('>_ [**bat**](https://github.com/sharkdp/bat) - 120034 📥');
    expect(markdown).toContain('🖥️ [**raycast**](https://www.raycast.com/) - 15500 📥');
    expect(markdown).toContain('`brew uninstall --cask raycast`');
  });
});
