import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isManualVideoActive, manualRequest, manualResult, manualVideoMime } from '../src/utils/manualVideo.ts';

test('manual media parsing rejects invalid references and unsafe result links', () => {
  assert.deepEqual(manualRequest(null), { duration: undefined, resolution: undefined, ratio: undefined, input_assets: [] });
  const request = manualRequest({ duration: 300, resolution: '720p', ratio: '16:9', input_assets: [null, { asset_id: -1 }, { asset_id: '12' }, { asset_id: 12, role: 'image' }] });
  assert.equal(request.duration, 300);
  assert.deepEqual(request.input_assets, [{ asset_id: 12, role: 'image' }]);
  assert.deepEqual(manualResult({ video_url: 'javascript:alert(1)', manual_asset_id: -2 }), { assetID: undefined, url: undefined });
  assert.equal(manualResult({ manual_asset_id: 123 }).assetID, 123);
  assert.equal(manualResult({ video_url: 'https://cdn.example.com/video.mp4' }).url, 'https://cdn.example.com/video.mp4');
});

test('manual video workflow only enables writes for the two production states', () => {
  for (const status of ['awaiting_manual', 'manual_processing']) assert.equal(isManualVideoActive(status), true);
  for (const status of ['succeeded', 'failed', 'cancelled', 'running', 'unknown']) assert.equal(isManualVideoActive(status), false);
});

test('MOV uploads work when browsers omit MIME without accepting disguised non-video MIME', () => {
  assert.equal(manualVideoMime('成片.MOV', ''), 'video/quicktime');
  assert.equal(manualVideoMime('clip.mp4', 'application/octet-stream'), 'video/mp4');
  assert.equal(manualVideoMime('clip.webm', 'video/webm'), 'video/webm');
  assert.equal(manualVideoMime('clip.mp4', 'text/html'), undefined);
  assert.equal(manualVideoMime('clip.html', ''), undefined);
});
