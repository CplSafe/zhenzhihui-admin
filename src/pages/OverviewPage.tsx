import { useState } from 'react'
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Row,
  Space,
  Statistic,
  Typography,
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { getOverview } from '@/api/queries'
import type { ApiError } from '@/types/api'
import type { Overview } from '@/types/domain'
import { centsToYuan, fmtNumber, humanBytes } from '@/utils/format'

const { RangePicker } = DatePicker

// KPI 卡片小封装,统一 tnum 数字风格。
function KpiCard({
  title,
  value,
  suffix,
  prefix,
  hint,
}: {
  title: string
  value: string | number
  suffix?: string
  prefix?: string
  hint?: string
}) {
  return (
    <Card>
      <Statistic
        title={title}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{
          fontWeight: 300,
          fontFeatureSettings: '"tnum"',
          letterSpacing: '-0.42px',
        }}
      />
      {hint && (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {hint}
        </Typography.Text>
      )}
    </Card>
  )
}

export function OverviewPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const params = {
    from: range?.[0]?.format('YYYY-MM-DD'),
    to: range?.[1]?.format('YYYY-MM-DD'),
  }

  const { data, isLoading, error } = useQuery<Overview, ApiError>({
    queryKey: ['admin', 'overview', params],
    queryFn: () => getOverview(params),
  })

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
          运营概览
        </Typography.Title>
        <RangePicker
          allowClear
          value={range}
          onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
          presets={[
            { label: '近 7 天', value: [dayjs().add(-7, 'd'), dayjs()] },
            { label: '近 30 天', value: [dayjs().add(-30, 'd'), dayjs()] },
            { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
          ]}
        />
      </Row>

      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        时间区间仅作用于"新增 / 消耗 / 充值"维度;总量始终为全量。
      </Typography.Text>

      {error && (
        <Alert type="error" showIcon message="加载失败" description={error.message} />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} md={8} lg={6}>
          <KpiCard
            title="用户总数"
            value={fmtNumber(data?.users_total)}
            hint={`区间新增 ${fmtNumber(data?.users_new)}`}
          />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <KpiCard
            title="工作空间"
            value={fmtNumber(data?.workspaces_total)}
            hint={`区间新增 ${fmtNumber(data?.workspaces_new)}`}
          />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <KpiCard
            title="AI 任务总数"
            value={fmtNumber(data?.ai_tasks_total)}
            hint={`成功 ${fmtNumber(data?.ai_tasks_succeeded)} · 失败 ${fmtNumber(
              data?.ai_tasks_failed,
            )} · 处理中 ${fmtNumber(data?.ai_tasks_processing)}`}
          />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <KpiCard
            title="活跃订阅"
            value={fmtNumber(data?.active_subscriptions)}
          />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <KpiCard
            title="区间消耗积分"
            value={fmtNumber(data?.credits_consumed)}
          />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <KpiCard
            title="区间充值金额"
            prefix="¥"
            value={centsToYuan(data?.recharge_amount_cents)}
          />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <KpiCard title="素材总数" value={fmtNumber(data?.assets_total)} />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <KpiCard
            title="素材总占用"
            value={humanBytes(data?.assets_size_bytes)}
          />
        </Col>
      </Row>

      {isLoading && (
        <Typography.Text type="secondary">加载中…</Typography.Text>
      )}
    </Space>
  )
}
