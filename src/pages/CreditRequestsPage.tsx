import { useState } from 'react'
import { InputNumber, Select, Space, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { listCreditRequests, type CreditRequestListParams } from '@/api/queries'
import { Credits, Mono } from '@/components/cells'
import { ListPageShell } from '@/components/ListPageShell'
import { usePagedList } from '@/hooks/usePagedList'
import type { CreditRequestListItem, CreditRequestStatus } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const statuses: Record<CreditRequestStatus, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'gold' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
  expired: { label: '已失效', color: 'default' },
}

function participant(name: string, id: number) {
  return (
    <Space size={6}>
      {name}
      <Mono>#{id}</Mono>
    </Space>
  )
}

const columns: TableColumnsType<CreditRequestListItem> = [
  { title: '申请编号', dataIndex: 'id', width: 96, render: (id: number) => <Mono>{id}</Mono> },
  { title: '申请人', render: (_, row) => participant(row.applicant_name, row.applicant_user_id) },
  { title: '审批人', render: (_, row) => participant(row.approver_name, row.approver_user_id) },
  {
    title: '到账工作空间',
    render: (_, { workspace }) =>
      workspace ? participant(workspace.name, workspace.id) : '个人空间（历史记录）',
  },
  { title: '申请积分', dataIndex: 'amount', width: 110, render: (amount: number) => <Credits value={amount} /> },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (status: CreditRequestStatus) => (
      <Tag color={statuses[status]?.color}>{statuses[status]?.label ?? status}</Tag>
    ),
  },
  { title: '申请说明', dataIndex: 'note', width: 220, ellipsis: true, render: (note: string) => note || '—' },
  { title: '申请时间', dataIndex: 'created_at', width: 175, render: fmtTime },
  { title: '处理时间', dataIndex: 'decided_at', width: 175, render: fmtTime },
]

const idFilters = [
  { field: 'applicant_user_id', label: '申请人用户 ID' },
  { field: 'approver_user_id', label: '审批人用户 ID' },
  { field: 'workspace_id', label: '到账空间 ID' },
] as const

type Filters = Pick<CreditRequestListParams, (typeof idFilters)[number]['field'] | 'status'>

export function CreditRequestsPage() {
  const [filters, setFilters] = useState<Filters>({})
  const { items, loading, error, pagination } = usePagedList({
    queryKey: 'admin-credit-requests-list',
    filters,
    fetcher: listCreditRequests,
  })

  return (
    <ListPageShell
      title="积分申请记录"
      filters={
        <Space wrap>
          {idFilters.map(({ field, label }) => (
            <InputNumber
              key={field}
              aria-label={label}
              placeholder={label}
              style={{ width: 160 }}
              min={1}
              max={Number.MAX_SAFE_INTEGER}
              precision={0}
              controls={false}
              onChange={(value) => setFilters((current) => ({ ...current, [field]: value ?? undefined }))}
            />
          ))}
          <Select<CreditRequestStatus | undefined>
            aria-label="审批状态"
            placeholder="审批状态"
            style={{ width: 120 }}
            allowClear
            options={Object.entries(statuses).map(([value, { label }]) => ({ value, label }))}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
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
