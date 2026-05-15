import { describe, expect, it } from 'vitest';

import {
  collectHomebrewAnalytics,
  resolveFormulaDependency
} from '../src/collectors/homebrew.js';
import formulaAnalytics from './fixtures/homebrew-formula-analytics.json' with { type: 'json' };
import caskAnalytics from './fixtures/homebrew-cask-analytics.json' with { type: 'json' };
import formulaBat from './fixtures/formula-bat.json' with { type: 'json' };
import formulaBuildDependency from './fixtures/formula-build-dependency.json' with { type: 'json' };
import formulaLibuv from './fixtures/formula-libuv.json' with { type: 'json' };
import caskRaycast from './fixtures/cask-raycast.json' with { type: 'json' };

describe('resolveFormulaDependency', () => {
  it('marks a formula as a dependency when another formula depends on it', () => {
    expect(resolveFormulaDependency('libuv', [formulaBat, formulaLibuv])).toBe(true);
    expect(resolveFormulaDependency('bat', [formulaBat, formulaLibuv])).toBe(false);
  });

  it('marks a formula as a dependency when another formula lists it as a build dependency', () => {
    expect(
      resolveFormulaDependency('libuv', [formulaBuildDependency, formulaLibuv])
    ).toBe(true);
  });
});

describe('collectHomebrewAnalytics', () => {
  it('returns formula and cask items with opportunistic metadata', () => {
    const items = collectHomebrewAnalytics({
      formulaAnalytics,
      caskAnalytics,
      formulaDetailsByName: new Map([
        ['bat', formulaBat],
        ['libuv', formulaLibuv]
      ]),
      caskDetailsByName: new Map([['raycast', caskRaycast]])
    });

    expect(items).not.toBeInstanceOf(Promise);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'HB',
          sourceKey: 'bat',
          dependency: false,
          metricValue: 120034,
          description: 'Clone of cat(1) with wings.',
          url: 'https://github.com/sharkdp/bat'
        }),
        expect.objectContaining({
          source: 'HB',
          sourceKey: 'libuv',
          dependency: true
        }),
        expect.objectContaining({
          source: 'HBC',
          sourceKey: 'raycast',
          dependency: false,
          metricValue: 15500,
          url: 'https://www.raycast.com/'
        })
      ])
    );
  });

  it('returns null metadata when detail entries are missing', () => {
    const items = collectHomebrewAnalytics({
      formulaAnalytics,
      caskAnalytics,
      formulaDetailsByName: new Map(),
      caskDetailsByName: new Map()
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'HB',
          sourceKey: 'bat',
          description: null,
          url: null
        }),
        expect.objectContaining({
          source: 'HBC',
          sourceKey: 'raycast',
          description: null,
          url: null
        })
      ])
    );
  });
});
