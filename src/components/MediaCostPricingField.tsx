import { Alert, Table, Typography } from 'antd'
import type { Pricing } from '@/types/domain'
import { mediaCreditsPerThousandTokens } from '@/utils/mediaCostPricing'

export function MediaCostPricingField({ value }: { value: Pricing; onChange: (value: Pricing) => void }) {
  const currency = value.provider_cost_currency ?? 'CNY'
  const labels: Record<string, string> = { text_input: '文字输入', cached_text_input: '缓存文字输入（直接图片接口不适用）', image_input: '图片输入', cached_image_input: '缓存图片输入（直接图片接口不适用）', output: '图片输出' }
  const fx = currency === 'CNY' ? 1_000_000 : value.provider_cost_to_cny_ppm
  const rows: { key: string; label: string; price: string; credits?: string }[] = Object.entries(value.provider_cost_cents_per_million_tokens_by_usage ?? {}).map(([key, cents]) => {
    const rate = mediaCreditsPerThousandTokens(cents, fx)
    return { key, label: labels[key] ?? key, price: `${currency} ${cents / 100} / 百万 token`, credits: rate === null ? '等待汇率同步' : `${rate.toLocaleString('zh-CN', { maximumFractionDigits: 6 })} 积分 / 千 token` }
  })
  for (const [key, cents] of Object.entries(value.provider_cost_cents_per_successful_output_by_variant ?? {})) rows.push({ key, label: `输出 ${key}`, price: `¥${Number(cents) / 100} / 成功图片` })
  for (const [key, label, unit] of [
    ['provider_cost_cents_per_successful_output', '图片输出', '成功图片'],
    ['provider_cost_cents_per_extra_input_image', '第 2 张起的参考图', '张'],
    ['provider_cost_cents_per_minute', '原始音频时长', '分钟'],
    ['provider_cost_cents_per_ten_thousand_characters', '朗读文本', '万字符'],
  ] as const) { const cents = value[key]; if (typeof cents === 'number' && cents > 0) rows.push({ key, label, price: `¥${cents / 100} / ${unit}` }) }
  return <div>
    <Alert type="info" showIcon title="按官方成本结算 · 1 积分 = ¥0.02" description="实际用量 × 官方单价，整笔向上取整到 0.001 积分。预估仅用于冻结；缺失计费用量时不会按固定积分兜底扣费。" style={{ marginBottom: 12 }} />
    <Table size="small" rowKey="key" pagination={false} dataSource={rows} columns={[{ title: '计费项', dataIndex: 'label' }, { title: '官方单价', dataIndex: 'price' }, { title: '折算积分', dataIndex: 'credits', render: (v: string | undefined) => v ?? '—' }]} />
    {Object.keys(value.provider_cost_cents_per_million_tokens_by_usage ?? {}).length > 0 && <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
      文字输入、图片输入和图片输出按各自实际 token 数计费；以上积分单价随结算汇率自动换算，无需另填固定输入／输出积分。图片单张费用取决于画质、尺寸及参考图；自动档按最高支持档位保守预估，完成后多退少补。
    </Typography.Paragraph>}
    {currency === 'USD' && <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>汇率统一自动同步，来源与日期见模型配置页顶部；不再按模型单独填写。</Typography.Paragraph>}
    <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>Seedream Pro 按实际输出像素分档；Seed Audio 按原始时长结算；TTS 按实际字符数结算。GPT 连续编辑暂不可用，普通参考图编辑可用。</Typography.Paragraph>
  </div>
}
