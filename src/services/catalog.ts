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
    .onConflict((oc) =>
      oc.columns(['source', 'source_key']).doUpdateSet({
        name: input.name,
        description: input.description,
        language: input.language,
        url: input.url,
        dependency: input.dependency ? 1 : 0,
        updated_at: input.seenAt
      })
    )
    .execute();

  const row = await db
    .selectFrom('entries')
    .select('id')
    .where('source', '=', input.source)
    .where('source_key', '=', input.sourceKey)
    .executeTakeFirstOrThrow();

  return row.id;
}
