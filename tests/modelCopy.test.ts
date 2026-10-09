import assert from "node:assert/strict";
import { test } from "node:test";
import { copiedModelFormValues, modelFormValues } from "../src/utils/modelForm.ts";
import type { ModelVersion } from "../src/types/domain.ts";

const source: ModelVersion = {
  id: 7,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  provider: "google",
  model: "gemini-3.1-flash-image",
  version: "gemini-3.1-flash-image-preview",
  display_name: "Nano Banana 2",
  logo_url: "https://cdn.example.com/google.png",
  capability: "image",
  enabled: true,
  task_mode: "sync",
  allowed_plans: ["team"],
  operation_codes: ["image.text_to_image", "image.image_to_image"],
  pricing: { output_credit_rate: 54 },
  params_schema: { fields: [{ name: "ratio" }] },
  result_schema: { kind: "image" },
  system_prompts: { "image.text_to_image": "be nice" },
} as ModelVersion;

test("edit form carries every writable field of the model", () => {
  assert.deepEqual(modelFormValues(source), {
    provider: "google",
    model: "gemini-3.1-flash-image",
    version: "gemini-3.1-flash-image-preview",
    display_name: "Nano Banana 2",
    logo_url: "https://cdn.example.com/google.png",
    capability: "image",
    enabled: true,
    task_mode: "sync",
    allowed_plans: ["team"],
    operation_codes: ["image.text_to_image", "image.image_to_image"],
    pricing: { output_credit_rate: 54 },
    params_schema: { fields: [{ name: "ratio" }] },
    result_schema: { kind: "image" },
    system_prompts: { "image.text_to_image": "be nice" },
  });
});

test("copy keeps all config but forces a new version and starts disabled", () => {
  const copy = copiedModelFormValues(source);
  assert.equal(copy.version, "", "operator must type the new model version id");
  assert.equal(copy.display_name, "Nano Banana 2 (副本)");
  assert.equal(copy.enabled, false, "copy stays off until verified");
  assert.deepEqual(copy, {
    ...modelFormValues(source),
    version: "",
    display_name: "Nano Banana 2 (副本)",
    enabled: false,
  });
});

test("copy does not share nested objects with the source", () => {
  const copy = copiedModelFormValues(source);
  (copy.operation_codes as string[]).push("mutated");
  (copy.system_prompts as Record<string, string>)["image.text_to_image"] = "mutated";
  assert.deepEqual(source.operation_codes, ["image.text_to_image", "image.image_to_image"]);
  assert.equal(source.system_prompts?.["image.text_to_image"], "be nice");
});
