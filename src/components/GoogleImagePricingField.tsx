import { Alert, Button, Space, Table, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import type { Pricing } from "@/types/domain";
import { fmtCredits } from "@/utils/format";
import {
  applyGoogleImagePricing,
  googleImageOutputCosts,
  validGoogleImagePricing,
  type GoogleImageSpec,
} from "@/utils/googleImagePricing";

export function GoogleImagePricingField({ spec, value, onChange }: {
  spec: GoogleImageSpec;
  value: Pricing;
  onChange: (value: Pricing) => void;
}) {
  const valid = validGoogleImagePricing(spec, value);
  const costs = googleImageOutputCosts(spec, value);
  const usageLabels = { input: "文字 / 图片输入", text_output: "文字 / 思考输出", image_output: "图片输出" };
  return (
    <div>
      <Typography.Paragraph strong>官方成本折算积分（provider_cost）</Typography.Paragraph>
      {!valid && (
        <Alert
          type="warning"
          showIcon
          title="当前计价配置与此模型不匹配"
          description={`当前单位：${value.unit ?? "未配置"}；输入单价：${value.input_credit_rate ?? 0}；输出单价：${value.output_credit_rate ?? 0}。固定积分单价不适用于此模型。`}
          style={{ marginBottom: 12 }}
        />
      )}
      <Space wrap style={{ marginBottom: 12 }}>
        <Button icon={<CheckOutlined />} onClick={() => onChange(applyGoogleImagePricing(spec, value))}>
          应用官方成本配置
        </Button>
        <Typography.Link href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">
          Google Standard 定价
        </Typography.Link>
      </Space>
      <Table
        size="small"
        pagination={false}
        rowKey="usage"
        dataSource={Object.entries(spec.rates).map(([usage, official]) => ({
          usage,
          label: usageLabels[usage as keyof typeof usageLabels],
          official: official / 100,
          configured: value.provider_cost_cents_per_million_tokens_by_usage?.[usage],
        }))}
        columns={[
          { title: "用量", dataIndex: "label" },
          { title: "当前单价", render: (_, row) => row.configured === undefined ? "未配置" : `${value.provider_cost_currency ?? "币种未配置"} ${row.configured / 100}` },
          { title: "官方单价", render: (_, row) => `$${row.official}` },
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
        单位：美元 / 百万 token。1 积分 = ¥0.02，全部用量成本合计后向上取整到 0.001 积分。
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">汇率由系统统一自动同步，来源与日期见模型配置页顶部；不再按模型单独填写。</Typography.Paragraph>
      {valid && (
        <>
          <Typography.Paragraph strong>图片输出成本（不含输入及思考）</Typography.Paragraph>
          <Table
            size="small"
            pagination={false}
            rowKey="resolution"
            dataSource={costs}
            columns={[
              { title: "分辨率", dataIndex: "resolution" },
              { title: "成本 / 张", render: (_, row) => `¥${row.cny.toFixed(4)}` },
              { title: "仅输出折算积分", dataIndex: "credits", render: (v: number) => fmtCredits(v) },
            ]}
          />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            任务预扣包含输入和思考的估算用量；完成后按实际用量结算，多退少补。
          </Typography.Paragraph>
        </>
      )}
    </div>
  );
}
