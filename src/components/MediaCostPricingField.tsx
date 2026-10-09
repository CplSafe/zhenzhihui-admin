import { Alert, InputNumber, Table, Typography } from 'antd'
import type { Pricing } from '@/types/domain'

export function MediaCostPricingField({ value, onChange }: { value: Pricing; onChange: (value: Pricing) => void }) {
  const currency = value.provider_cost_currency ?? 'CNY'
  const labels: Record<string, string> = { text_input: '文字输入', cached_text_input: '缓存文字输入（直接图片接口不适用）', image_input: '图片输入', cached_image_input: '缓存图片输入（直接图片接口不适用）', output: '图片输出' }
  const rows = Object.entries(value.provider_cost_cents_per_million_tokens_by_usage ?? {}).map(([key, cents]) => ({ key, label: labels[key] ?? key, price: `${currency} ${cents / 100} / 百万 token` }))
  for (const [key, cents] of Object.entries(value.provider_cost_cents_per_successful_output_by_variant ?? {})) rows.push({ key, label: `输出 ${key}`, price: `¥${Number(cents) / 100} / 成功图片` })
  for (const [key, label, unit] of [
    ['provider_cost_cents_per_successful_output', '图片输出', '成功图片'],
    ['provider_cost_cents_per_extra_input_image', '第 2 张起的参考图', '张'],
    ['provider_cost_cents_per_minute', '原始音频时长', '分钟'],
    ['provider_cost_cents_per_ten_thousand_characters', '朗读文本', '万字符'],
  ] as const) { const cents = value[key]; if (typeof cents === 'number' && cents > 0) rows.push({ key, label, price: `¥${cents / 100} / ${unit}` }) }
  return <div>
    <Alert type="info" showIcon title="按官方成本结算 · 1 积分 = ¥0.02" description="实际用量 × 官方单价，整笔向上取整到 0.001 积分。预估仅用于冻结；缺失计费用量时不会按固定积分兜底扣费。" style={{ marginBottom: 12 }} />
    <Table size="small" rowKey="key" pagination={false} dataSource={rows} columns={[{ title: '计费项', dataIndex: 'label' }, { title: '官方单价', dataIndex: 'price' }]} />
    {currency === 'USD' && <label style={{ display: 'block', marginTop: 12 }}>结算汇率（人民币 / 美元，非实时汇率）<br /><InputNumber aria-label="结算汇率" value={(value.provider_cost_to_cny_ppm ?? 7300000) / 1000000} min={0.000001} max={1000} precision={6} onChange={n => onChange({ ...value, provider_cost_to_cny_ppm: n === null ? undefined : Math.round(n * 1000000) })} /></label>}
    <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>Seedream Pro 按实际输出像素分档；Seed Audio 按原始时长结算；TTS 按实际字符数结算。GPT 连续编辑暂不可用，普通参考图编辑可用。</Typography.Paragraph>
  </div>
}
