# Tool Discovery Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a scheduled TypeScript CLI that ingests GitHub Trending and Homebrew analytics, stores normalized daily history in SQLite, and writes dated Markdown trend reports.

**Architecture:** The app is a small Node.js CLI with source-specific collectors, a normalized SQLite persistence layer, and a report renderer. GitHub and Homebrew ingestion remain separate up to the collection boundary, then flow through shared catalog and metrics services so newcomers, risers, dependency exclusion, and loser calculations all come from recorded history.

**Tech Stack:** TypeScript, Node.js, npm, Kysely, better-sqlite3, Cheerio, Vitest, tsx

---

## File Structure

### Application files

- Create: `package.json` — scripts and dependencies for the CLI, database, and test workflow
- Create: `tsconfig.json` — TypeScript compiler settings
- Create: `vitest.config.ts` — test runner configuration
- Create: `src/cli.ts` — CLI entrypoint and command dispatch
- Create: `src/config.ts` — runtime paths and date helpers
- Create: `src/db/schema.ts` — typed database schema
- Create: `src/db/database.ts` — SQLite connection factory
- Create: `src/db/migrate.ts` — idempotent schema creation
- Create: `src/collectors/github-trending.ts` — GitHub Trending parser and fetch wrapper
- Create: `src/collectors/homebrew.ts` — Homebrew analytics/detail collection and dependency detection
- Create: `src/services/catalog.ts` — entry upserts and dependency persistence
- Create: `src/services/metrics.ts` — daily metric writes and change calculations
- Create: `src/services/reporting.ts` — newcomer/riser/loser queries and Markdown rendering
- Create: `src/commands/run-daily.ts` — orchestration for one scheduled run

### Test files

- Create: `tests/cli.test.ts`
- Create: `tests/db.test.ts`
- Create: `tests/github-trending.test.ts`
- Create: `tests/homebrew.test.ts`
- Create: `tests/metrics.test.ts`
- Create: `tests/reporting.test.ts`
- Create: `tests/run-daily.test.ts`
- Create: `tests/fixtures/github-trending.html`
- Create: `tests/fixtures/homebrew-formula-analytics.json`
- Create: `tests/fixtures/homebrew-cask-analytics.json`
- Create: `tests/fixtures/formula-bat.json`
- Create: `tests/fixtures/formula-libuv.json`
- Create: `tests/fixtures/cask-raycast.json`

### Runtime output

- Create: `data/.gitkeep` — keep the SQLite directory in git
- Create: `reports/.gitkeep` — keep the report output directory in git

## Task 1: Bootstrap the TypeScript CLI workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/cli.ts`
- Create: `tests/cli.test.ts`
- Create: `data/.gitkeep`
- Create: `reports/.gitkeep`

- [ ] **Step 1: Create the npm manifest and toolchain config**

```json
{
  "name": "tool-discovery-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "run-daily": "tsx src/cli.ts run-daily"
  },
  "dependencies": {
    "better-sqlite3": "^12.0.0",
    "cheerio": "^1.1.0",
    "kysely": "^0.28.2"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `package-lock.json` is created and `npm` exits successfully.

- [ ] **Step 3: Write the failing CLI smoke test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { main } from '../src/cli.js';

describe('main', () => {
  it('prints the run-daily usage when called with --help', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await main(['--help']);

    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith('Usage: tool-discovery run-daily');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/cli.test.ts`
Expected: FAIL with `Cannot find module '../src/cli.js'` or `main is not exported`.

- [ ] **Step 5: Implement the minimal CLI entrypoint**

```ts
import { pathToFileURL } from 'node:url';

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help') {
    console.log('Usage: tool-discovery run-daily');
    return 0;
  }

  if (argv[0] === 'run-daily') {
    console.log('run-daily not implemented yet');
    return 0;
  }

  throw new Error(`Unknown command: ${argv[0]}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 6: Create the output directories and rerun the smoke test**

```bash
mkdir -p data reports && touch data/.gitkeep reports/.gitkeep
npx vitest run tests/cli.test.ts
```

Expected: PASS with `1 passed`.

- [ ] **Step 7: Commit the bootstrap**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/cli.ts tests/cli.test.ts data/.gitkeep reports/.gitkeep
git commit -m "chore: bootstrap tool discovery cli" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 2: Create the database schema and migration entrypoint

**Files:**
- Create: `src/config.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/database.ts`
- Create: `src/db/migrate.ts`
- Test: `tests/db.test.ts`

- [ ] **Step 1: Write the failing database test**

```ts
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { createDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';

describe('database migration', () => {
  it('creates the expected tables', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const tables = await sql<{ name: string }>`
      select name
      from sqlite_master
      where type = 'table'
    `.execute(db);

    expect(tables.rows.map((table) => table.name)).toEqual(
      expect.arrayContaining(['entries', 'daily_metrics', 'run_reports'])
    );

    await db.destroy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db.test.ts`
Expected: FAIL because the database helpers do not exist yet.

- [ ] **Step 3: Implement config, schema, and migration code**

```ts
// src/config.ts
import path from 'node:path';

export const SQLITE_PATH = path.join(process.cwd(), 'data', 'tool-discovery.sqlite');

export function isoDate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}
```

```ts
// src/db/schema.ts
import type { Generated } from 'kysely';

export type Source = 'GH' | 'HB' | 'HBC';

export interface EntriesTable {
  id: Generated<number>;
  source: Source;
  source_key: string;
  name: string;
  description: string | null;
  language: string | null;
  url: string | null;
  dependency: number;
  first_seen_at: string;
  updated_at: string;
}

export interface DailyMetricsTable {
  id: Generated<number>;
  entry_id: number;
  metric_date: string;
  metric_value: number;
  live_change: number | null;
  alltime_change: number | null;
  gh_today_change: number | null;
  gh_weekly_change: number | null;
  gh_monthly_change: number | null;
  created_at: string;
}

export interface RunReportsTable {
  id: Generated<number>;
  run_date: string;
  output_path: string;
  created_at: string;
}

export interface DatabaseSchema {
  entries: EntriesTable;
  daily_metrics: DailyMetricsTable;
  run_reports: RunReportsTable;
}
```

```ts
// src/db/database.ts
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import type { DatabaseSchema } from './schema.js';

export function createDatabase(filename: string) {
  const sqlite = new Database(filename);

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqlite })
  });
}
```

```ts
// src/db/migrate.ts
import { sql, type Kysely } from 'kysely';

import type { DatabaseSchema } from './schema.js';

export async function migrate(db: Kysely<DatabaseSchema>): Promise<void> {
  await sql`
    create table if not exists entries (
      id integer primary key autoincrement,
      source text not null,
      source_key text not null,
      name text not null,
      description text,
      language text,
      url text,
      dependency integer not null default 0,
      first_seen_at text not null,
      updated_at text not null,
      unique(source, source_key)
    )
  `.execute(db);

  await sql`
    create table if not exists daily_metrics (
      id integer primary key autoincrement,
      entry_id integer not null references entries(id),
      metric_date text not null,
      metric_value integer not null,
      live_change real,
      alltime_change real,
      gh_today_change integer,
      gh_weekly_change integer,
      gh_monthly_change integer,
      created_at text not null,
      unique(entry_id, metric_date)
    )
  `.execute(db);

  await sql`
    create table if not exists run_reports (
      id integer primary key autoincrement,
      run_date text not null unique,
      output_path text not null,
      created_at text not null
    )
  `.execute(db);
}
```

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `npx vitest run tests/db.test.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the database foundation**

```bash
git add src/config.ts src/db/schema.ts src/db/database.ts src/db/migrate.ts tests/db.test.ts
git commit -m "feat: add sqlite schema foundation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: Implement the GitHub Trending collector

**Files:**
- Create: `src/collectors/github-trending.ts`
- Create: `tests/github-trending.test.ts`
- Create: `tests/fixtures/github-trending.html`

- [ ] **Step 1: Write the failing GitHub parser test**

```ts
import { describe, expect, it } from 'vitest';

import { parseGitHubTrendingPage } from '../src/collectors/github-trending.js';
import html from './fixtures/github-trending.html?raw';

describe('parseGitHubTrendingPage', () => {
  it('extracts repo metadata and per-period star deltas', () => {
    const items = parseGitHubTrendingPage(html, 'daily');

    expect(items).toEqual([
      {
        source: 'GH',
        sourceKey: 'zed-industries/zed',
        name: 'zed',
        description: 'Code editor for high-agency developers',
        language: 'Rust',
        url: 'https://github.com/zed-industries/zed',
        totalStars: 52731,
        ghTodayChange: 842,
        ghWeeklyChange: null,
        ghMonthlyChange: null
      }
    ]);
  });
});
```

```html
<article class="Box-row">
  <h2><a href="/zed-industries/zed">zed-industries / zed</a></h2>
  <p>Code editor for high-agency developers</p>
  <span itemprop="programmingLanguage">Rust</span>
  <a href="/zed-industries/zed/stargazers">52,731</a>
  <span>842 stars today</span>
</article>
```

- [ ] **Step 2: Run the parser test to verify it fails**

Run: `npx vitest run tests/github-trending.test.ts`
Expected: FAIL because the collector module does not exist.

- [ ] **Step 3: Implement the parser and fetch wrapper**

```ts
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

export function parseGitHubTrendingPage(html: string, period: GitHubPeriod): GitHubTrendingItem[] {
  const $ = cheerio.load(html);

  return $('article.Box-row').map((_, element) => {
    const repoPath = $(element).find('h2 a').attr('href')!.trim();
    const repoFullName = repoPath.replace(/^\//, '').replace(/\s+/g, '');
    const starValues = $(element).find('a[href$="/stargazers"]').map((__, link) => {
      return Number.parseInt($(link).text().replace(/,/g, '').trim(), 10);
    }).get();
    const trendText = $(element).find('span').toArray().map((node) => $(node).text()).find((text) => text.includes('stars'));
    const trendValue = trendText ? Number.parseInt(trendText.replace(/[^\d]/g, ''), 10) : null;

    return {
      source: 'GH' as const,
      sourceKey: repoFullName,
      name: repoFullName.split('/')[1],
      description: $(element).find('p').text().trim() || null,
      language: $(element).find('[itemprop="programmingLanguage"]').text().trim() || null,
      url: `https://github.com/${repoFullName}`,
      totalStars: starValues[0] ?? 0,
      ghTodayChange: period === 'daily' ? trendValue : null,
      ghWeeklyChange: period === 'weekly' ? trendValue : null,
      ghMonthlyChange: period === 'monthly' ? trendValue : null
    };
  }).get();
}
```

- [ ] **Step 4: Add a fetch helper test case for the three GitHub periods**

```ts
it('merges daily, weekly, and monthly sightings by repo', async () => {
  const fetchText = async (period: GitHubPeriod) => html.replace('842 stars today', period === 'daily' ? '842 stars today' : period === 'weekly' ? '1900 stars this week' : '4300 stars this month');

  const repos = await collectGitHubTrending(fetchText);

  expect(repos[0]).toMatchObject({
    sourceKey: 'zed-industries/zed',
    ghTodayChange: 842,
    ghWeeklyChange: 1900,
    ghMonthlyChange: 4300
  });
});
```

```ts
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
```

- [ ] **Step 5: Run the GitHub collector tests**

Run: `npx vitest run tests/github-trending.test.ts`
Expected: PASS with `2 passed`.

- [ ] **Step 6: Commit the GitHub collector**

```bash
git add src/collectors/github-trending.ts tests/github-trending.test.ts tests/fixtures/github-trending.html
git commit -m "feat: parse github trending feeds" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: Implement the Homebrew collector and dependency memory

**Files:**
- Create: `src/collectors/homebrew.ts`
- Create: `tests/homebrew.test.ts`
- Create: `tests/fixtures/homebrew-formula-analytics.json`
- Create: `tests/fixtures/homebrew-cask-analytics.json`
- Create: `tests/fixtures/formula-bat.json`
- Create: `tests/fixtures/formula-libuv.json`
- Create: `tests/fixtures/cask-raycast.json`

- [ ] **Step 1: Write the failing Homebrew collector tests**

```ts
import { describe, expect, it } from 'vitest';

import {
  collectHomebrewAnalytics,
  resolveFormulaDependency
} from '../src/collectors/homebrew.js';
import formulaAnalytics from './fixtures/homebrew-formula-analytics.json';
import caskAnalytics from './fixtures/homebrew-cask-analytics.json';
import formulaBat from './fixtures/formula-bat.json';
import formulaLibuv from './fixtures/formula-libuv.json';
import caskRaycast from './fixtures/cask-raycast.json';

describe('resolveFormulaDependency', () => {
  it('marks a formula as a dependency when another formula depends on it', () => {
    expect(resolveFormulaDependency('libuv', [formulaBat, formulaLibuv])).toBe(true);
    expect(resolveFormulaDependency('bat', [formulaBat, formulaLibuv])).toBe(false);
  });
});

describe('collectHomebrewAnalytics', () => {
  it('returns formula and cask items with opportunistic metadata', async () => {
    const items = await collectHomebrewAnalytics({
      formulaAnalytics,
      caskAnalytics,
      formulaDetailsByName: new Map([
        ['bat', formulaBat],
        ['libuv', formulaLibuv]
      ]),
      caskDetailsByName: new Map([['raycast', caskRaycast]])
    });

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
          metricValue: 15500,
          url: 'https://www.raycast.com/'
        })
      ])
    );
  });
});
```

- [ ] **Step 2: Run the collector tests to verify they fail**

Run: `npx vitest run tests/homebrew.test.ts`
Expected: FAIL because the Homebrew collector does not exist.

- [ ] **Step 3: Add minimal fixture data**

```json
{
  "category": "install",
  "formulae": [
    { "formula": "bat", "count": 120034 },
    { "formula": "libuv", "count": 91022 }
  ]
}
```

```json
{
  "category": "cask-install",
  "casks": [
    { "cask": "raycast", "count": 15500 }
  ]
}
```

```json
{
  "name": "bat",
  "desc": "Clone of cat(1) with wings.",
  "homepage": "https://github.com/sharkdp/bat",
  "dependencies": ["libuv"],
  "build_dependencies": []
}
```

```json
{
  "name": "libuv",
  "desc": "Multi-platform support library with a focus on asynchronous I/O",
  "homepage": "https://libuv.org/",
  "dependencies": [],
  "build_dependencies": []
}
```

```json
{
  "token": "raycast",
  "desc": "Control your tools with a few keystrokes",
  "homepage": "https://www.raycast.com/"
}
```

- [ ] **Step 4: Implement dependency detection and collection**

```ts
export function resolveFormulaDependency(
  name: string,
  details: Array<{ name: string; dependencies: string[]; build_dependencies: string[] }>
): boolean {
  return details.some((item) => {
    const deps = [...item.dependencies, ...item.build_dependencies];
    return item.name !== name && deps.includes(name);
  });
}

export async function collectHomebrewAnalytics(input: {
  formulaAnalytics: { formulae: Array<{ formula: string; count: number }> };
  caskAnalytics: { casks: Array<{ cask: string; count: number }> };
  formulaDetailsByName: Map<string, { name: string; desc: string; homepage: string; dependencies: string[]; build_dependencies: string[] }>;
  caskDetailsByName: Map<string, { token: string; desc: string; homepage: string }>;
}) {
  const formulaDetails = [...input.formulaDetailsByName.values()];

  const formulas = input.formulaAnalytics.formulae.map((item) => {
    const detail = input.formulaDetailsByName.get(item.formula);

    return {
      source: 'HB' as const,
      sourceKey: item.formula,
      name: item.formula,
      description: detail?.desc ?? null,
      language: null,
      url: detail?.homepage ?? null,
      dependency: resolveFormulaDependency(item.formula, formulaDetails),
      metricValue: item.count
    };
  });

  const casks = input.caskAnalytics.casks.map((item) => {
    const detail = input.caskDetailsByName.get(item.cask);

    return {
      source: 'HBC' as const,
      sourceKey: item.cask,
      name: item.cask,
      description: detail?.desc ?? null,
      language: null,
      url: detail?.homepage ?? null,
      dependency: false,
      metricValue: item.count
    };
  });

  return [...formulas, ...casks];
}
```

- [ ] **Step 5: Run the Homebrew collector tests**

Run: `npx vitest run tests/homebrew.test.ts`
Expected: PASS with `2 passed`.

- [ ] **Step 6: Commit the Homebrew collector**

```bash
git add src/collectors/homebrew.ts tests/homebrew.test.ts tests/fixtures/homebrew-formula-analytics.json tests/fixtures/homebrew-cask-analytics.json tests/fixtures/formula-bat.json tests/fixtures/formula-libuv.json tests/fixtures/cask-raycast.json
git commit -m "feat: collect homebrew analytics" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 5: Implement catalog upserts and daily metric calculations

**Files:**
- Create: `src/services/catalog.ts`
- Create: `src/services/metrics.ts`
- Test: `tests/metrics.test.ts`

- [ ] **Step 1: Write the failing metrics tests**

```ts
import { describe, expect, it } from 'vitest';

import { createDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { upsertEntry } from '../src/services/catalog.js';
import { recordDailyMetric } from '../src/services/metrics.js';

describe('recordDailyMetric', () => {
  it('computes live_change and alltime_change for homebrew rows', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const entryId = await upsertEntry(db, {
      source: 'HB',
      sourceKey: 'bat',
      name: 'bat',
      description: 'Clone of cat(1) with wings.',
      language: null,
      url: 'https://github.com/sharkdp/bat',
      dependency: false,
      seenAt: '2026-05-13'
    });

    await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-13',
      metricValue: 100,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    const second = await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-14',
      metricValue: 125,
      ghTodayChange: null,
      ghWeeklyChange: null,
      ghMonthlyChange: null
    });

    expect(second.live_change).toBe(25);
    expect(second.alltime_change).toBe(25);

    await db.destroy();
  });

  it('leaves alltime_change null for github rows', async () => {
    const db = createDatabase(':memory:');
    await migrate(db);

    const entryId = await upsertEntry(db, {
      source: 'GH',
      sourceKey: 'zed-industries/zed',
      name: 'zed',
      description: 'Code editor for high-agency developers',
      language: 'Rust',
      url: 'https://github.com/zed-industries/zed',
      dependency: false,
      seenAt: '2026-05-13'
    });

    const row = await recordDailyMetric(db, {
      entryId,
      metricDate: '2026-05-13',
      metricValue: 52731,
      ghTodayChange: 842,
      ghWeeklyChange: 1900,
      ghMonthlyChange: 4300
    });

    expect(row.alltime_change).toBeNull();
    expect(row.gh_today_change).toBe(842);

    await db.destroy();
  });
});
```

- [ ] **Step 2: Run the metrics tests to verify they fail**

Run: `npx vitest run tests/metrics.test.ts`
Expected: FAIL because the catalog and metrics services do not exist.

- [ ] **Step 3: Implement the catalog upsert**

```ts
import type { Kysely } from 'kysely';

import type { DatabaseSchema, Source } from '../db/schema.js';

export async function upsertEntry(
  db: Kysely<DatabaseSchema>,
  input: {
    source: Source;
    sourceKey: string;
    name: string;
    description: string | null;
    language: string | null;
    url: string | null;
    dependency: boolean;
    seenAt: string;
  }
): Promise<number> {
  await db
    .insertInto('entries')
    .values({
      source: input.source,
      source_key: input.sourceKey,
      name: input.name,
      description: input.description,
      language: input.language,
      url: input.url,
      dependency: input.dependency ? 1 : 0,
      first_seen_at: input.seenAt,
      updated_at: input.seenAt
    })
    .onConflict((oc) => oc.columns(['source', 'source_key']).doUpdateSet({
      name: input.name,
      description: input.description,
      language: input.language,
      url: input.url,
      dependency: input.dependency ? 1 : 0,
      updated_at: input.seenAt
    }))
    .execute();

  const row = await db
    .selectFrom('entries')
    .select('id')
    .where('source', '=', input.source)
    .where('source_key', '=', input.sourceKey)
    .executeTakeFirstOrThrow();

  return row.id;
}
```

- [ ] **Step 4: Implement metric recording and change calculations**

```ts
import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../db/schema.js';

function pctChange(previous: number, current: number): number {
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export async function recordDailyMetric(
  db: Kysely<DatabaseSchema>,
  input: {
    entryId: number;
    metricDate: string;
    metricValue: number;
    ghTodayChange: number | null;
    ghWeeklyChange: number | null;
    ghMonthlyChange: number | null;
  }
) {
  const previous = await db
    .selectFrom('daily_metrics')
    .select(['metric_value'])
    .where('entry_id', '=', input.entryId)
    .orderBy('metric_date desc')
    .executeTakeFirst();

  const first = await db
    .selectFrom('daily_metrics')
    .select(['metric_value'])
    .where('entry_id', '=', input.entryId)
    .orderBy('metric_date asc')
    .executeTakeFirst();

  const entry = await db
    .selectFrom('entries')
    .select(['source'])
    .where('id', '=', input.entryId)
    .executeTakeFirstOrThrow();

  const row = {
    entry_id: input.entryId,
    metric_date: input.metricDate,
    metric_value: input.metricValue,
    live_change: previous ? pctChange(previous.metric_value, input.metricValue) : null,
    alltime_change: entry.source === 'GH' || !first ? null : pctChange(first.metric_value, input.metricValue),
    gh_today_change: input.ghTodayChange,
    gh_weekly_change: input.ghWeeklyChange,
    gh_monthly_change: input.ghMonthlyChange,
    created_at: input.metricDate
  };

  await db
    .insertInto('daily_metrics')
    .values(row)
    .onConflict((oc) => oc.columns(['entry_id', 'metric_date']).doUpdateSet(row))
    .execute();

  return db
    .selectFrom('daily_metrics')
    .selectAll()
    .where('entry_id', '=', input.entryId)
    .where('metric_date', '=', input.metricDate)
    .executeTakeFirstOrThrow();
}
```

- [ ] **Step 5: Run the metrics tests**

Run: `npx vitest run tests/metrics.test.ts`
Expected: PASS with `2 passed`.

- [ ] **Step 6: Commit catalog and metrics logic**

```bash
git add src/services/catalog.ts src/services/metrics.ts tests/metrics.test.ts
git commit -m "feat: persist catalog and daily metrics" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 6: Implement report selection and Markdown rendering

**Files:**
- Create: `src/services/reporting.ts`
- Test: `tests/reporting.test.ts`

- [ ] **Step 1: Write the failing report test**

```ts
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
```

- [ ] **Step 2: Run the reporting test to verify it fails**

Run: `npx vitest run tests/reporting.test.ts`
Expected: FAIL because the reporting service does not exist.

- [ ] **Step 3: Implement the Markdown renderer**

```ts
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
```

- [ ] **Step 4: Run the reporting test**

Run: `npx vitest run tests/reporting.test.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the report renderer**

```bash
git add src/services/reporting.ts tests/reporting.test.ts
git commit -m "feat: render daily markdown reports" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 7: Wire the daily orchestration command

**Files:**
- Create: `src/commands/run-daily.ts`
- Modify: `src/cli.ts`
- Test: `tests/run-daily.test.ts`

- [ ] **Step 1: Write the failing orchestration test**

```ts
import { describe, expect, it } from 'vitest';

import { runDaily } from '../src/commands/run-daily.js';

describe('runDaily', () => {
  it('writes a dated report file and records it in the database', async () => {
    const result = await runDaily({
      runDate: '2026-05-13',
      databasePath: ':memory:',
      reportsDir: 'reports',
      githubItems: [
        {
          source: 'GH',
          sourceKey: 'zed-industries/zed',
          name: 'zed',
          description: 'Code editor for high-agency developers',
          language: 'Rust',
          url: 'https://github.com/zed-industries/zed',
          totalStars: 52731,
          ghTodayChange: 842,
          ghWeeklyChange: 1900,
          ghMonthlyChange: 4300
        }
      ],
      homebrewItems: [
        {
          source: 'HB',
          sourceKey: 'bat',
          name: 'bat',
          description: 'Clone of cat(1) with wings.',
          language: null,
          url: 'https://github.com/sharkdp/bat',
          dependency: false,
          metricValue: 120034
        }
      ]
    });

    expect(result.outputPath).toBe('reports/2026-05-13.md');
    expect(result.markdown).toContain('# Trending tools');
    expect(result.reportRecorded).toBe(true);
  });
});
```

- [ ] **Step 2: Run the orchestration test to verify it fails**

Run: `npx vitest run tests/run-daily.test.ts`
Expected: FAIL because the command module does not exist.

- [ ] **Step 3: Implement `runDaily` orchestration**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';

import { createDatabase } from '../db/database.js';
import { migrate } from '../db/migrate.js';
import { upsertEntry } from '../services/catalog.js';
import { recordDailyMetric } from '../services/metrics.js';
import { renderDailyReport } from '../services/reporting.js';

export async function runDaily(input: {
  runDate: string;
  databasePath: string;
  reportsDir: string;
  githubItems: Array<{
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
  }>;
  homebrewItems: Array<{
    source: 'HB' | 'HBC';
    sourceKey: string;
    name: string;
    description: string | null;
    language: null;
    url: string | null;
    dependency: boolean;
    metricValue: number;
  }>;
}) {
  const db = createDatabase(input.databasePath);
  await migrate(db);

  for (const item of [...input.githubItems, ...input.homebrewItems]) {
    const entryId = await upsertEntry(db, {
      source: item.source,
      sourceKey: item.sourceKey,
      name: item.name,
      description: item.description,
      language: item.language,
      url: item.url,
      dependency: 'dependency' in item ? item.dependency : false,
      seenAt: input.runDate
    });

    if ('dependency' in item && item.dependency) continue;

    await recordDailyMetric(db, {
      entryId,
      metricDate: input.runDate,
      metricValue: 'metricValue' in item ? item.metricValue : item.totalStars,
      ghTodayChange: 'ghTodayChange' in item ? item.ghTodayChange : null,
      ghWeeklyChange: 'ghWeeklyChange' in item ? item.ghWeeklyChange : null,
      ghMonthlyChange: 'ghMonthlyChange' in item ? item.ghMonthlyChange : null
    });
  }

  const markdown = renderDailyReport({
    githubNewcomers: [],
    githubRisers: [],
    homebrewNewcomers: [],
    homebrewRisers: [],
    homebrewLosers: []
  });

  await fs.mkdir(input.reportsDir, { recursive: true });
  const outputPath = path.join(input.reportsDir, `${input.runDate}.md`);
  await fs.writeFile(outputPath, markdown, 'utf8');

  await db
    .insertInto('run_reports')
    .values({
      run_date: input.runDate,
      output_path: outputPath,
      created_at: input.runDate
    })
    .onConflict((oc) => oc.column('run_date').doUpdateSet({
      output_path: outputPath,
      created_at: input.runDate
    }))
    .execute();

  await db.destroy();

  return { outputPath, markdown, reportRecorded: true };
}
```

- [ ] **Step 4: Connect the CLI command to `runDaily`**

```ts
import { runDaily } from './commands/run-daily.js';
import { SQLITE_PATH, isoDate } from './config.js';

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help') {
    console.log('Usage: tool-discovery run-daily');
    return 0;
  }

  if (argv[0] === 'run-daily') {
    await runDaily({
      runDate: isoDate(),
      databasePath: SQLITE_PATH,
      reportsDir: 'reports',
      githubItems: [],
      homebrewItems: []
    });
    return 0;
  }

  throw new Error(`Unknown command: ${argv[0]}`);
}
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS with all test files green.

- [ ] **Step 6: Commit the orchestration layer**

```bash
git add src/commands/run-daily.ts src/cli.ts tests/run-daily.test.ts
git commit -m "feat: wire daily ingestion command" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 8: Finish the real source wiring and report queries

**Files:**
- Modify: `src/collectors/github-trending.ts`
- Modify: `src/collectors/homebrew.ts`
- Modify: `src/commands/run-daily.ts`
- Modify: `src/services/reporting.ts`
- Test: `tests/run-daily.test.ts`

- [ ] **Step 1: Extend the orchestration test so it uses real collector callbacks and persisted report sections**

```ts
expect(result.markdown).toContain('### Newcomers');
expect(result.markdown).toContain('[**zed**](https://github.com/zed-industries/zed) - 52731 ⭐');
expect(result.markdown).toContain('>_ [**bat**](https://github.com/sharkdp/bat) - 120034 📥');
expect(result.markdown).toContain('### Losers');
```

- [ ] **Step 2: Replace stubbed collector input with real fetch callbacks**

```ts
export async function fetchGitHubTrending(period: GitHubPeriod): Promise<string> {
  const url = period === 'daily'
    ? 'https://github.com/trending?spoken_language_code='
    : `https://github.com/trending?since=${period}&spoken_language_code=`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`GitHub Trending fetch failed: ${response.status}`);
  return response.text();
}
```

```ts
export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed for ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}
```

- [ ] **Step 3: Query stored history for newcomers, risers, and losers**

```ts
export async function selectReportData(db: Kysely<DatabaseSchema>, runDate: string) {
  const githubNewcomers = await db
    .selectFrom('daily_metrics as dm')
    .innerJoin('entries as e', 'e.id', 'dm.entry_id')
    .select(['e.name', 'e.url', 'e.language', 'e.description', 'dm.metric_value as metricValue'])
    .where('dm.metric_date', '=', runDate)
    .where('e.source', '=', 'GH')
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('daily_metrics as earlier')
            .select('earlier.id')
            .whereRef('earlier.entry_id', '=', 'dm.entry_id')
            .where('earlier.metric_date', '<', runDate)
        )
      )
    )
    .limit(10)
    .execute();

  const githubRisers = await db
    .selectFrom('daily_metrics as dm')
    .innerJoin('entries as e', 'e.id', 'dm.entry_id')
    .select(['e.name', 'e.url', 'e.language', 'e.description', 'dm.metric_value as metricValue', 'dm.live_change as liveChange'])
    .where('dm.metric_date', '=', runDate)
    .where('e.source', '=', 'GH')
    .orderBy('dm.live_change desc')
    .limit(10)
    .execute();

  const homebrewNewcomers = await db
    .selectFrom('daily_metrics as dm')
    .innerJoin('entries as e', 'e.id', 'dm.entry_id')
    .select(['e.name', 'e.url', 'e.description', 'e.source', 'dm.metric_value as metricValue'])
    .where('dm.metric_date', '=', runDate)
    .where(({ eb, not, exists, selectFrom }) =>
      eb('e.source', 'in', ['HB', 'HBC']).and(
        not(
          exists(
            selectFrom('daily_metrics as earlier')
              .select('earlier.id')
              .whereRef('earlier.entry_id', '=', 'dm.entry_id')
              .where('earlier.metric_date', '<', runDate)
          )
        )
      )
    )
    .limit(10)
    .execute();

  const homebrewRisers = await db
    .selectFrom('daily_metrics as dm')
    .innerJoin('entries as e', 'e.id', 'dm.entry_id')
    .select(['e.name', 'e.url', 'e.description', 'e.source', 'dm.metric_value as metricValue', 'dm.live_change as liveChange'])
    .where('dm.metric_date', '=', runDate)
    .where(({ eb }) => eb('e.source', 'in', ['HB', 'HBC']))
    .orderBy('dm.live_change desc')
    .limit(10)
    .execute();

  const homebrewLosers = await db
    .selectFrom('daily_metrics as dm')
    .innerJoin('entries as e', 'e.id', 'dm.entry_id')
    .select(['e.name', 'e.url', 'e.description', 'e.source', 'dm.metric_value as metricValue', 'dm.alltime_change as alltimeChange'])
    .where('dm.metric_date', '=', runDate)
    .where(({ eb }) => eb('e.source', 'in', ['HB', 'HBC']))
    .orderBy('dm.alltime_change asc')
    .limit(10)
    .execute();

  return {
    githubNewcomers,
    githubRisers,
    homebrewNewcomers,
    homebrewRisers,
    homebrewLosers
  };
}
```

- [ ] **Step 4: Replace the placeholder render input in `runDaily` with query results**

```ts
const reportData = await selectReportData(db, input.runDate);
const markdown = renderDailyReport({
  githubNewcomers: reportData.githubNewcomers,
  githubRisers: reportData.githubRisers,
  homebrewNewcomers: reportData.homebrewNewcomers,
  homebrewRisers: reportData.homebrewRisers,
  homebrewLosers: reportData.homebrewLosers
});
```

- [ ] **Step 5: Run the full test suite and the CLI once manually**

Run: `npm test && npm run run-daily`
Expected: tests pass and `reports/YYYY-MM-DD.md` is created.

- [ ] **Step 6: Commit the end-to-end flow**

```bash
git add src/collectors/github-trending.ts src/collectors/homebrew.ts src/commands/run-daily.ts src/services/reporting.ts tests/run-daily.test.ts
git commit -m "feat: complete source ingestion flow" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
