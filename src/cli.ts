import { pathToFileURL } from 'node:url';

import { collectGitHubTrending, fetchGitHubTrendingPage } from './collectors/github-trending.js';
import { fetchHomebrewAnalytics } from './collectors/homebrew.js';
import { runDaily } from './commands/run-daily.js';
import { SQLITE_PATH, isoDate } from './config.js';

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help') {
    console.log('Usage: tool-discovery run-daily');
    return 0;
  }

  if (argv[0] === 'run-daily') {
    console.log('Collecting GitHub Trending...');
    const [githubItems, homebrewItems] = await Promise.all([
      collectGitHubTrending(fetchGitHubTrendingPage),
      fetchHomebrewAnalytics()
    ]);
    console.log(
      `Collected ${githubItems.length} GitHub items, ${homebrewItems.length} Homebrew items`
    );

    const result = await runDaily({
      runDate: isoDate(),
      databasePath: SQLITE_PATH,
      reportsDir: 'reports',
      githubItems,
      homebrewItems
    });
    console.log(`Report written to ${result.outputPath}`);
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
