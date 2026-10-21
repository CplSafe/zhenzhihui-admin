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
  operation_code: "image.relight",
  execution_operation_code: "image.image_to_image",
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
      {
        ...relight,
        code: "video",
        operation_code: "video.generate",
        execution_operation_code: "video.generate",
      },
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

test("arbitrary public operation strings use the execution capability and explicit declarations", () => {
  const custom = { ...relight, operation_code: "品牌 灯光/编辑:v3" };
  assert.equal(
    abilitySupportsModel(custom, {
      ...model,
      operation_codes: [custom.operation_code],
    }),
    true,
  );
  assert.equal(
    abilitySupportsModel(custom, model),
    true,
    "native execution declarations remain compatible",
  );
  assert.equal(
    abilitySupportsModel(custom, { ...model, operation_codes: ["unknown"] }),
    false,
  );
  assert.equal(
    abilitySupportsModel(custom, {
      ...model,
      operation_codes: [custom.operation_code],
      capability: "responses",
    }),
    false,
  );
});

test("registered aliases require exactly the same execution and tool template", () => {
  const custom = { ...relight, operation_code: "business/custom" };
  const alias = {
    ...relight,
    code: "other",
    operation_code: "alias/current",
    enabled: false,
  };
  const declared = { ...model, operation_codes: [alias.operation_code] };
  assert.equal(abilitySupportsModel(custom, declared, [custom, alias]), true);
  assert.equal(
    abilitySupportsModel(custom, declared, [
      custom,
      { ...alias, tool_version: 2 },
    ]),
    false,
  );
  assert.equal(
    abilitySupportsModel(custom, declared, [
      custom,
      { ...alias, tool_code: "" },
    ]),
    false,
  );
  assert.equal(
    abilitySupportsModel(custom, declared, [
      custom,
      { ...alias, execution_operation_code: "image.text_to_image" },
    ]),
    false,
  );
  assert.deepEqual(
    abilityModelOptions(custom, [declared], [custom, alias]).map(
      (o) => o.value,
    ),
    [7],
  );
});

test("default preview remaps an edited public operation without losing assigned models", () => {
  const pending = { ...relight, operation_code: "brand/renamed" };
  const declared = { ...model, operation_codes: [relight.operation_code] };
  assert.deepEqual(
    abilityModelOptions(
      pending,
      [declared],
      [pending],
      relight.operation_code,
    ).map((o) => o.value),
    [7],
  );
  assert.deepEqual(
    abilityModelOptions(
      {
        ...pending,
        execution_operation_code: "video.generate",
        tool_code: "",
        tool_version: 0,
      },
      [declared],
      [],
      relight.operation_code,
    ),
    [],
  );
});

test("public operation byte limit permits arbitrary names without an image prefix", () => {
  assert.equal(fitsAbilityTextLimit("operation", "品牌 灯光/编辑:v3"), true);
  assert.equal(fitsAbilityTextLimit("operation", "a".repeat(128)), true);
  assert.equal(fitsAbilityTextLimit("operation", "a".repeat(129)), false);
  assert.equal(fitsAbilityTextLimit("operation", "光".repeat(43)), false);
});
