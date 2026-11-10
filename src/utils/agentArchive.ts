export type ArchiveRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is ArchiveRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function normalizeAgentArchive(value: unknown) {
  const source = isRecord(value) ? value : {};
  const tables = (input: unknown): Record<string, ArchiveRecord[]> =>
    Object.fromEntries(Object.entries(isRecord(input) ? input : {})
      .map(([name, rows]) => [name, Array.isArray(rows) ? rows.filter(isRecord) : []]));
  return {
    run: isRecord(source.run) ? source.run : {},
    tables: tables(source.tables),
    checkpoint_tables: tables(source.checkpoint_tables),
  };
}

export function checkpointCounts(tables: Record<string, ArchiveRecord[]>) {
  const counts: Record<string, number> = {};
  for (const [table, rows] of Object.entries(tables)) {
    if (table !== 'packed') { counts[table] = rows.length; continue; }
    for (const row of rows) {
      if (row.encoding !== 'xz+base64' || !isRecord(row.table_counts)) continue;
      for (const [name, count] of Object.entries(row.table_counts)) {
        if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)
          counts[name] = (counts[name] || 0) + count;
      }
    }
  }
  return counts;
}
