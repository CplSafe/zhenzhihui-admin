import { useState } from "react";
import { Collapse, InputNumber, Space, Typography } from "antd";
import { JsonField } from "@/components/JsonField";
import type { Pricing } from "@/types/domain";

interface PricingFieldProps {
  value?: Pricing;
  onChange?: (value: Pricing) => void;
  // 高级 JSON 解析失败时上报,沿用 ModelsPage 的保存禁用逻辑。
  onValidityChange?: (valid: boolean) => void;
}

// 常用字段走结构化数字框(运营小白友好),生僻字段(按分辨率秒价等)留在高级 JSON。
// 拆分原则:input/output_credit_rate 是 chat 计费的主轴,单独拎出来 + 实时预览;
// 其余 unit / 并发 / 视频按秒 折叠进"高级",避免界面吓退运营。
const COMMON_KEYS = ["input_credit_rate", "output_credit_rate"] as const;

export function PricingField({
  value,
  onChange,
  onValidityChange,
}: PricingFieldProps) {
  const pricing: Pricing = value ?? {};

  // 高级 JSON 只承载"非常用"字段,避免与上面数字框双向打架。
  const advanced: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(pricing)) {
    if (!COMMON_KEYS.includes(k as (typeof COMMON_KEYS)[number])) {
      advanced[k] = v;
    }
  }
  const [advancedValid, setAdvancedValid] = useState(true);

  const emit = (next: Pricing) => onChange?.(next);

  const setCommon = (key: (typeof COMMON_KEYS)[number], v: number | null) => {
    const next: Pricing = { ...pricing };
    if (v === null) delete next[key];
    else next[key] = v;
    emit(next);
  };

  const setAdvanced = (parsed: unknown) => {
    const adv = (parsed as Record<string, unknown>) ?? {};
    // 合并:保留常用数字字段,用新的高级字段替换其余。
    const next: Pricing = {};
    for (const k of COMMON_KEYS) {
      if (pricing[k] !== undefined) next[k] = pricing[k];
    }
    Object.assign(next, adv);
    emit(next);
  };

  const inRate = pricing.input_credit_rate ?? 0;
  const outRate = pricing.output_credit_rate ?? 0;

  return (
    <div>
      <Space size="large" wrap>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
            输入单价(积分 / 千 token)
          </div>
          <InputNumber
            min={0}
            precision={0}
            style={{ width: 200 }}
            value={pricing.input_credit_rate}
            onChange={(v) => setCommon("input_credit_rate", v)}
            placeholder="如 2"
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
            输出单价(积分 / 千 token)
          </div>
          <InputNumber
            min={0}
            precision={0}
            style={{ width: 200 }}
            value={pricing.output_credit_rate}
            onChange={(v) => setCommon("output_credit_rate", v)}
            placeholder="如 8"
          />
        </label>
      </Space>

      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 8, marginBottom: 8 }}
      >
        预览:一次对话约 1000 输入 + 1000 输出 token ≈{" "}
        <Typography.Text strong>{inRate + outRate}</Typography.Text> 积分
        (输入 {inRate} + 输出 {outRate})。实际按上游返回的真实 token 结算。
      </Typography.Paragraph>

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "adv",
            label: "高级计价(并发 / 视频按秒 / 分辨率,JSON)",
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
    </div>
  );
}
