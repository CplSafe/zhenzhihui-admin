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

// credits = ceil(cnyNano / 20,000) milli / 1000; cnyNano = ceil(tokens × rate × 10 × 7.3) at FX 7,300,000 ppm.
test("cost preview shows image-output-only floors, not the old 200 credits", () => {
  // 1K: 282,510,000 nano ÷ 20,000 = 14,125.5 → 14,126 milli = 14.126
  assert.deepEqual(googleImageOutputCosts(basic, applyGoogleImagePricing(basic)).map(r => r.credits), [14.126]);
  // 512: 327,186,000 nano ÷ 20,000 = 16,359.3 → 16,360 milli = 16.36
  // 1K:  490,560,000 nano ÷ 20,000 = 24,528 milli = 24.528
  // 2K:  735,840,000 nano ÷ 20,000 = 36,792 milli = 36.792
  // 4K:  1,103,760,000 nano ÷ 20,000 = 55,188 milli = 55.188
  assert.deepEqual(googleImageOutputCosts(nano, applyGoogleImagePricing(nano)).map(r => r.credits), [16.36, 24.528, 36.792, 55.188]);
  // 1K/2K: 981,120,000 nano ÷ 20,000 = 49,056 milli = 49.056
  // 4K:    1,752,000,000 nano ÷ 20,000 = 87,600 milli = 87.6
  assert.deepEqual(googleImageOutputCosts(pro, applyGoogleImagePricing(pro)).map(r => r.credits), [49.056, 49.056, 87.6]);
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
