import { useState } from 'react'
import { DatePicker, Input, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ListPageShell } from '@/components/ListPageShell'
import { Mono } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listAuditLogs } from '@/api/queries'
import type { AdminAuditLog } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const { RangePicker } = DatePicker

const columns: TableColumnsType<AdminAuditLog> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  {
    title: '操作者',
    dataIndex: 'actor_admin_user_id',
    width: 110,
    render: (v) => <Mono>{v}</Mono>,
  },
  { title: '动作', dataIndex: 'action', width: 220 },
  { title: '资源类型', dataIndex: 'resource_type', width: 160 },
  {
    title: '资源 ID',
    dataIndex: 'resource_id',
    width: 140,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '时间',
    dataIndex: 'created_at',
    width: 180,
    render: (v) => fmtTime(v),
  },
]

interface Filters {
  action?: string
  resource_type?: string
  resource_id?: string
  from?: string
  to?: string
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>({})

  const { items, loading, error, pagination } = usePagedList<
    AdminAuditLog,
    Filters
  >({
    queryKey: 'admin-audit-logs-list',
    filters,
    fetcher: listAuditLogs,
  })

  return (
    <ListPageShell<AdminAuditLog>
      title="审计日志"
      filters={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="动作,如 admin.model.updated"
            style={{ width: 240 }}
            onSearch={(v) => setFilters((f) => ({ ...f, action: v || undefined }))}
          />
          <Input.Search
            allowClear
            placeholder="资源类型"
            style={{ width: 180 }}
            onSearch={(v) =>
              setFilters((f) => ({ ...f, resource_type: v || undefined }))
            }
          />
          <RangePicker
            onChange={(v) =>
              setFilters((f) => ({
                ...f,
                from: (v?.[0] as Dayjs | undefined)?.format('YYYY-MM-DD'),
                to: (v?.[1] as Dayjs | undefined)?.format('YYYY-MM-DD'),
              }))
            }
            presets={[
              { label: '近 7 天', value: [dayjs().add(-7, 'd'), dayjs()] },
              { label: '近 30 天', value: [dayjs().add(-30, 'd'), dayjs()] },
            ]}
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
