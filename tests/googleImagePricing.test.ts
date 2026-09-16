import assert from "node:assert/strict";
import { test } from "node:test";
import { applyGoogleImagePricing, googleImageOutputCosts, googleImageSpec, validGoogleImagePricing } from "../src/utils/googleImagePricing.ts";

const nano = googleImageSpec("google", "gemini-3.1-flash-image", "image")!;
const pro = googleImageSpec("google", "gemini-3-pro-image", "image")!;
const basic = googleImageSpec("google", "gemini-2.5-flash-image", "image")!;

test("only exact official image versions select cost billing", () => {
  assert.ok(nano);
  assert.ok(pro);
  assert.ok(basic);
  for (const [provider, version, capability] of [
    ["openai", "gemini-3-pro-image", "image"],
    ["google", "gemini-3-pro-image", "responses"],
    ["google", "gemini-3-pro-image-preview", "image"],
  ]) assert.equal(googleImageSpec(provider, version, capability), undefined);
});

test("200-credit legacy config is never a valid at-cost config", () => {
  assert.equal(validGoogleImagePricing(nano, null), false);
  assert.equal(validGoogleImagePricing(nano), false);
  const old = { unit: "generation", input_credit_rate: 0, output_credit_rate: 200, provider_concurrency_limit: 8 };
  assert.equal(validGoogleImagePricing(nano, old), false);
  assert.deepEqual(googleImageOutputCosts(nano, old), []);
  const next = applyGoogleImagePricing(nano, old);
  assert.equal(validGoogleImagePricing(nano, next), true);
  assert.equal(next.unit, "provider_cost");
  assert.equal(next.output_credit_rate, 0);
  assert.equal(next.provider_concurrency_limit, 8);
  assert.equal(next.provider_cost_to_cny_ppm, 7_300_000);
  assert.equal(old.output_credit_rate, 200);
});

test("model changes require updated official rates, preserving configured FX", () => {
  const old = applyGoogleImagePricing(nano, { provider_cost_to_cny_ppm: 7_200_000 });
  assert.equal(validGoogleImagePricing(pro, old), false);
  const next = applyGoogleImagePricing(pro, old);
  assert.equal(validGoogleImagePricing(pro, next), true);
  assert.equal(next.provider_cost_to_cny_ppm, 7_200_000);
  assert.deepEqual(next.provider_cost_cents_per_million_tokens_by_usage, { input: 200, text_output: 1200, image_output: 12000 });
});

test("cost preview shows image-output-only floors, not the old 200 credits", () => {
  assert.deepEqual(googleImageOutputCosts(basic, applyGoogleImagePricing(basic)).map(r => r.credits), [15]);
  assert.deepEqual(googleImageOutputCosts(nano, applyGoogleImagePricing(nano)).map(r => r.credits), [17, 25, 37, 56]);
  assert.deepEqual(googleImageOutputCosts(pro, applyGoogleImagePricing(pro)).map(r => r.credits), [50, 50, 88]);
  assert.equal(googleImageOutputCosts(nano, applyGoogleImagePricing(nano))[1].cny, 0.49056);
});

test("reject invalid FX, retail rates and credit conversion", () => {
  const pricing = applyGoogleImagePricing(nano);
  for (const fx of [0, -1, NaN, Infinity, 7.3, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validGoogleImagePricing(nano, { ...pricing, provider_cost_to_cny_ppm: fx }), false);
  }
  for (const patch of [
    { input_credit_rate: 1 }, { output_credit_rate: 200 },
    { revenue_cents_per_thousand_credits: 1000 }, { provider_cost_currency: "CNY" },
    { provider_cost_cents_per_million_tokens_by_usage: { input: 50, text_output: 300, image_output: 60 } },
  ]) assert.equal(validGoogleImagePricing(nano, { ...pricing, ...patch }), false);
});
