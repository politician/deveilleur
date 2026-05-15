import path from 'node:path';

export const SQLITE_PATH = path.join(process.cwd(), 'data', 'tool-discovery.sqlite');

export function isoDate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}
