import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgentArchive } from '../src/utils/agentArchive.ts';

test('untrusted and historical archive shapes remain readable', () => {
  for (const value of [null, [], {}, { run: null, tables: 'bad', checkpoint_tables: 1 }]) {
    assert.deepEqual(normalizeAgentArchive(value), { run: {}, tables: {}, checkpoint_tables: {} });
  }
  const value = { run: { id: 'run' }, tables: { production_batches: [null, 2, [], { data: { nodes: {} } }], events: null }, checkpoint_tables: {} };
  const result = normalizeAgentArchive(value);
  assert.equal(result.run.id, 'run');
  assert.deepEqual(result.tables.production_batches, [{ data: { nodes: {} } }]);
  assert.deepEqual(result.tables.events, []);
  assert.equal(value.tables.production_batches.length, 4);
});
