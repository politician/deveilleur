# Tool Discovery Agent Design

## Problem

Build a greenfield TypeScript application that discovers new and trending tools from GitHub Trending and Homebrew analytics, stores daily history in SQLite with a migration path to MariaDB later, and writes a dated Markdown report highlighting newcomers, risers, and Homebrew all-time losers.

The system should run as a scheduled CLI job, not as a long-running service. Daily reports should be written to dated files under `reports/`.

## Goals

- Discover entries from:
  - GitHub Trending: today, weekly, monthly
  - Homebrew formula analytics (30d)
  - Homebrew cask analytics (30d)
- Keep one catalog entry per logical tool:
  - one GitHub row per repository
  - one Homebrew row per formula
  - one Homebrew Cask row per cask
- Record daily metrics and compute:
  - `live_change`: percent difference from previous recorded day to current day
  - `alltime_change`: percent difference from first recorded metric to current metric for HB and HBC only
- Exclude Homebrew formula dependencies from enrichment, metrics, and reports, while still remembering them in storage so future runs can skip them cheaply
- Generate a daily Markdown report in the requested structure
- Keep the storage model normalized and optimized for correctness, reruns, and later database migration

## Non-goals

- No web UI
- No long-running daemon
- No requirement to maintain a physically wide table with one column per date
- No partial-success reports when a source fetch or parse fails

## Recommended Architecture

The application is a scheduled TypeScript CLI with three main layers:

1. **Collectors** fetch and parse external sources.
2. **Storage services** persist catalog entries and daily metrics.
3. **Reporting** queries stored history and renders Markdown reports.

The main operator entrypoint is a `run-daily` command that performs ingestion, persistence, change calculation, and report generation for one logical run date.

## Components

### Collectors

- `collectors/github-trending`
  - Fetches the GitHub Trending pages for today, weekly, and monthly
  - Extracts repository identity, description, language, repository URL, the repository's total star count, and the trending-period star change shown on each page
  - Emits per-feed trending deltas for the run date

- `collectors/homebrew`
  - Fetches:
    - `formulae.brew.sh/api/analytics/install/30d.json`
    - `formulae.brew.sh/api/analytics/cask-install/30d.json`
  - Resolves dependency membership for formulae during discovery
  - Fetches individual formula/cask detail JSON only when a package is new or newly trending and needs enrichment

### Services

- `services/catalog`
  - Upserts stable entry metadata into `entries`
  - Ensures each logical tool is stored once per source identity
  - Stores `dependency = true` for Homebrew formula dependencies

- `services/metrics`
  - Writes one `daily_metrics` row per non-dependency entry and run date
  - Computes `live_change`
  - Computes `alltime_change` for HB/HBC entries only
  - Keeps writes idempotent for reruns of the same date

- `services/reporting`
  - Produces the dated Markdown report under `reports/`
  - Selects newcomers, risers, and losers from recorded history
  - Formats Homebrew install/uninstall commands exactly as required

## Data Model

### `entries`

Stable catalog of known tools.

Suggested fields:

- `id`
- `source` (`GH`, `HB`, `HBC`)
- `source_key` (repo full name, formula name, or cask token)
- `name`
- `description`
- `language` (GH only)
- `url`
- `dependency` (boolean, default `false`)
- `first_seen_at`
- `updated_at`

Notes:

- Dependency formulae are stored here with `dependency = true`.
- Dependency entries do not receive daily metrics and do not appear in reports.
- For Homebrew entries, `description` and `url` are filled opportunistically for new or newly trending entries only.

### `daily_metrics`

One row per non-dependency entry per run date.

Suggested fields:

- `id`
- `entry_id`
- `metric_date`
- `metric_value`
- `live_change`
- `alltime_change` (nullable for GH)
- `gh_today_change` (integer, nullable)
- `gh_weekly_change` (integer, nullable)
- `gh_monthly_change` (integer, nullable)
- `created_at`

Notes:

- For GH, `metric_value` is the repository's total star count.
- For HB/HBC, `metric_value` is the 30-day install count from the analytics feed.
- For GH rows, the `gh_*_change` columns are nullable integers.
- If a repo is seen in a given trending feed for the run date, the corresponding column stores the star change shown by GitHub Trending for that period.
- If a repo is not seen in that feed on the run date, the corresponding column remains `NULL`.

### `run_reports`

Stores generated report metadata for traceability.

Suggested fields:

- `id`
- `run_date`
- `output_path`
- `created_at`

## Daily Flow

1. Fetch GitHub Trending for today, weekly, and monthly.
2. Fetch Homebrew formula and cask analytics.
3. During Homebrew formula discovery, resolve dependency membership.
4. Upsert dependency formulae into `entries` with `dependency = true`.
5. Skip all already-known dependency entries from enrichment, metrics, and reporting.
6. Upsert non-dependency GH/HB/HBC entries into `entries`.
7. For Homebrew entries that are new or newly trending, fetch detail JSON and enrich `description` and `url`.
8. Write one `daily_metrics` row per surviving non-dependency entry for the run date.
9. Compute report sections from stored history.
10. Write the Markdown report to a dated file under `reports/`.
11. Store the output record in `run_reports`.

## Report Semantics

### GitHub

- **Newcomers**
  - A repo is a newcomer if it appears in any of the GH feeds on the run date and has never been seen in any GH feed before.
- **Risers**
  - Select the top 10 GH entries with the highest positive `live_change`.

### Homebrew / Homebrew Cask

- **Newcomers**
  - An entry is a newcomer when it appears in analytics for the first recorded time.
- **Risers**
  - Select the top 10 HB/HBC entries with the highest positive `live_change`.
- **Losers**
  - Select the top 10 HB/HBC entries with the lowest `alltime_change`.

### Output Rules

- GitHub rows render with stars and language.
- Homebrew formula rows use `>_`.
- Homebrew cask rows use `🖥️`.
- Cask install/uninstall commands include `--cask`.
- Dependency formulae never appear in any section.

## Markdown Output Shape

The report writer should produce:

```md
# Trending tools

## GitHub

### Newcomers

[**name**](url) - xx ⭐

- _language_
  Description

### Risers

**+xx%** 📈 [**name**](url) - xx ⭐

- _language_
  Description

## HomeBrew (30 days)

### Newcomers

> \_ [**name**](url) - xxx 📥
> Description
> `brew install name`

### Risers

**+xx%** 📈 >\_ [**name**](url) - xxx 📥
Description
`brew install name`

### Losers

**-xx%** 📉 >\_ [**name**](url) - xxx 📥
Description
`brew uninstall name`
```

For casks, replace `>_` with `🖥️` and add `--cask` before the cask name in install/uninstall commands.

## Error Handling

- A failed source fetch or parse fails the run clearly.
- The application must not emit a success-shaped report if any required source failed.
- Rerunning for the same date must be safe and non-duplicating.
- Errors should identify:
  - source
  - run date
  - stage (`fetch`, `parse`, `enrich`, `persist`, `report`)

## Testing Strategy

- Parser tests for GitHub Trending HTML fixtures
- Parser tests for Homebrew analytics and detail JSON fixtures
- Storage tests for:
  - dependency detection and exclusion
  - entry upserts
  - first-seen detection
  - `live_change` calculation
  - `alltime_change` calculation
- End-to-end CLI tests for:
  - first bootstrap run
  - subsequent daily run
  - expected Markdown ordering and formatting

## Migration Direction

The application should use a storage layer and migrations strategy that works cleanly with SQLite now and MariaDB later. The schema stays normalized so the migration mainly affects the adapter and SQL dialect details, not the domain model.

## Open Decisions Resolved

- Execution model: scheduled CLI job
- Report destination: dated Markdown files under `reports/`
- GH metric stored daily: repository total stars
- GH duplicates across feeds: one GH entry per repo, with daily per-feed trending deltas stored on the metric row
- Best overall approach: normalized storage, not a date-column table
