import assert from "node:assert/strict";
import { test } from "node:test";
import { mediaCreditsPerThousandTokens } from "../src/utils/mediaCostPricing.ts";

test("GPT input/output token prices convert to credits without a thousand-fold error", () => {
  assert.equal(mediaCreditsPerThousandTokens(500, 7_300_000), 1.825);
  assert.equal(mediaCreditsPerThousandTokens(800, 7_300_000), 2.92);
  assert.equal(mediaCreditsPerThousandTokens(3000, 7_300_000), 10.95);
  assert.equal(mediaCreditsPerThousandTokens(3000, 7_000_000), 10.5);
  assert.equal(mediaCreditsPerThousandTokens(125, 7_300_000), 0.45625);
});

test("missing or invalid FX is not silently replaced with a guessed exchange rate", () => {
  for (const fx of [undefined, 0, -1, Infinity, NaN]) {
    assert.equal(mediaCreditsPerThousandTokens(3000, fx), null);
  }
  assert.equal(mediaCreditsPerThousandTokens(0, 7_300_000), 0);
});
