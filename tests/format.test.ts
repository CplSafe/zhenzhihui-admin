import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtCredits, fmtSignedCredits } from "../src/utils/format.ts";

test("fmtCredits shows up to 3 decimals with thousands separators", () => {
  assert.equal(fmtCredits(0), "0");
  assert.equal(fmtCredits(0.044), "0.044");
  assert.equal(fmtCredits(854.123), "854.123");
  assert.equal(fmtCredits(1234567.5), "1,234,567.5");
  assert.equal(fmtCredits(100), "100");
  assert.equal(fmtCredits(-0.044), "-0.044");
  assert.equal(fmtCredits(-1234.5), "-1,234.5");
  assert.equal(fmtCredits(0.1 + 0.2), "0.3");
  assert.equal(fmtCredits(null), "-");
  assert.equal(fmtCredits(undefined), "-");
});

test("fmtSignedCredits prefixes + for credits and keeps - for debits", () => {
  assert.equal(fmtSignedCredits(1234.5), "+1,234.5");
  assert.equal(fmtSignedCredits(-0.044), "-0.044");
  assert.equal(fmtSignedCredits(0), "0");
  assert.equal(fmtSignedCredits(null), "-");
});
