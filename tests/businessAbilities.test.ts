import assert from "node:assert/strict";
import { test } from "node:test";
import {
  abilityModelOptions,
  modelAbilityOptions,
  abilitySupportsModel,
  fitsAbilityTextLimit,
} from "../src/utils/businessAbilities.ts";
import type { BusinessAbility, ModelVersion } from "../src/types/domain.ts";

const relight: BusinessAbility = {
  code: "relight",
  display_name: "打光",
  description: "",
  enabled: true,
  operation_code: "image.image_to_image",
  tool_code: "image.relight",
  tool_version: 1,
  default_model_version_id: 7,
};
const edit: BusinessAbility = {
  ...relight,
  code: "image_edit",
  display_name: "编辑",
  enabled: false,
  tool_code: "",
  tool_version: 0,
  default_model_version_id: 0,
};
const model = {
  id: 7,
  display_name: "Qwen",
  version: "qwen-image-2.0-2026-03-03",
  enabled: true,
  provider: "bailian",
  model: "qwen-image-2.0-2026-03-03",
  capability: "image",
  operation_codes: ["image.image_to_image"],
  ability_codes: ["relight", "image_edit"],
} as ModelVersion;

test("default models must be assigned to the ability and support its execution", () => {
  const options = abilityModelOptions(relight, [
    model,
    { ...model, id: 8, ability_codes: [] },
    { ...model, id: 9, operation_codes: ["image.text_to_image"] },
    { ...model, id: 10, enabled: false },
  ]);
  assert.deepEqual(
    options.map((o) => [o.value, o.disabled]),
    [
      [7, false],
      [10, false],
    ],
  );
});

test("model checkboxes preserve disabled assignments and exclude new disabled or incompatible abilities", () => {
  const options = modelAbilityOptions(
    [
      relight,
      edit,
      { ...edit, code: "unassigned_disabled" },
      { ...relight, code: "video", operation_code: "video.generate" },
    ],
    model,
    ["image_edit", "old_missing"],
    7,
  );
  assert.deepEqual(
    options.map((o) => o.value),
    ["relight", "image_edit", "old_missing"],
  );
  assert.equal(
    options.find((o) => o.value === "relight")?.disabled,
    true,
    "default assignment cannot be removed before clearing the default",
  );
  assert.equal(options.find((o) => o.value === "image_edit")?.disabled, false);
});

test("assigned abilities stay visible after operation edits so they are never silently detached", () => {
  const options = modelAbilityOptions(
    [relight],
    { ...model, operation_codes: ["image.text_to_image"] },
    ["relight"],
    0,
  );
  assert.equal(options.length, 1);
  assert.match(options[0].label, /操作不匹配/);
});

test("tool compatibility follows backend provider, capability and template gates", () => {
  assert.equal(abilitySupportsModel(relight, model), true);
  assert.equal(
    abilitySupportsModel(relight, { ...model, capability: "video" }),
    false,
  );
  assert.equal(
    abilitySupportsModel(relight, { ...model, operation_codes: [] }),
    false,
  );
  assert.equal(
    abilitySupportsModel(relight, {
      ...model,
      provider: "openai",
      model: "unknown",
    }),
    false,
  );
  assert.equal(
    abilitySupportsModel(relight, {
      ...model,
      provider: "openai",
      model: "gpt-image-2",
    }),
    true,
  );
  assert.equal(
    abilitySupportsModel(
      { ...relight, tool_code: "image.multi_angle", tool_version: 2 },
      model,
    ),
    true,
  );
  assert.equal(
    abilitySupportsModel(
      { ...relight, tool_code: "image.multi_angle", tool_version: 2 },
      { ...model, provider: "openai", model: "gpt-image-2" },
    ),
    false,
  );
  assert.equal(
    abilitySupportsModel(
      { ...relight, tool_code: "image.portrait_texture", tool_version: 2 },
      model,
    ),
    false,
  );
  assert.equal(
    abilitySupportsModel(
      { ...relight, tool_code: "image.panorama" },
      { ...model, provider: "google", model: "gemini-3-pro-image" },
    ),
    false,
  );
});

test("ability text validates UTF-8 byte limits rather than character counts", () => {
  assert.equal(fitsAbilityTextLimit("name", "打".repeat(42)), true);
  assert.equal(fitsAbilityTextLimit("name", "打".repeat(43)), false);
  assert.equal(fitsAbilityTextLimit("description", "光".repeat(1365)), true);
  assert.equal(fitsAbilityTextLimit("description", "光".repeat(1366)), false);
  assert.equal(fitsAbilityTextLimit("description", "a".repeat(4096)), true);
  assert.equal(fitsAbilityTextLimit("description", "a".repeat(4097)), false);
});
