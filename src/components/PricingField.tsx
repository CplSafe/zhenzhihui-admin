import type { ExchangeRate } from "@/api/exchangeRate";
import { Alert } from "antd";
import { MediaCostPricingField } from "@/components/MediaCostPricingField";
import { useState } from "react";
import {
  Collapse,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  Table,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { JsonField } from "@/components/JsonField";
import { GoogleImagePricingField } from "@/components/GoogleImagePricingField";
import { googleImageSpec } from "@/utils/googleImagePricing";
import { fmtCredits } from "@/utils/format";
import type { Pricing, PromoPricing, TierTokenRate } from "@/types/domain";

interface PricingFieldProps {
  exchangeRate?: ExchangeRate;
  value?: Pricing;
  onChange?: (value: Pricing) => void;
  // 高级 JSON 解析失败时上报,沿用 ModelsPage 的保存禁用逻辑。
  onValidityChange?: (valid: boolean) => void;
  capability?: string;
  provider?: string;
  version?: string;
}

// 结构化承载的常用字段;其余(并发限制等)留高级 JSON。
// video 多承载 hold_credits_per_second(按时长预冻占位)与 per-tier 单价表。
const COMMON_KEYS = [
  "unit",
  "input_credit_rate",
  "cached_input_credit_rate",
  "output_credit_rate",
  "hold_credits_per_second",
  "credits_per_thousand_tokens_by_tier",
  "credits_per_billable_second_by_resolution",
  "credits_per_billable_second_with_video_by_resolution",
  "provider_cost_cents_per_million_tokens",
  "provider_cost_currency",
  "provider_cost_to_cny_ppm",
  "provider_cost_fx_source",
  "provider_cost_fx_date",
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
  { value: "thousand_characters", label: "按千字符(thousand_characters)" },
  { value: "generation", label: "按次(generation)" },
  { value: "1k_tokens", label: "按千 token(1k_tokens)" },
  { value: "second", label: "按秒(second)" },
  // 单价填"积分/千秒",整笔按 秒数×单价÷1000 向上取整;成本价不足 1 积分/秒的语音识别用。
  { value: "thousand_seconds", label: "按千秒(thousand_seconds)" },
] as const;

// 按时长计费的单位下,输出单价的含义随单位变化(语音识别等);其余沿用 token 口径的标签。
const OUTPUT_RATE_LABEL_BY_UNIT: Record<string, string> = {
  second: "单价(积分 / 秒)",
  thousand_seconds: "单价(积分 / 千秒,整笔向上取整)",
};

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

const TEXT_TOKEN_COST_FIELDS = [
  { key: "input", title: "普通输入" },
  { key: "cached_input", title: "缓存读取" },
  { key: "cache_write_30m", title: "缓存写入 30 分钟" },
  { key: "cache_write_12h", title: "缓存写入 12 小时" },
  { key: "output", title: "输出" },
];

const textUsageCostModel = (provider?: string, version?: string, capability?: string) =>
  capability === "responses" && provider === "openai" && !!version && /^(gpt-5\.6)(-sol|-terra|-luna)?$/.test(version);

export function PricingField(props: PricingFieldProps) {
  const p = props.value ?? {};
  const isUSD = p.provider_cost_currency === "USD";
  const fx = props.exchangeRate;
  const effective = isUSD ? { ...p, provider_cost_to_cny_ppm: fx?.rate_ppm || undefined, provider_cost_fx_source: fx?.source, provider_cost_fx_date: fx?.rate_date } : p;
  return <>
    <Alert style={{ marginBottom: 12 }} type="info" showIcon title={(p.unit === 'provider_cost' || textUsageCostModel(props.provider, props.version, props.capability)) ? '按上游成本折算积分' : '按配置积分单价计费'}
      description={(p.unit === 'provider_cost' || textUsageCostModel(props.provider, props.version, props.capability)) ? '实际用量 × 上游单价 × 统一汇率 ÷ 0.02，完成后按实际用量多退少补。' : '以下积分单价是实际扣费配置；上游成本用于经营分析。计费单位以各项标注为准。'} />
    {isUSD && <p>统一美元汇率：{fx?.rate_ppm ? (fx.rate_ppm / 1_000_000).toFixed(6) : '等待同步'} · {fx?.rate_date || '暂无日期'} · {fx?.usable ? '有效' : '美元新请求暂停'}</p>}
    <PricingEditor {...props} value={effective} />
  </>;
}

function PricingEditor({
  value,
  onChange,
  onValidityChange,
  capability,
  provider,
  version,
}: PricingFieldProps) {
  const pricing: Pricing = value ?? {};
  const isVideo = capability === "video";
  const isText = capability === "responses";
  const usageCostText = textUsageCostModel(provider, version, capability);
  const googleSpec = googleImageSpec(provider, version, capability);
  const isLegacyGoogle = provider === "google" && capability === "image" && version === "gemini-2.5-flash-image";
  const tierTable = pricing.credits_per_thousand_tokens_by_tier ?? {};
  const secondTable = pricing.credits_per_billable_second_by_resolution ?? {};
  const withVideoTable =
    pricing.credits_per_billable_second_with_video_by_resolution ?? {};
  // 含输入视频单价目前只有火山 Seedance 消费,别的模型不展示这列,免得运营白配。
  const showWithVideo = provider === "volcengine";

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
      | "cached_input_credit_rate"
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

  // 设含输入视频的每秒积分;规则同刊例价表(清空删档,空表移除整个字段 → 后端回退刊例价)。
  const setWithVideoRate = (tier: string, v: number | null) => {
    const nextTable: Record<string, number> = { ...withVideoTable };
    if (v === null) delete nextTable[tier];
    else nextTable[tier] = v;
    const next: Pricing = { ...pricing };
    if (Object.keys(nextTable).length === 0)
      delete next.credits_per_billable_second_with_video_by_resolution;
    else next.credits_per_billable_second_with_video_by_resolution = nextTable;
    emit(next);
  };

  // ---- 限时优惠 ----
  // 窗口内后端按 promo 的单价计费,到期自动回落刊例价(catalog.PromoPricing)。
  const promo = pricing.promo;
  const promoTable = promo?.credits_per_billable_second_by_resolution ?? {};
  const promoActive = (() => {
    if (!promo || !(Object.keys(promoTable).length || Object.keys(promo.provider_cost_cents_per_million_tokens_by_usage ?? {}).length || [promo.input_credit_rate, promo.output_credit_rate, promo.cached_input_credit_rate].some(v => v !== undefined))) return false;
    const now = dayjs();
    if (promo.starts_at && now.isBefore(dayjs(promo.starts_at))) return false;
    if (promo.ends_at && !now.isBefore(dayjs(promo.ends_at))) return false;
    return true;
  })();

  // 整体改写 promo;传 undefined 表示清除活动(恢复刊例价)。
  const emitPromo = (next: PromoPricing | undefined) => {
    const nextPricing: Pricing = { ...pricing };
    if (!next) delete nextPricing.promo;
    else nextPricing.promo = next;
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

  const renderTextCostTable = (promotional: boolean) => {
    const rates = (promotional ? promo : pricing)?.provider_cost_cents_per_million_tokens_by_usage ?? {};
    const label = promotional ? "优惠成本" : "常规成本";
    return <Table<{ key: string; title: string }>
      size="small" pagination={false} rowKey="key" scroll={{ x: promotional ? 560 : 360 }}
      dataSource={TEXT_TOKEN_COST_FIELDS}
      columns={[
        { title: "计费项目", dataIndex: "title", width: 150 },
        ...(promotional ? [{ title: "常规成本（美分 / 百万 tokens）", render: (_: unknown, row: {key: string}) => pricing.provider_cost_cents_per_million_tokens_by_usage?.[row.key] ?? "—" }] : []),
        {
          title: label + "（美分 / 百万 tokens）",
          render: (_, row) => <InputNumber
            aria-label={row.title + label} min={1} max={1000000000} precision={0}
            value={rates[row.key]} placeholder={promotional ? "留空沿用常规价" : "填写常规成本"}
            onChange={value => {
              const next = { ...rates };
              if (value === null) delete next[row.key]; else next[row.key] = value;
              if (promotional) emitPromo({ ...promo, provider_cost_cents_per_million_tokens_by_usage: next });
              else emit({ ...pricing, provider_cost_cents_per_million_tokens_by_usage: next });
            }}
          />,
        },
      ]}
    />;
  };

  const renderPromo = () => (
    <div>
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginBottom: 8 }}
      >
        活动期间使用配置的优惠价，留空的项目沿用常规价；已提交任务按提交时价格结算。
        到期默认恢复常规价；未确认常规价时，可开启“到期需复核价格”暂停新调用。
      </Typography.Paragraph>
      <Space size="large" wrap style={{ marginBottom: 8, maxWidth: "100%" }}>
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
        <label style={{ display: "block", maxWidth: "100%" }}>
          <FieldLabel text="活动起止时间(留空表示该侧不限)" />
          <Space wrap>
            {(["starts_at", "ends_at"] as const).map(key => <DatePicker
              key={key} showTime needConfirm={false}
              aria-label={key === "starts_at" ? "活动开始时间" : "活动结束时间"}
              placeholder={key === "starts_at" ? "开始时间（可留空）" : "结束时间（可留空）"}
              value={promo?.[key] ? dayjs(promo[key]) : null}
              style={{ width: 210, maxWidth: "100%" }}
              onChange={date => emitPromo({ ...promo, [key]: date?.format() || undefined })}
            />)}
          </Space>
        </label>
      </Space>
      {isText ? <>
        <Space wrap size="large" style={{ marginBottom: 12 }}>
          <label><FieldLabel text="到期需复核价格（暂停新调用）" /><Switch checked={promo?.require_price_review_after_end ?? false} onChange={checked => emitPromo({...promo, require_price_review_after_end: checked})} /></label>
          <Button onClick={() => emitPromo(undefined)}>取消优惠活动</Button>
        </Space>
        {usageCostText ? renderTextCostTable(true)
        : <Space wrap size="large">{(['input_credit_rate','cached_input_credit_rate','output_credit_rate'] as const).map(key=><label key={key}><FieldLabel text={({input_credit_rate:'普通输入',cached_input_credit_rate:'缓存读取',output_credit_rate:'输出'})[key] + '优惠价（积分 / 千 tokens）'} /><InputNumber min={key==='cached_input_credit_rate'?0.001:0} precision={3} value={promo?.[key]} placeholder="留空沿用常规价" onChange={v=>{const next={...promo};if(v===null)delete next[key];else next[key]=v;emitPromo(next);}}/></label>)}</Space>}
      </> : <Table<{ tier: string }>
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
                precision={3}
                step={0.001}
                style={{ width: "100%" }}
                value={promoTable[r.tier]}
                onChange={(v) => setPromoRate(r.tier, v)}
                placeholder="留空=该档不打折"
              />
            ),
          },
        ]}
      />}
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

  if (googleSpec) {
    return (
      <div>
        <GoogleImagePricingField spec={googleSpec} value={pricing} onChange={emit} />
        {renderAdvanced()}
      </div>
    );
  }

  if (pricing.unit === "provider_cost") {
    return <div><MediaCostPricingField value={pricing} onChange={emit} />{renderAdvanced()}</div>;
  }

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
                  precision={3}
                  step={0.001}
                  style={{ width: "100%" }}
                  value={secondTable[r.tier]}
                  onChange={(v) => setSecondRate(r.tier, v)}
                  placeholder="如 160"
                />
              ),
            },
            ...(showWithVideo
              ? [
                  {
                    title: "含输入视频(每秒积分)",
                    width: 180,
                    render: (_: unknown, r: { tier: string }) => (
                      <InputNumber
                        min={0}
                        precision={3}
                        step={0.001}
                        style={{ width: "100%" }}
                        value={withVideoTable[r.tier]}
                        onChange={(v) => setWithVideoRate(r.tier, v)}
                        placeholder="如 31"
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
        >
          这是所有视频模型的权威计费表:预冻与实扣都按「每秒积分 × 时长」,
          两头一致、与上游 token / 实际出片秒数无关。比例(16:9 / 9:16
          等)不影响价。清晰度档没配则回退到下方「兜底单价」。
          {showWithVideo &&
            " 带参考视频的任务(编辑 / 延长 / 视频参考)改按「含输入视频」列计费:积分 = 该列单价 × (原视频秒数 + 出片秒数);该列留空则回退刊例价。"}
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
              precision={3}
              step={0.001}
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
              precision={3}
              step={0.001}
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
              precision={3}
              step={0.001}
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
                  precision={3}
                  step={0.001}
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
                  precision={3}
                  step={0.001}
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
      {usageCostText && <>
        <Typography.Paragraph>按下表成本及统一汇率结算；积分单价仅作展示，优惠在下方“限时优惠”配置。</Typography.Paragraph>
        {renderTextCostTable(false)}
      </>}
      <Space size="large" wrap>
        <label>
          <FieldLabel text={pricing.unit === "thousand_characters" ? "输入单价(积分 / 千字符)" : isLegacyGoogle ? "输入单价（此模型须为 0）" : "输入单价(积分 / 千 token)"} />
          <InputNumber
            min={0}
            precision={3}
            step={0.001}
            style={{ width: 220 }}
            disabled={usageCostText}
            value={pricing.input_credit_rate}
            onChange={(v) => setRate("input_credit_rate", v)}
            placeholder="如 2"
          />
        </label>
        <label>
          <FieldLabel
            text={
              isLegacyGoogle
                ? "固定售价（积分 / 张）"
                : (OUTPUT_RATE_LABEL_BY_UNIT[pricing.unit ?? ""] ?? "输出单价(积分 / 千 token)")
            }
          />
          <InputNumber
            min={0}
            precision={3}
            step={0.001}
            style={{ width: 240 }}
            disabled={usageCostText}
            value={pricing.output_credit_rate}
            onChange={(v) => setRate("output_credit_rate", v)}
            placeholder="如 8"
          />
        </label>
        {capability === "responses" && (
          <label style={{ display: "block", width: 240 }}>
            <FieldLabel text="缓存输入单价(积分 / 千 token)" />
            <InputNumber
              min={0.001}
              max={pricing.input_credit_rate}
              precision={3}
              step={0.001}
              style={{ width: "100%" }}
              disabled={usageCostText}
              value={pricing.cached_input_credit_rate}
              onChange={(v) => setRate("cached_input_credit_rate", v)}
              placeholder="留空沿用普通输入价"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              OpenAI 及兼容文本接口；仅按实际缓存命中用量计价，须大于 0 且不高于普通输入价。
            </Typography.Text>
          </label>
        )}
      </Space>

      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
      >
        {usageCostText ? (
          <>输入、输出和缓存按各自成本档结算；预冻结与最终实扣以后台报价和上游实际用量为准。</>
        ) : capability === "audio" ? (
          <>Seed Audio 按原始音频秒数结算，按 120 秒上限预冻；Seed TTS 按朗读字符数结算。供应商成本可在高级 JSON 配置 provider_cost_cents_per_minute（分/分钟）或 provider_cost_cents_per_ten_thousand_characters（分/万字符）。</>
        ) : isLegacyGoogle ? (
          <>固定售价：<Typography.Text strong>{fmtCredits(outRate)} 积分 / 张 = ¥{(Math.round(outRate * 1000) * 2 / 100_000).toFixed(2)} / 张</Typography.Text>。这是自定义售价，不是官方成本计费。</>
        ) : (
          <>单价示例：1000 输入 + 1000 输出 token = {fmtCredits((Math.round(inRate * 1000) + Math.round(outRate * 1000)) / 1000)} 积分（输入 {fmtCredits(inRate)} + 输出 {fmtCredits(outRate)}）。{capability === "image" ? "图片模型的预扣与结算取决于供应商返回的用量，按次单位不代表固定每张价格。" : "实际按上游返回的真实 token 结算。"}</>
        )}
      </Typography.Paragraph>

      {isText && <Collapse ghost size="small" items={[{key:'promo',label:promoActive?'限时优惠（生效中）':'限时优惠',children:renderPromo()}]} />}
      {renderFinanceRates()}
      {renderAdvanced()}
    </div>
  );

  function renderUnit() {
    return (
      <label style={{ display: "block", marginBottom: 12 }}>
        <FieldLabel text="计费单位" />
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
          {usageCostText ? "上述成本档用于实际结算，按统一汇率折算，1 积分 = ¥0.02。修改常规价后，已提交任务仍沿用原价格快照。" : "经营分析无需配置：系统按模型 ID 自动匹配官方上游价格，固定按 1 积分 = ¥0.02 计算收入；HappyHorse 使用本项目四折合同价。"}
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
