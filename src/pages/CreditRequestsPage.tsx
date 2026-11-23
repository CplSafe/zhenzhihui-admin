import { useState } from 'react'
import { Button, Drawer, InputNumber, Select, Space, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { listCreditRequests, type CreditRequestListParams } from '@/api/queries'
import { Count, Credits, Mono } from '@/components/cells'
import { ListPageShell } from '@/components/ListPageShell'
import { usePagedList } from '@/hooks/usePagedList'
import type { CreditRequestCanvasUsage, CreditRequestListItem, CreditRequestStatus } from '@/types/domain'
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

const requestColumns = (
  viewCanvasUsage: (row: CreditRequestListItem) => void,
): TableColumnsType<CreditRequestListItem> => [
  { title: '申请编号', dataIndex: 'id', width: 96, render: (id: number) => <Mono>{id}</Mono> },
  { title: '申请人', render: (_, row) => participant(row.applicant_name, row.applicant_user_id) },
  { title: '审批人', render: (_, row) => participant(row.approver_name, row.approver_user_id) },
  {
    title: '到账工作空间',
    render: (_, { workspace }) =>
      workspace ? participant(workspace.name, workspace.id) : '个人空间（历史记录）',
  },
  { title: '剧本名称', dataIndex: 'script_name', width: 180, ellipsis: true, render: (name?: string) => name || '—' },
  { title: '申请积分', dataIndex: 'amount', width: 110, render: (amount: number) => <Credits value={amount} /> },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (status: CreditRequestStatus) => (
      <Tag color={statuses[status]?.color}>{statuses[status]?.label ?? status}</Tag>
    ),
  },
  {
    title: '团队无限画布用量',
    key: 'canvas_usage',
    width: 220,
    render: (_, row) => {
      const usage = row.canvas_usage
      if (!usage) return <Typography.Text type="secondary">提交时未记录用量</Typography.Text>
      return (
        <Space orientation="vertical" size={2} align="start">
          <span><Count value={usage.canvas_count} /> 张画布 · 消耗 <Credits value={usage.credits_used} /> 积分</span>
          <span><Count value={usage.image_count} /> 张图片 · <Count value={usage.video_count} /> 个视频</span>
          {usage.canvases.length > 0 && (
            <Button
              type="link"
              size="small"
              aria-label={`查看画布明细 · 申请 #${row.id}`}
              style={{ paddingInline: 0 }}
              onClick={() => viewCanvasUsage(row)}
            >
              查看画布明细
            </Button>
          )}
        </Space>
      )
    },
  },
  { title: '申请说明', dataIndex: 'note', width: 220, ellipsis: true, render: (note: string) => note || '—' },
  { title: '申请时间', dataIndex: 'created_at', width: 175, render: fmtTime },
  { title: '处理时间', dataIndex: 'decided_at', width: 175, render: fmtTime },
]

const canvasColumns: TableColumnsType<CreditRequestCanvasUsage> = [
  {
    title: '无限画布',
    dataIndex: 'canvas_name',
    width: 200,
    ellipsis: true,
    render: (name: string, row) => name || `画布 #${row.canvas_id}`,
  },
  { title: '团队', dataIndex: 'workspace_name', width: 150, ellipsis: true },
  { title: '消耗积分', dataIndex: 'credits_used', align: 'right', render: (value: number) => <Credits value={value} /> },
  { title: '图片数', dataIndex: 'image_count', align: 'right', render: (value: number) => <Count value={value} /> },
  { title: '视频数', dataIndex: 'video_count', align: 'right', render: (value: number) => <Count value={value} /> },
]

const idFilters = [
  { field: 'applicant_user_id', label: '申请人用户 ID' },
  { field: 'approver_user_id', label: '审批人用户 ID' },
  { field: 'workspace_id', label: '到账空间 ID' },
] as const

type Filters = Pick<CreditRequestListParams, (typeof idFilters)[number]['field'] | 'status'>

export function CreditRequestsPage() {
  const [filters, setFilters] = useState<Filters>({})
  const [selected, setSelected] = useState<CreditRequestListItem | null>(null)
  const { items, loading, error, pagination } = usePagedList({
    queryKey: 'admin-credit-requests-list',
    filters,
    fetcher: listCreditRequests,
  })

  const usage = selected?.canvas_usage

  return (
    <>
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
        columns={requestColumns(setSelected)}
        dataSource={items}
        rowKey="id"
        loading={loading}
        error={error}
        pagination={pagination}
      />

      <Drawer
        title={selected ? `画布用量明细 · 申请 #${selected.id}` : '画布用量明细'}
        open={!!usage}
        size="min(760px, 100vw)"
        onClose={() => setSelected(null)}
        destroyOnHidden
      >
        {usage && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              {usage.canvases.length < usage.canvas_count
                ? `申请提交时共 ${usage.canvas_count} 张画布，以下展示最近 ${usage.canvases.length} 张。`
                : '以下为申请提交时记录的团队无限画布用量。'}
            </Typography.Text>
            <Table<CreditRequestCanvasUsage>
              size="small"
              rowKey="canvas_id"
              columns={canvasColumns}
              dataSource={usage.canvases}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Space>
        )}
      </Drawer>
    </>
  )
}
