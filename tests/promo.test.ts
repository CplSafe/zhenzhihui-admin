import test from "node:test";
import assert from "node:assert/strict";
import {
  promisedDate,
  promoCapabilities,
  promoEventContent,
  promoIsOverdue,
} from "../src/utils/promo.ts";
test("promise date uses Beijing exclusive deadline, regardless of viewer timezone", () => {
  assert.equal(promisedDate("2026-11-07T16:00:00Z"), "2026-11-07");
  assert.equal(promisedDate("2026-11-08T00:00:00+08:00"), "2026-11-07");
  assert.equal(promisedDate(undefined), "—");
  assert.equal(promisedDate("invalid"), "—");
});
test("review and refund controls follow separate production and billing states", () => {
  const order = {
    status: "review",
    billing_status: "frozen",
    candidate_material_id: 92,
    rework_status: "unused",
  };
  assert.equal(promoCapabilities(order).review, true);
  assert.equal(promoCapabilities(order).refund, true);
  assert.equal(promoCapabilities(order).upload, false);
  const delivered = {
    ...order,
    status: "delivered",
    billing_status: "settled",
    first_delivered_at: "2026-11-03T00:00:00Z",
    rework_status: "requested",
  };
  assert.equal(promoCapabilities(delivered).rework, true);
  assert.equal(promoCapabilities(delivered).refund, false);
  assert.equal(
    promoCapabilities({
      ...delivered,
      status: "reworking",
      rework_status: "accepted",
    }).upload,
    true,
  );
  assert.equal(
    promoCapabilities({
      ...order,
      status: "cancelled",
      billing_status: "refunded",
    }).stage,
    false,
  );
});
test("overdue starts at cutoff and excludes delivered or cancelled orders", () => {
  const due_at = "2026-11-07T16:00:00Z",
    now = Date.parse(due_at);
  assert.equal(promoIsOverdue({ due_at, status: "review" }, now - 1), false);
  assert.equal(promoIsOverdue({ due_at, status: "review" }, now), true);
  for (const status of ["delivered", "completed", "cancelled"])
    assert.equal(promoIsOverdue({ due_at, status }, now), false);
});
test("audit snapshots expose changed assignments while preserving freeform reasons", () => {
  assert.equal(
    promoEventContent('{"assigned_note":"小陈"}\n{"assigned_note":"小李"}'),
    "谁在做：小陈 → 小李",
  );
  assert.equal(promoEventContent("客户来电放弃制作"), "客户来电放弃制作");
  assert.equal(promoEventContent("第一行\n第二行"), "第一行\n第二行");
});
