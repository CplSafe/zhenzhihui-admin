export const promoStates = [
  { value: "pending", label: "待制作" },
  { value: "producing", label: "制作中" },
  { value: "review", label: "待复核" },
  { value: "delivered", label: "已交付" },
  { value: "reworking", label: "返工中" },
  { value: "overdue", label: "逾期" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];
export const billingLabels: Record<string, string> = {
  frozen: "已冻结",
  settled: "已结算",
  refunded: "已退回",
};
export function promisedDate(value?: string) {
  if (!value) return "—";
  const time = new Date(value).getTime() - 1;
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(time)
    : "—";
}
export function promoCapabilities(o: {
  status: string;
  billing_status: string;
  first_delivered_at?: string;
  candidate_material_id?: number;
  rework_status: string;
}) {
  const active = !["delivered", "completed", "cancelled"].includes(o.status);
  return {
    active,
    note: !["completed", "cancelled"].includes(o.status),
    start: o.status === "pending" || o.status === "overdue",
    upload: ["producing", "reworking", "overdue"].includes(o.status),
    stage: ["producing", "reworking", "overdue", "review"].includes(o.status),
    review:
      (o.status === "review" || o.status === "overdue") &&
      !!o.candidate_material_id,
    refund: o.billing_status === "frozen" && !o.first_delivered_at,
    rework: o.status === "delivered" && o.rework_status === "requested",
  };
}
export const promoIsOverdue = (
  o: { due_at: string; status: string },
  now = Date.now(),
) =>
  !["delivered", "completed", "cancelled"].includes(o.status) &&
  new Date(o.due_at).getTime() <= now;
export const promoEventLabels: Record<string, string> = {
  order_submitted: "提交订单",
  assignment_note: "更新谁在做",
  started: "开始制作",
  rescheduled: "调整承诺日",
  reschedule_reason: "改期原因",
  staged: "回传成片待复核",
  review_rejected: "复核退回",
  review_rejection_reason: "复核退回原因",
  order_delivered: "交付视频",
  refunded: "终止制作并退积分",
  refund_reason: "退款原因",
  rework_request: "客户申请修改",
  rework_accepted: "受理返工",
  rework_rejected: "婉拒修改",
  quality_marked: "更新低清标记",
  notice_retried: "重试提醒",
  deadline_tick: "期限状态更新",
};
// Audit snapshots are two complete JSON objects separated by a newline; render only changed fields.
export function promoEventContent(content: string): string {
  const lines = content.split("\n");
  if (lines.length !== 2) return content;
  try {
    const before = JSON.parse(lines[0]);
    const after = JSON.parse(lines[1]);
    const labels: Record<string, string> = {
      status: "制作状态",
      assigned_note: "谁在做",
      due_at: "承诺截止时间",
      billing_status: "计费状态",
      delivery_note: "交付说明",
      candidate_delivery_note: "候选交付说明",
      rework_reply: "修改回复",
      low_resolution: "低清标记",
      rework_status: "返工状态",
      candidate_material_id: "候选视频",
      delivered_material_id: "交付视频",
    };
    return (
      Object.entries(labels)
        .filter(
          ([key]) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
        )
        .map(
          ([key, label]) =>
            `${label}：${String(before[key] ?? "—")} → ${String(after[key] ?? "—")}`,
        )
        .join("\n") || "订单状态已更新"
    );
  } catch {
    return content;
  }
}
