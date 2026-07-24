import { useState } from "react";
import { Collapse, InputNumber, Select, Space, Table, Typography } from "antd";
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
  "unit",
  "input_credit_rate",
  "output_credit_rate",
  "hold_credits_per_second",
  "credits_per_thousand_tokens_by_tier",
  "credits_per_billable_second_by_resolution",
  "provider_cost_cents_per_million_tokens",
  "provider_cost_currency",
  "provider_cost_to_cny_ppm",
  "provider_cost_cents_per_million_tokens_with_video",
  "provider_cost_cents_per_million_tokens_by_tier",
  "provider_cost_cents_per_million_tokens_by_usage",
  "provider_cost_cents_per_successful_output",
  "provider_cost_cents_per_billable_second_by_resolution",
  "revenue_cents_per_thousand_credits",
] as const;

// 计费单位(描述性,后端 validatePricing 要求非空)。按能力给合理默认。
const UNIT_OPTIONS = [
  { value: "generation", label: "按次(generation)" },
  { value: "1k_tokens", label: "按千 token(1k_tokens)" },
  { value: "second", label: "按秒(second)" },
] as const;

type CommonKey = (typeof COMMON_KEYS)[number];

// Seedance 真实单价随【分辨率】×【是否含输入视频】跳变,后台按这四档配 token 单价。
const TIERS = ["480p", "720p", "1080p", "4k"] as const;
type Tier = (typeof TIERS)[number];

// 视频统一计费:积分 = 单价[清晰度] × 时长(秒),预冻=结算(后端 ai.videoCredits)。
// 所有视频(Seedance / 爆款做同款 / HappyHorse)都用本表。key 用大写(库内统一约定,
// 后端查表大小写双查;HappyHorse 上游 SR 拼出的 "<SR>P" 也是大写)。
const SECOND_TIERS = ["480P", "720P", "1080P"] as const;
type SecondTier = (typeof SECOND_TIERS)[number];

const USAGE_COST_ROWS = [
  { key: "input", label: "输入 token" },
  { key: "cached_input", label: "缓存输入 token" },
  { key: "text_input", label: "图片模型：文本输入 token" },
  { key: "cached_text_input", label: "图片模型：缓存文本输入 token" },
  { key: "image_input", label: "图片模型：图片输入 token" },
  { key: "cached_image_input", label: "图片模型：缓存图片输入 token" },
  { key: "output", label: "输出 token" },
] as const;

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
  const secondTable = pricing.credits_per_billable_second_by_resolution ?? {};
  const providerTierTable =
    pricing.provider_cost_cents_per_million_tokens_by_tier ?? {};
  const providerSecondTable =
    pricing.provider_cost_cents_per_billable_second_by_resolution ?? {};
  const providerUsageTable =
    pricing.provider_cost_cents_per_million_tokens_by_usage ?? {};
  const providerCurrency = pricing.provider_cost_currency ?? "CNY";

  // 高级 JSON 只承载"非常用"字段,避免与上面结构化框双向打架。
  const advanced: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(pricing)) {
    if (!COMMON_KEYS.includes(k as CommonKey)) advanced[k] = v;
  }
  const [advancedValid, setAdvancedValid] = useState(true);

  // 计费单位默认值按能力推断:视频→second,其余→generation。
  // 后端 validatePricing 强制 unit 非空,故 emit 时兜底注入,确保纯表单配置也能保存。
  const defaultUnit = isVideo ? "second" : "generation";
  const emit = (next: Pricing) =>
    onChange?.(next.unit ? next : { ...next, unit: defaultUnit });

  const setUnit = (v: string) => emit({ ...pricing, unit: v });

  const setRate = (
    key:
      | "input_credit_rate"
      | "output_credit_rate"
      | "hold_credits_per_second"
      | "provider_cost_cents_per_million_tokens"
      | "provider_cost_cents_per_million_tokens_with_video"
      | "provider_cost_cents_per_successful_output"
      | "provider_cost_to_cny_ppm"
      | "revenue_cents_per_thousand_credits",
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

  // 设某分辨率档的每秒积分;清空则删该档,空表自动收缩(从 pricing 移除整个字段)。
  const setSecondRate = (tier: SecondTier, v: number | null) => {
    const nextTable: Record<string, number> = { ...secondTable };
    if (v === null) delete nextTable[tier];
    else nextTable[tier] = v;
    const next: Pricing = { ...pricing };
    if (Object.keys(nextTable).length === 0)
      delete next.credits_per_billable_second_by_resolution;
    else next.credits_per_billable_second_by_resolution = nextTable;
    emit(next);
  };

  const setProviderTier = (
    tier: Tier,
    sub: keyof TierTokenRate,
    v: number | null,
  ) => {
    const table: Record<string, TierTokenRate> = { ...providerTierTable };
    const row = { ...(table[tier] ?? {}) };
    if (v === null) delete row[sub];
    else row[sub] = v;
    if (row.no_video === undefined && row.with_video === undefined)
      delete table[tier];
    else table[tier] = row;
    const next: Pricing = { ...pricing };
    if (Object.keys(table).length === 0)
      delete next.provider_cost_cents_per_million_tokens_by_tier;
    else next.provider_cost_cents_per_million_tokens_by_tier = table;
    emit(next);
  };

  const setProviderSecondRate = (tier: SecondTier, v: number | null) => {
    const table = { ...providerSecondTable };
    if (v === null) delete table[tier];
    else table[tier] = v;
    const next: Pricing = { ...pricing };
    if (Object.keys(table).length === 0)
      delete next.provider_cost_cents_per_billable_second_by_resolution;
    else next.provider_cost_cents_per_billable_second_by_resolution = table;
    emit(next);
  };

  const setProviderUsageRate = (key: string, v: number | null) => {
    const table = { ...providerUsageTable };
    if (v === null) delete table[key];
    else table[key] = v;
    const next: Pricing = { ...pricing };
    if (Object.keys(table).length === 0)
      delete next.provider_cost_cents_per_million_tokens_by_usage;
    else next.provider_cost_cents_per_million_tokens_by_usage = table;
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

  if (isVideo) {
    return (
      <div>
        {renderUnit()}
        <FieldLabel text="视频计费(每秒积分,按清晰度档):积分 = 每秒积分 × 时长(秒)" />
        <Table<{ tier: SecondTier }>
          size="small"
          pagination={false}
          rowKey="tier"
          dataSource={SECOND_TIERS.map((tier) => ({ tier }))}
          columns={[
            { title: "清晰度", dataIndex: "tier", width: 90 },
            {
              title: "每秒积分",
              width: 180,
              render: (_, r) => (
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: "100%" }}
                  value={secondTable[r.tier]}
                  onChange={(v) => setSecondRate(r.tier, v)}
                  placeholder="如 160"
                />
              ),
            },
          ]}
        />
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
        >
          这是所有视频模型的权威计费表:预冻与实扣都按「每秒积分 × 时长」,
          两头一致、与上游 token / 实际出片秒数无关。比例(16:9 / 9:16
          等)不影响价。清晰度档没配则回退到下方「兜底单价」。
        </Typography.Paragraph>

        <Collapse
          ghost
          size="small"
          items={[
            {
              key: "legacy-token-tier",
              label: "旧版:按 token 单价表(已停用,仅兼容历史配置)",
              children: renderLegacyTierTable(),
            },
          ]}
        />

        <Space size="large" wrap style={{ marginTop: 8 }}>
          <label>
            <FieldLabel text="兜底单价(每秒积分,清晰度档没配时用)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 240 }}
              value={pricing.output_credit_rate}
              onChange={(v) => setRate("output_credit_rate", v)}
              placeholder="如 160"
            />
          </label>
          <label>
            <FieldLabel text="每秒预冻积分(hold,清晰度档与兜底单价都没配时用)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 240 }}
              value={pricing.hold_credits_per_second}
              onChange={(v) => setRate("hold_credits_per_second", v)}
              placeholder="如 200"
            />
          </label>
        </Space>

        {renderFinanceRates()}
        {renderAdvanced()}
      </div>
    );
  }

  // renderLegacyTierTable 渲染已停用的「按 token × 分辨率档」单价表,
  // 仅为兼容历史配置展示,新口径(每秒积分 × 时长)不再消费此表。
  function renderLegacyTierTable() {
    return (
      <>
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
          已停用:此表是旧的「token × 分辨率档」单价,新口径(每秒积分 ×
          时长)不再消费它,仅展示历史配置。请改用上方「每秒积分」表。
        </Typography.Paragraph>
      </>
    );
  }

  return (
    <div>
      {renderUnit()}
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

      {renderFinanceRates()}
      {renderAdvanced()}
    </div>
  );

  function renderUnit() {
    return (
      <label style={{ display: "block", marginBottom: 12 }}>
        <FieldLabel text="计费单位(必填,描述性,不参与计算)" />
        <Select
          style={{ width: 240 }}
          value={pricing.unit ?? defaultUnit}
          onChange={setUnit}
          options={[...UNIT_OPTIONS]}
        />
      </label>
    );
  }

  function renderFinanceRates() {
    return (
      <div style={{ marginTop: 16 }}>
        <FieldLabel text="后台经营分析（不参与用户扣费）" />
        <Space size="large" wrap>
          <label>
            <FieldLabel text="供应商合同币种" />
            <Select
              style={{ width: 120 }}
              value={providerCurrency}
              options={[
                { value: "CNY", label: "CNY 人民币" },
                { value: "USD", label: "USD 美元" },
              ]}
              onChange={(currency) =>
                emit({ ...pricing, provider_cost_currency: currency })
              }
            />
          </label>
          {providerCurrency !== "CNY" && (
            <label>
              <FieldLabel text="折人民币汇率（百万分比；USD/CNY 7.30 填 7300000）" />
              <InputNumber
                min={0}
                precision={0}
                style={{ width: 260 }}
                value={pricing.provider_cost_to_cny_ppm}
                onChange={(v) => setRate("provider_cost_to_cny_ppm", v)}
                placeholder="如 7300000"
              />
            </label>
          )}
          <label>
            <FieldLabel text={`供应商成本：总 token 兜底价（${providerCurrency} 分 / 百万 token）`} />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 240 }}
              value={pricing.provider_cost_cents_per_million_tokens}
              onChange={(v) =>
                setRate("provider_cost_cents_per_million_tokens", v)
              }
              placeholder="Fast ¥37 填 3700"
            />
          </label>
          {isVideo && (
            <label>
              <FieldLabel text="供应商成本：含输入视频（分 / 百万 token）" />
              <InputNumber
                min={0}
                precision={0}
                style={{ width: 240 }}
                value={
                  pricing.provider_cost_cents_per_million_tokens_with_video
                }
                onChange={(v) =>
                  setRate(
                    "provider_cost_cents_per_million_tokens_with_video",
                    v,
                  )
                }
                placeholder="Fast ¥22 填 2200"
              />
            </label>
          )}
          {!isVideo && (
            <label>
              <FieldLabel text={`供应商成本：每张成功图片（${providerCurrency} 分 / 张）`} />
              <InputNumber
                min={0}
                precision={0}
                style={{ width: 240 }}
                value={pricing.provider_cost_cents_per_successful_output}
                onChange={(v) =>
                  setRate("provider_cost_cents_per_successful_output", v)
                }
                placeholder="Seedream ¥0.22 填 22"
              />
            </label>
          )}
          <label>
            <FieldLabel text="积分收入折算（分 / 千积分）" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 240 }}
              value={pricing.revenue_cents_per_thousand_credits}
              onChange={(v) =>
                setRate("revenue_cents_per_thousand_credits", v)
              }
              placeholder="如 ¥80 填 8000"
            />
          </label>
        </Space>
        {isVideo && (
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: "provider-token-tiers",
                label: "Seedance 2.0 上游成本（按清晰度 × 输入视频分档）",
                children: (
                  <Table<{ tier: Tier }>
                    size="small"
                    pagination={false}
                    rowKey="tier"
                    dataSource={TIERS.map((tier) => ({ tier }))}
                    columns={[
                      { title: "清晰度", dataIndex: "tier", width: 90 },
                      {
                        title: "不含输入视频（分/百万 token）",
                        render: (_, r) => (
                          <InputNumber
                            min={0}
                            precision={0}
                            value={providerTierTable[r.tier]?.no_video}
                            onChange={(v) =>
                              setProviderTier(r.tier, "no_video", v)
                            }
                          />
                        ),
                      },
                      {
                        title: "含输入视频（分/百万 token）",
                        render: (_, r) => (
                          <InputNumber
                            min={0}
                            precision={0}
                            value={providerTierTable[r.tier]?.with_video}
                            onChange={(v) =>
                              setProviderTier(r.tier, "with_video", v)
                            }
                          />
                        ),
                      },
                    ]}
                  />
                ),
              },
              {
                key: "provider-second-tiers",
                label: "HappyHorse 上游成本（按清晰度每秒）",
                children: (
                  <Table<{ tier: SecondTier }>
                    size="small"
                    pagination={false}
                    rowKey="tier"
                    dataSource={SECOND_TIERS.map((tier) => ({ tier }))}
                    columns={[
                      { title: "清晰度", dataIndex: "tier", width: 90 },
                      {
                        title: "分 / 秒",
                        render: (_, r) => (
                          <InputNumber
                            min={0}
                            precision={0}
                            value={providerSecondTable[r.tier]}
                            onChange={(v) =>
                              setProviderSecondRate(r.tier, v)
                            }
                          />
                        ),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        )}
        {!isVideo && (
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: "provider-usage-tokens",
                label: "OpenAI / Seed 上游成本（按 usage 分项 token）",
                children: (
                  <Table<(typeof USAGE_COST_ROWS)[number]>
                    size="small"
                    pagination={false}
                    rowKey="key"
                    dataSource={[...USAGE_COST_ROWS]}
                    columns={[
                      { title: "usage 维度", dataIndex: "label" },
                      {
                        title: `${providerCurrency} 分 / 百万 token`,
                        render: (_, row) => (
                          <InputNumber
                            min={0}
                            precision={0}
                            value={providerUsageTable[row.key]}
                            onChange={(v) => setProviderUsageRate(row.key, v)}
                            placeholder="按供应商合同价填写"
                          />
                        ),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        )}
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
        >
          视频：Fast / Mini 用总 token 两档，Seedance 2.0 使用清晰度分档，
          HappyHorse 使用每秒分档。图片：Seedream 填每张成功图片；OpenAI / Seed
          填 usage 分项价格。OpenAI 按美元合同价填写，并维护实际结算汇率。
          积分收入 = 实扣积分 × 收入折算价；未配置时不显示利润。
        </Typography.Paragraph>
      </div>
    );
  }

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
