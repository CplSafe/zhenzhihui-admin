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
