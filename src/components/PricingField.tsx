import { useState } from "react";
import { Collapse, InputNumber, Space, Table, Typography } from "antd";
import { JsonField } from "@/components/JsonField";
import type { Pricing, TierTokenRate } from "@/types/domain";

interface PricingFieldProps {
  value?: Pricing;
  onChange?: (value: Pricing) => void;
  // 高级 JSON 解析失败时上报,沿用 ModelsPage 的保存禁用逻辑。
  onValidityChange?: (valid: boolean) => void;
  // 模型能力(responses / image / video):仅影响预览文案与是否显示视频专属字段,
  // 不改变底层字段——三类模型都按 xxx_credit_rate × token 结算。
  capability?: string;
}

// 结构化承载的常用字段;其余(并发限制等)留高级 JSON。
// video 多承载 hold_credits_per_second(按时长预冻占位)与 per-tier 单价表。
const COMMON_KEYS = [
  "input_credit_rate",
  "output_credit_rate",
  "hold_credits_per_second",
  "credits_per_thousand_tokens_by_tier",
] as const;

type CommonKey = (typeof COMMON_KEYS)[number];

// Seedance 真实单价随【分辨率】×【是否含输入视频】跳变,后台按这四档配 token 单价。
const TIERS = ["480p", "720p", "1080p", "4k"] as const;
type Tier = (typeof TIERS)[number];

// Seedance 720p 16:9 15s 估算 token 数,用于视频预览:
// (输入0+输出15s) × 1280 × 720 × 24fps / 1024 = 324000。
const SEEDANCE_720P_15S_TOKENS = 324000;

function FieldLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{text}</div>
  );
}

export function PricingField({
  value,
  onChange,
  onValidityChange,
  capability,
}: PricingFieldProps) {
  const pricing: Pricing = value ?? {};
  const isVideo = capability === "video";
  const tierTable = pricing.credits_per_thousand_tokens_by_tier ?? {};

  // 高级 JSON 只承载"非常用"字段,避免与上面结构化框双向打架。
  const advanced: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(pricing)) {
    if (!COMMON_KEYS.includes(k as CommonKey)) advanced[k] = v;
  }
  const [advancedValid, setAdvancedValid] = useState(true);

  const emit = (next: Pricing) => onChange?.(next);

  const setRate = (
    key: "input_credit_rate" | "output_credit_rate" | "hold_credits_per_second",
    v: number | null,
  ) => {
    const next: Pricing = { ...pricing };
    if (v === null) delete next[key];
    else next[key] = v;
    emit(next);
  };

  // 设某档某子项(no_video / with_video)单价;清空则删,空档自动收缩。
  const setTier = (tier: Tier, sub: keyof TierTokenRate, v: number | null) => {
    const nextTable: Record<string, TierTokenRate> = { ...tierTable };
    const row: TierTokenRate = { ...(nextTable[tier] ?? {}) };
    if (v === null) delete row[sub];
    else row[sub] = v;
    if (row.no_video === undefined && row.with_video === undefined)
      delete nextTable[tier];
    else nextTable[tier] = row;
    const next: Pricing = { ...pricing };
    if (Object.keys(nextTable).length === 0)
      delete next.credits_per_thousand_tokens_by_tier;
    else next.credits_per_thousand_tokens_by_tier = nextTable;
    emit(next);
  };

  const setAdvanced = (parsed: unknown) => {
    const adv = (parsed as Record<string, unknown>) ?? {};
    // 合并:保留常用字段(走 Record 写入避免 CommonKey 联合类型坍缩),其余用高级字段替换。
    const next: Record<string, unknown> = {};
    for (const k of COMMON_KEYS) {
      if (pricing[k] !== undefined) next[k] = pricing[k];
    }
    Object.assign(next, adv);
    emit(next as Pricing);
  };

  const inRate = pricing.input_credit_rate ?? 0;
  const outRate = pricing.output_credit_rate ?? 0;
  // 视频预览用 720p 不含视频档单价(没配则回退 output_credit_rate)。
  const previewRate = tierTable["720p"]?.no_video ?? outRate;
  const videoCredits = Math.ceil(
    (SEEDANCE_720P_15S_TOKENS * previewRate) / 1000,
  );

  if (isVideo) {
    return (
      <div>
        <FieldLabel text="按分辨率 × 是否含输入视频 配 token 单价(积分 / 千 token)" />
        <Table<{ tier: Tier }>
          size="small"
          pagination={false}
          rowKey="tier"
          dataSource={TIERS.map((tier) => ({ tier }))}
          columns={[
            { title: "分辨率", dataIndex: "tier", width: 90 },
            {
              title: "纯文本/图生视频",
              width: 150,
              render: (_, r) => (
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: "100%" }}
                  value={tierTable[r.tier]?.no_video}
                  onChange={(v) => setTier(r.tier, "no_video", v)}
                  placeholder="如 5"
                />
              ),
            },
            {
              title: "含输入视频(更低)",
              width: 150,
              render: (_, r) => (
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: "100%" }}
                  value={tierTable[r.tier]?.with_video}
                  onChange={(v) => setTier(r.tier, "with_video", v)}
                  placeholder="如 3"
                />
              ),
            },
          ]}
        />
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
        >
          预览:720p 16:9 15s 视频 ≈{" "}
          <Typography.Text strong>{videoCredits}</Typography.Text> 积分 (约{" "}
          {SEEDANCE_720P_15S_TOKENS / 1000}k token × {previewRate})。
          结算时按任务真实分辨率与是否含输入视频选档 × 上游 token;
          未配的档位回退下方「兜底单价」。
        </Typography.Paragraph>

        <Space size="large" wrap>
          <label>
            <FieldLabel text="兜底单价(积分 / 千 token,档位没配时用)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 240 }}
              value={pricing.output_credit_rate}
              onChange={(v) => setRate("output_credit_rate", v)}
              placeholder="如 15"
            />
          </label>
          <label>
            <FieldLabel text="每秒预冻积分(hold,提交时占位防 0 余额)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 240 }}
              value={pricing.hold_credits_per_second}
              onChange={(v) => setRate("hold_credits_per_second", v)}
              placeholder="如 350"
            />
          </label>
        </Space>

        {renderAdvanced()}
      </div>
    );
  }

  return (
    <div>
      <Space size="large" wrap>
        <label>
          <FieldLabel text="输入单价(积分 / 千 token)" />
          <InputNumber
            min={0}
            precision={0}
            style={{ width: 220 }}
            value={pricing.input_credit_rate}
            onChange={(v) => setRate("input_credit_rate", v)}
            placeholder="如 2"
          />
        </label>
        <label>
          <FieldLabel text="输出单价(积分 / 千 token)" />
          <InputNumber
            min={0}
            precision={0}
            style={{ width: 240 }}
            value={pricing.output_credit_rate}
            onChange={(v) => setRate("output_credit_rate", v)}
            placeholder="如 8"
          />
        </label>
      </Space>

      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
      >
        预览:一次约 1000 输入 + 1000 输出 token ≈{" "}
        <Typography.Text strong>{inRate + outRate}</Typography.Text> 积分 (输入{" "}
        {inRate} + 输出 {outRate})。实际按上游返回的真实 token 结算。
      </Typography.Paragraph>

      {renderAdvanced()}
    </div>
  );

  function renderAdvanced() {
    return (
      <>
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: "adv",
              label: "高级计价(并发限制 / 阿里云按分辨率秒价等,JSON)",
              children: (
                <JsonField
                  rows={5}
                  value={advanced}
                  placeholder='{ "provider_concurrency_limit": 8 }'
                  onChange={setAdvanced}
                  onValidityChange={(ok) => {
                    setAdvancedValid(ok);
                    onValidityChange?.(ok);
                  }}
                />
              ),
            },
          ]}
        />
        {!advancedValid && (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            高级计价 JSON 格式有误
          </Typography.Text>
        )}
      </>
    );
  }
}
