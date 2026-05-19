# Déveilleur

A scheduled CLI that scouts new and trending developer tools from public sources, stores daily history in SQLite, and writes a dated Markdown report highlighting **newcomers**, **risers**, and **losers**.

The name is a play on the French _développeur_ and _veille technologique_ (technology watch).

---

## What it does

Every run, the agent:

1. Scrapes **GitHub Trending** (daily / weekly / monthly).
2. Fetches **Homebrew analytics** for the last 30 days (formulae + casks) and enriches with formula/cask metadata.
3. Filters out formula _dependencies_ so the catalog only tracks user-facing tools.
4. Upserts each entry, records its daily metric, and computes change rates against prior runs.
5. Renders a Markdown report at `reports/YYYY-MM-DD.md` and indexes it in the `run_reports` table.

See an example: [reports/2026-05-18.md](reports/2026-05-18.md).

---

## Quick start

Requirements: **Node.js 24+** (uses native `fetch`) and a working C toolchain for `better-sqlite3`.

```bash
npm install
npm run run-daily
```

The SQLite database lives at `data/tool-discovery.sqlite` and is created on first run. The Markdown report is written to `reports/YYYY-MM-DD.md` for the current UTC date.

### npm scripts

| Script              | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `npm run run-daily` | Collect sources, persist metrics, and write the day's report. |
| `npm run build`     | Type-check and emit JS via `tsc`.                             |
| `npm test`          | Run the Vitest suite.                                         |

Re-running on the same date is idempotent: the report file is overwritten and the `run_reports` row is updated in place.

---

## Architecture

Three layers, one entry point:

```
                ┌──────────────────────────────────────────┐
                │              src/cli.ts                  │
                │     `tool-discovery run-daily`           │
                └──────────────────────┬───────────────────┘
                                       │
              ┌────────────────────────┼──────────────────────────┐
              ▼                        ▼                          ▼
   ┌────────────────────┐  ┌────────────────────┐    ┌────────────────────────┐
   │    Collectors      │  │      Services      │    │       Reporting        │
   │                    │  │                    │    │                        │
   │ github-trending.ts │  │ catalog.ts (upsert)│    │ selectReportData()     │
   │ homebrew.ts        │─▶│ metrics.ts (daily) │───▶│ renderDailyReport()    │
   │                    │  │                    │    │                        │
   │ fetch + parse HTML │  │ writes via Kysely  │    │ → reports/YYYY-MM-DD.md│
   │ fetch + parse JSON │  │                    │    │ → run_reports row      │
   └────────────────────┘  └─────────┬──────────┘    └────────────────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │   SQLite (Kysely + WAL)  │
                        │   data/tool-discovery.   │
                        │           sqlite         │
                        │                          │
                        │  entries                 │
                        │  daily_metrics           │
                        │  run_reports             │
                        └──────────────────────────┘
```

- **Collectors** ([src/collectors/](src/collectors/)) fetch and parse external data. They return plain typed objects and know nothing about storage.
- **Services** ([src/services/](src/services/)) own all DB access: `catalog` upserts identities, `metrics` writes one row per entry per day and computes `live_change` / `alltime_change`, `reporting` queries history and renders Markdown via a `ReportJson` intermediate.
- **Command** ([src/commands/run-daily.ts](src/commands/run-daily.ts)) is the orchestrator wired up by [src/cli.ts](src/cli.ts).

For the full rationale (data model, change-rate semantics, dependency handling, migration path to MariaDB), see the design spec: [docs/superpowers/specs/2026-05-13-tool-discovery-agent-design.md](docs/superpowers/specs/2026-05-13-tool-discovery-agent-design.md).

---

## Data model

Three tables, schema defined in [src/db/schema.ts](src/db/schema.ts):

- **`entries`** — one row per logical tool, keyed by `(source, source_key)`. `source` is `GH` (GitHub repo), `HB` (Homebrew formula), or `HBC` (Homebrew cask). Stores stable identity: name, description, language, URL, `dependency` flag.
- **`daily_metrics`** — one row per non-dependency entry per `metric_date`. Stores the raw `metric_value` (stars or installs) plus computed `live_change` / `alltime_change` and the original GitHub trending deltas.
- **`run_reports`** — one row per `run_date` pointing at the generated Markdown file.

Migrations live in [src/db/migrate.ts](src/db/migrate.ts) and run automatically at the start of every `run-daily`.

---

## Scheduling

Intended to run once a day via `cron`, a systemd timer, or any external scheduler. Example crontab line:

```cron
# Run at 06:00 UTC every day
0 6 * * *  cd /path/to/deveilleur && /usr/bin/npm run run-daily >> logs/run-daily.log 2>&1
```

The CLI has no daemon mode and no built-in scheduler — that's deliberate (see Non-goals).

---

## Project layout

```
src/
  cli.ts               Entry point. Parses argv, runs `run-daily`.
  config.ts            SQLite path and date helpers.
  collectors/          External-source fetchers + parsers.
  commands/            High-level orchestrators (one per CLI command).
  services/            DB access and report rendering.
  db/                  Kysely connection, schema types, migrations.
tests/                 Vitest suite (unit + integration).
data/                  SQLite file (gitignored).
reports/               Generated Markdown reports (gitignored).
docs/superpowers/      Design spec and implementation plan.
```

---

## Configuration

Currently zero env vars. Knobs are constants in code:

- `SQLITE_PATH` in [src/config.ts](src/config.ts) — database location.
- `HOMEBREW_ANALYTICS_LIMIT`, `HOMEBREW_CASK_LIMIT`, `HOMEBREW_DETAIL_CONCURRENCY` in [src/collectors/homebrew.ts](src/collectors/homebrew.ts) — how many top packages to keep and how aggressively to enrich them.

If config grows beyond a handful of values, promote it to a `.env` + a typed config module rather than scattering more constants.

---

## Testing

```bash
npm test
```

Tests are split between pure unit tests (collectors, parsers, metric math) and integration tests that exercise the SQLite layer against a temp file. HTML/JSON fixtures live in [tests/fixtures/](tests/fixtures/) so the suite is offline and deterministic.

---

## Roadmap

- Add more sources: PyPI trending, npm trending, Product Hunt, awesome-lists deltas.
- Email or Slack delivery of the daily report.
- Move from SQLite to MariaDB once history outgrows a single file (schema is already portable).
- Optional web view over `reports/`.

## Non-goals

- **No web UI** in this repo. Reports are static Markdown; render them wherever Markdown is already supported.
- **No long-running daemon.** Scheduling is an external concern (cron, systemd, GitHub Actions, etc.).
- **No partial-success reports.** If any source fetch or parse fails, the run aborts rather than producing a misleading report.
- **No wide one-column-per-date tables.** History is stored normalized in `daily_metrics`.

---

## Troubleshooting

- **`better-sqlite3` fails to install** — needs a C toolchain (`build-essential` on Debian/Ubuntu, Xcode CLT on macOS). Re-run `npm install` after installing it.
- **GitHub Trending returns 0 items** — the page's HTML structure changed. Update the selectors in [src/collectors/github-trending.ts](src/collectors/github-trending.ts) and refresh the fixture in `tests/fixtures/`.
- **A run looks empty** — check `data/tool-discovery.sqlite` exists and is writable, and that the process can reach `github.com` and `formulae.brew.sh`.
