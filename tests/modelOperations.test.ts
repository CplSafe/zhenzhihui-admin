import assert from "node:assert/strict";
import { test } from "node:test";
import * as operations from "../src/utils/businessAbilities.ts";

test("model operation choices include native upscale/audio and retain custom selections", () => {
  assert.equal(typeof operations.modelOperationOptions, "function", "missing complete operation discovery");
  const options = operations.modelOperationOptions([], ["custom.operation", "video.upscale"]);
  for (const code of ["image.upscale", "video.upscale", "video.generate", "audio.text_to_speech", "custom.operation"]) {
    assert.ok(options.some(option => option.value === code), `missing ${code}`);
  }
  assert.equal(options.filter(option => option.value === "video.upscale").length, 1);
});

test("business names and disabled state are shown without duplicate native operations", () => {
  assert.equal(typeof operations.modelOperationOptions, "function");
  const options = operations.modelOperationOptions([{ operation_code: "image.upscale", display_name: "图片超分", enabled: false }], []);
  assert.equal(options.filter(option => option.value === "image.upscale").length, 1);
  assert.match(options.find(option => option.value === "image.upscale")!.label, /图片超分.*已停用/);
});

test("renaming an operation preserves unsaved choices and native execution declarations", () => {
 assert.equal(typeof operations.reconcileModelOperations, "function");
 const before = [{code:"edit", operation_code:"old.edit"}, {code:"generate", operation_code:"image.text_to_image"}];
 const after = [{code:"edit", operation_code:"new.edit"}, {code:"generate", operation_code:"custom.generate"}];
 assert.deepEqual(operations.reconcileModelOperations(["old.edit", "image.text_to_image", "unsaved.custom"],before,after,["generate"]),["new.edit","image.text_to_image","unsaved.custom","custom.generate"]);
});
