import { useState } from 'react'
import { Input, Select, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Count, Money, Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listPaymentOrders } from '@/api/queries'
import type { PaymentOrder } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const TYPE_LABEL: Record<string, string> = {
  credit_recharge: '积分充值',
  subscription_initial: '订阅首期',
  subscription_renewal: '订阅续费',
  subscription_upgrade: '订阅升级',
}

const columns: TableColumnsType<PaymentOrder> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  {
    title: 'workspace',
    dataIndex: 'workspace_id',
    width: 110,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '类型',
    dataIndex: 'type',
    width: 110,
    render: (v) => TYPE_LABEL[v] ?? v,
  },
  {
    title: '金额',
    dataIndex: 'amount_cents',
    width: 120,
    render: (v) => <Money cents={v} />,
  },
  {
    title: '积分',
    dataIndex: 'credits',
    width: 100,
    render: (v) => <Count value={v} />,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: (v) => <StatusTag status={v} />,
  },
  { title: '渠道', dataIndex: 'provider', width: 90 },
  {
    title: '交易号',
    dataIndex: 'provider_trade_no',
    width: 200,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    width: 180,
    render: (v) => fmtTime(v),
  },
]

interface Filters {
  workspace_id?: number
  status?: string
  type?: string
}

export function PaymentOrdersPage() {
  const [filters, setFilters] = useState<Filters>({})

  const { items, loading, error, pagination } = usePagedList<
    PaymentOrder,
    Filters
  >({
    queryKey: 'admin-payment-orders-list',
    filters,
    fetcher: listPaymentOrders,
  })

  return (
    <ListPageShell<PaymentOrder>
      title="支付订单"
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
            placeholder="类型"
            style={{ width: 150 }}
            options={[
              { value: 'credit_recharge', label: '积分充值' },
              { value: 'subscription_initial', label: '订阅首期' },
              { value: 'subscription_renewal', label: '订阅续费' },
              { value: 'subscription_upgrade', label: '订阅升级' },
            ]}
            onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 140 }}
            options={[
              { value: 'paid', label: 'paid' },
              { value: 'pending', label: 'pending' },
              { value: 'failed', label: 'failed' },
              { value: 'canceled', label: 'canceled' },
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
