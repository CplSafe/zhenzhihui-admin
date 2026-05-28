import { useState } from 'react'
import { Input, Select, Space, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Count, Mono } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listCreditLedgers } from '@/api/queries'
import type { CreditLedger } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const KIND_COLOR: Record<string, string> = {
  freeze: 'gold',
  settle: 'red',
  release: 'blue',
  credit: 'green',
}

const columns: TableColumnsType<CreditLedger> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  {
    title: 'workspace',
    dataIndex: 'workspace_id',
    width: 110,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '类型',
    dataIndex: 'kind',
    width: 100,
    render: (v) => <Tag color={KIND_COLOR[v] ?? 'default'}>{v}</Tag>,
  },
  {
    title: '变动',
    dataIndex: 'amount',
    width: 110,
    render: (v: number) => (
      <span className="tnum" style={{ color: v < 0 ? '#ea2261' : '#0d253d' }}>
        {v > 0 ? `+${v}` : v}
      </span>
    ),
  },
  {
    title: '余额',
    dataIndex: 'balance_after',
    width: 110,
    render: (v) => <Count value={v} />,
  },
  {
    title: '冻结后',
    dataIndex: 'frozen_after',
    width: 110,
    render: (v) => <Count value={v} />,
  },
  { title: '原因', dataIndex: 'reason', ellipsis: true },
  {
    title: '时间',
    dataIndex: 'created_at',
    width: 180,
    render: (v) => fmtTime(v),
  },
]

interface Filters {
  workspace_id?: number
  kind?: string
}

export function CreditLedgersPage() {
  const [filters, setFilters] = useState<Filters>({})

  const { items, loading, error, pagination } = usePagedList<
    CreditLedger,
    Filters
  >({
    queryKey: 'admin-credit-ledgers-list',
    filters,
    fetcher: listCreditLedgers,
  })

  return (
    <ListPageShell<CreditLedger>
      title="积分流水"
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
            style={{ width: 140 }}
            options={[
              { value: 'freeze', label: 'freeze 冻结' },
              { value: 'settle', label: 'settle 结算' },
              { value: 'release', label: 'release 释放' },
              { value: 'credit', label: 'credit 入账' },
            ]}
            onChange={(v) => setFilters((f) => ({ ...f, kind: v }))}
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
