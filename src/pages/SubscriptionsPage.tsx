import { useState } from 'react'
import { Input, Select, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listSubscriptions } from '@/api/queries'
import type { Subscription } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const columns: TableColumnsType<Subscription> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  {
    title: 'workspace',
    dataIndex: 'workspace_id',
    width: 110,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: 'plan ID',
    dataIndex: 'plan_id',
    width: 100,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: (v) => <StatusTag status={v} />,
  },
  {
    title: '支付宝协议号',
    dataIndex: 'alipay_agreement_no',
    width: 200,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '当前周期结束',
    dataIndex: 'current_period_end',
    width: 180,
    render: (v) => fmtTime(v),
  },
  {
    title: '取消时间',
    dataIndex: 'canceled_at',
    width: 180,
    render: (v) => fmtTime(v),
  },
]

interface Filters {
  workspace_id?: number
  status?: string
}

export function SubscriptionsPage() {
  const [filters, setFilters] = useState<Filters>({})

  const { items, loading, error, pagination } = usePagedList<
    Subscription,
    Filters
  >({
    queryKey: 'admin-subscriptions-list',
    filters,
    fetcher: listSubscriptions,
  })

  return (
    <ListPageShell<Subscription>
      title="订阅管理"
      filters={
        <Space wrap>
          <Input
            allowClear
            placeholder="workspace ID"
            style={{ width: 140 }}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                workspace_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 150 }}
            options={[
              { value: 'active', label: 'active' },
              { value: 'canceled', label: 'canceled' },
              { value: 'expired', label: 'expired' },
            ]}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          />
        </Space>
      }
      columns={columns}
      dataSource={items}
      rowKey="id"
      loading={loading}
      error={error}
      pagination={pagination}
    />
  )
}
