import fs from 'node:fs/promises';
import path from 'node:path';

import { createDatabase } from '../db/database.js';
import { migrate } from '../db/migrate.js';
import { upsertEntry } from '../services/catalog.js';
import { recordDailyMetric } from '../services/metrics.js';
import { renderDailyReport, renderTelegramReport, selectReportData } from '../services/reporting.js';

export type RunDailyGithubItem = {
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
};

export type RunDailyHomebrewItem = {
  source: 'HB' | 'HBC';
  sourceKey: string;
  name: string;
  description: string | null;
  language: null;
  url: string | null;
  dependency: boolean;
  metricValue: number;
};

export type RunDailyOutputFormat = 'markdown' | 'telegram-html';

export async function runDaily(input: {
  runDate: string;
  databasePath: string;
  reportsDir: string;
  outputFormats?: RunDailyOutputFormat[];
  githubItems: RunDailyGithubItem[];
  homebrewItems: RunDailyHomebrewItem[];
}) {
  const db = createDatabase(input.databasePath);
  const createdAt = new Date().toISOString();

  try {
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

      if ('dependency' in item && item.dependency) {
        continue;
      }

      await recordDailyMetric(db, {
        entryId,
        metricDate: input.runDate,
        metricValue: 'metricValue' in item ? item.metricValue : item.totalStars,
        ghTodayChange: 'ghTodayChange' in item ? item.ghTodayChange : null,
        ghWeeklyChange: 'ghWeeklyChange' in item ? item.ghWeeklyChange : null,
        ghMonthlyChange: 'ghMonthlyChange' in item ? item.ghMonthlyChange : null
      });
    }

    const reportData = await selectReportData(db, input.runDate);
    const markdown = renderDailyReport(reportData);
    const outputFormats = input.outputFormats ?? ['markdown'];
    const wantsTelegramHtml = outputFormats.includes('telegram-html');

    await fs.mkdir(input.reportsDir, { recursive: true });
    const outputPath = path.join(input.reportsDir, `${input.runDate}.md`);
    await fs.writeFile(outputPath, markdown, 'utf8');

    let telegramHtml: string | undefined;
    let telegramHtmlPath: string | undefined;
    if (wantsTelegramHtml) {
      telegramHtml = renderTelegramReport(reportData, input.runDate);
      telegramHtmlPath = path.join(input.reportsDir, `${input.runDate}.telegram.html`);
      await fs.writeFile(telegramHtmlPath, telegramHtml, 'utf8');
    }

    await db
      .insertInto('run_reports')
      .values({
        run_date: input.runDate,
        output_path: outputPath,
        created_at: createdAt
      })
      .onConflict((oc) =>
        oc.column('run_date').doUpdateSet({
          output_path: outputPath
        })
      )
      .execute();

    return {
      outputPath,
      markdown,
      json: reportData,
      reportRecorded: true,
      telegramHtmlPath,
      telegramHtml
    };
  } finally {
    await db.destroy();
  }
}
