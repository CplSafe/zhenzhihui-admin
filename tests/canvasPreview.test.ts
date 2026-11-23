import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasPreviewGraph } from "../src/utils/canvasPreview.ts";
import type { CanvasPreviewElement } from "../src/api/userCanvases.ts";

test("preview uses stored positions and dimensions and preserves valid connections", () => {
  const graph = canvasPreviewGraph([
    { kind: "node", element_id: "child", updated_revision: 1, payload: { type: "image", parentId: "parent", position: { x: 80, y: 40 }, style: { width: "320px", height: 180 } } },
    { kind: "node", element_id: "parent", updated_revision: 1, payload: { type: "text", position: { x: -100, y: 30 }, data: { body: "旧版创作正文" } } },
    { kind: "edge", element_id: "link", updated_revision: 1, payload: { source: "parent", target: "child" } },
    { kind: "edge", element_id: "invalid", updated_revision: 1, payload: { source: "parent", target: "missing" } },
  ]);

  assert.deepEqual(graph.nodes.map(({ id, x, y }) => ({ id, x, y })), [
    { id: "child", x: -20, y: 70 },
    { id: "parent", x: -100, y: 30 },
  ]);
  assert.deepEqual([graph.nodes[0].width, graph.nodes[0].height], [320, 180]);
  assert.equal(graph.nodes[1].text, "旧版创作正文");
  assert.deepEqual(graph.edges.map(({ id, source, target }) => [id, source.id, target.id]), [["link", "parent", "child"]]);
});

test("preview ignores raw media references and deleted elements", () => {
  const node: CanvasPreviewElement = {
    kind: "node",
    element_id: "video",
    updated_revision: 2,
    payload: { type: "video", data: { assetId: 987, resultUrl: "https://user-url.invalid", posterAssetId: 988, prompt: "制作提示" } },
    preview_media: { asset_id: 12, image_asset_ids: [12, 13], poster_asset_id: 14 },
  };
  const graph = canvasPreviewGraph([node, { ...node, element_id: "deleted", deleted: true }]);
  assert.equal(graph.nodes.length, 1);
  assert.deepEqual(graph.nodes[0].assets.map(({ id }) => id), [12, 13, 14]);
  assert.equal(graph.nodes[0].prompt, "制作提示");
  assert.equal(JSON.stringify(graph).includes("user-url.invalid"), false);
});

test("legacy and malformed parent cycles still yield finite preview coordinates", () => {
  const graph = canvasPreviewGraph([
    { kind: "node", element_id: "loop-a", updated_revision: 1, payload: { type: "__proto__", parentNode: "loop-b", position: { x: 30 } } },
    { kind: "node", element_id: "loop-b", updated_revision: 1, payload: { type: "text", parentId: "loop-a", position: { x: 40 } } },
  ]);
  assert.ok(graph.nodes.every(({ x, y, width, height }) => [x, y, width, height].every(Number.isFinite)));
});
