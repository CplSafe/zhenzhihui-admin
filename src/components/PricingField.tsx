import { useState } from "react";
import {
  Collapse,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { JsonField } from "@/components/JsonField";
import type { Pricing, PromoPricing, TierTokenRate } from "@/types/domain";

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
  "credits_per_extra_input_image",
  "promo",
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
// 含 4K:Seedance 2.0 支持到 4K,少这一档会导致 4K 价在表单里既看不到也改不了。
// MiniMax H3 用 768P / 2K,不在这几档里 —— 那两档走下方「其他清晰度」自由行。
const SECOND_TIERS = ["480P", "720P", "1080P", "4K"] as const;
type SecondTier = (typeof SECOND_TIERS)[number];

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
      | "revenue_cents_per_thousand_credits"
      | "credits_per_extra_input_image",
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

  // 库里已有但不在 SECOND_TIERS 固定档里的清晰度(如 MiniMax H3 的 768P / 2K)。
  // 一并渲染成可编辑行,否则这些档只能去高级 JSON 改。
  const extraSecondTiers = Object.keys(secondTable).filter(
    (tier) => !SECOND_TIERS.includes(tier as SecondTier),
  );

  // 设某分辨率档的每秒积分;清空则删该档,空表自动收缩(从 pricing 移除整个字段)。
  const setSecondRate = (tier: string, v: number | null) => {
    const nextTable: Record<string, number> = { ...secondTable };
    if (v === null) delete nextTable[tier];
    else nextTable[tier] = v;
    const next: Pricing = { ...pricing };
    if (Object.keys(nextTable).length === 0)
      delete next.credits_per_billable_second_by_resolution;
    else next.credits_per_billable_second_by_resolution = nextTable;
    emit(next);
  };

  // ---- 限时优惠 ----
  // 窗口内后端按 promo 的单价计费,到期自动回落刊例价(catalog.PromoPricing)。
  const promo = pricing.promo;
  const promoTable = promo?.credits_per_billable_second_by_resolution ?? {};
  const promoActive = (() => {
    if (!promo || Object.keys(promoTable).length === 0) return false;
    const now = dayjs();
    if (promo.starts_at && now.isBefore(dayjs(promo.starts_at))) return false;
    if (promo.ends_at && !now.isBefore(dayjs(promo.ends_at))) return false;
    return true;
  })();

  // 整体改写 promo;传 undefined 表示清除活动(恢复刊例价)。
  const emitPromo = (next: PromoPricing | undefined) => {
    const nextPricing: Pricing = { ...pricing };
    if (
      !next ||
      Object.keys(next.credits_per_billable_second_by_resolution ?? {})
        .length === 0
    ) {
      delete nextPricing.promo;
    } else {
      nextPricing.promo = next;
    }
    emit(nextPricing);
  };

  const setPromoRate = (tier: string, v: number | null) => {
    const nextTable: Record<string, number> = { ...promoTable };
    if (v === null) delete nextTable[tier];
    else nextTable[tier] = v;
    emitPromo({
      ...promo,
      credits_per_billable_second_by_resolution: nextTable,
    });
  };

  const renderPromo = () => (
    <div>
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginBottom: 8 }}
      >
        活动期间按下表单价计费(用户实扣折后价),
        <strong>到期自动恢复上面的刊例价,不需要人工改回</strong>。
        清空折后单价即取消活动。前端会展示「划线价 + 现价 + 倒计时」。
      </Typography.Paragraph>
      <Space size="large" wrap style={{ marginBottom: 8 }}>
        <label>
          <FieldLabel text="活动文案(前端展示)" />
          <Input
            style={{ width: 200 }}
            placeholder="如 限时 4 折"
            value={promo?.label}
            onChange={(e) =>
              emitPromo({ ...promo, label: e.target.value || undefined })
            }
          />
        </label>
        <label>
          <FieldLabel text="活动起止时间(留空表示该侧不限)" />
          <DatePicker.RangePicker
            showTime
            style={{ width: 380 }}
            value={[
              promo?.starts_at ? dayjs(promo.starts_at) : null,
              promo?.ends_at ? dayjs(promo.ends_at) : null,
            ]}
            onChange={(range) =>
              emitPromo({
                ...promo,
                starts_at: range?.[0]?.format() || undefined,
                ends_at: range?.[1]?.format() || undefined,
              })
            }
          />
        </label>
      </Space>
      <Table<{ tier: string }>
        size="small"
        pagination={false}
        rowKey="tier"
        dataSource={[...SECOND_TIERS, ...extraSecondTiers].map((tier) => ({
          tier,
        }))}
        columns={[
          { title: "清晰度", dataIndex: "tier", width: 90 },
          {
            title: "刊例价(每秒积分)",
            width: 140,
            render: (_, r) => (
              <Typography.Text type="secondary">
                {secondTable[r.tier] ?? "—"}
              </Typography.Text>
            ),
          },
          {
            title: "折后价(每秒积分)",
            width: 180,
            render: (_, r) => (
              <InputNumber
                min={0}
                precision={0}
                style={{ width: "100%" }}
                value={promoTable[r.tier]}
                onChange={(v) => setPromoRate(r.tier, v)}
                placeholder="留空=该档不打折"
              />
            ),
          },
        ]}
      />
    </div>
  );

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
        <Table<{ tier: string }>
          size="small"
          pagination={false}
          rowKey="tier"
          dataSource={[...SECOND_TIERS, ...extraSecondTiers].map((tier) => ({
            tier,
          }))}
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
              key: "promo",
              label: promoActive
                ? `限时优惠(生效中${pricing.promo?.label ? `:${pricing.promo.label}` : ""})`
                : "限时优惠(上游搞活动时跟着降价,到期自动回落刊例价)",
              children: renderPromo(),
            },
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
          <label>
            {/* MiniMax H3:前 5 张输入图免费,超出按张加价。0 / 留空=输入图不额外计费。 */}
            <FieldLabel text="超额输入图单价(每张积分,仅 MiniMax H3 用)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 240 }}
              value={pricing.credits_per_extra_input_image}
              onChange={(v) => setRate("credits_per_extra_input_image", v)}
              placeholder="如 15"
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
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
        >
          经营分析无需配置：系统按模型 ID 自动匹配官方上游价格，固定按 1 积分 =
          ¥0.02 计算收入；HappyHorse 使用本项目四折合同价。
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
