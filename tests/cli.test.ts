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
