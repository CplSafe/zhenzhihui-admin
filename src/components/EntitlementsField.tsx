import { useState } from "react";
import { Collapse, InputNumber, Select, Space, Switch, Typography } from "antd";
import { JsonField } from "@/components/JsonField";

// 套餐权益(entitlements_json)的形状。后端按需读取,字段都可缺省。
// 常用字段走结构化控件(运营友好),生僻字段折叠进高级 JSON。
export interface Entitlements {
  plan_type?: "personal" | "team";
  models?: string[];
  concurrency?: number;
  max_members?: number;
  max_teams?: number;
  max_workspaces?: number;
  system_only?: boolean;
  is_trial_grant?: boolean;
  trial_days?: number;
  [key: string]: unknown;
}

interface EntitlementsFieldProps {
  value?: Entitlements;
  onChange?: (value: Entitlements) => void;
  // 高级 JSON 解析失败时上报,父组件据此禁用保存(沿用 PlansPage 逻辑)。
  onValidityChange?: (valid: boolean) => void;
}

// 结构化承载的常用字段;其余字段(模型限定外的灵活配置)留在高级 JSON。
const COMMON_KEYS = [
  "plan_type",
  "models",
  "concurrency",
  "max_members",
  "max_teams",
  "max_workspaces",
  "system_only",
  "is_trial_grant",
  "trial_days",
] as const;

type CommonKey = (typeof COMMON_KEYS)[number];

// 小字号字段标题:本组件里重复 8 次,抽出一个本地小组件去重(与 PricingField 的内联风格一致,
// 仅因重复多才提取)。
function FieldLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{text}</div>
  );
}

export function EntitlementsField({
  value,
  onChange,
  onValidityChange,
}: EntitlementsFieldProps) {
  const ent: Entitlements = value ?? {};

  // 高级 JSON 只承载"非常用"字段,避免与上面控件双向打架。
  const advanced: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ent)) {
    if (!COMMON_KEYS.includes(k as CommonKey)) advanced[k] = v;
  }
  const [advancedValid, setAdvancedValid] = useState(true);

  const emit = (next: Entitlements) => onChange?.(next);

  // 设/删常用字段:传 undefined / 空数组时删除该 key,保持 JSON 干净。
  // 写入走索引签名(Record),避免具名 key 联合类型在 next[key] 写处坍缩成 undefined。
  const setCommon = (key: CommonKey, v: unknown) => {
    const next: Record<string, unknown> = { ...ent };
    const isEmpty =
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (isEmpty) delete next[key];
    else next[key] = v;
    emit(next as Entitlements);
  };

  const setAdvanced = (parsed: unknown) => {
    const adv = (parsed as Record<string, unknown>) ?? {};
    // 合并:保留常用字段,用新的高级字段替换其余。
    const next: Record<string, unknown> = {};
    for (const k of COMMON_KEYS) {
      if (ent[k] !== undefined) next[k] = ent[k];
    }
    Object.assign(next, adv);
    emit(next as Entitlements);
  };

  return (
    <div>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <label>
          <FieldLabel text="套餐档位" />
          <Select
            allowClear
            style={{ width: "100%" }}
            placeholder="不限定(留空)"
            value={ent.plan_type}
            onChange={(v) => setCommon("plan_type", v)}
            options={[
              { value: "personal", label: "个人版" },
              { value: "team", label: "团队版" },
            ]}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            仅用于展示与配置分组,不强制拦截。
          </Typography.Text>
        </label>

        <label>
          <FieldLabel text="可用模型(留空表示不限定)" />
          <Select
            mode="tags"
            style={{ width: "100%" }}
            placeholder="如 gpt-5.4 / qwen3.7,回车添加"
            value={ent.models}
            onChange={(v) => setCommon("models", v)}
            tokenSeparators={[",", " "]}
          />
        </label>

        <Space size="large" wrap>
          <label>
            <FieldLabel text="并发数" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 150 }}
              value={ent.concurrency}
              onChange={(v) => setCommon("concurrency", v)}
              placeholder="如 1"
            />
          </label>
          <label>
            <FieldLabel text="席位数(空间成员上限)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 180 }}
              value={ent.max_members}
              onChange={(v) => setCommon("max_members", v)}
              placeholder="如 5"
            />
          </label>
        </Space>

        <Space size="large" wrap>
          <label>
            <FieldLabel text="团队数上限(展示用)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 180 }}
              value={ent.max_teams}
              onChange={(v) => setCommon("max_teams", v)}
              placeholder="0 = 不可建团队"
            />
          </label>
          <label>
            <FieldLabel text="空间数上限(展示用)" />
            <InputNumber
              min={0}
              precision={0}
              style={{ width: 180 }}
              value={ent.max_workspaces}
              onChange={(v) => setCommon("max_workspaces", v)}
              placeholder="如 1"
            />
          </label>
        </Space>

        <Space size="large" wrap align="center">
          <Space>
            <Switch
              checked={!!ent.system_only}
              onChange={(c) => setCommon("system_only", c || undefined)}
            />
            <span style={{ fontSize: 13 }}>系统专用(必须零价)</span>
          </Space>
          <Space>
            <Switch
              checked={!!ent.is_trial_grant}
              onChange={(c) => setCommon("is_trial_grant", c || undefined)}
            />
            <span style={{ fontSize: 13 }}>
              注册赠送(最多一条,须同时系统专用)
            </span>
          </Space>
        </Space>

        {ent.is_trial_grant && (
          <label>
            <FieldLabel text="试用天数" />
            <InputNumber
              min={1}
              precision={0}
              style={{ width: 150 }}
              value={ent.trial_days}
              onChange={(v) => setCommon("trial_days", v)}
              placeholder="如 7"
            />
          </label>
        )}
      </Space>

      <Collapse
        ghost
        size="small"
        style={{ marginTop: 8 }}
        items={[
          {
            key: "adv",
            label: "高级权益(其余自定义字段,JSON)",
            children: (
              <JsonField
                rows={5}
                value={advanced}
                placeholder='{ "custom_flag": true }'
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
          高级权益 JSON 格式有误
        </Typography.Text>
      )}
    </div>
  );
}
