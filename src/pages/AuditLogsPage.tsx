import { useState } from 'react'
import { App, DatePicker, Input, Space, Switch } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/api/client'
import { useAdminSession } from '@/hooks/useAdminSession'
import { Permission, RoleCode } from '@/types/admin'
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
    render: (v, row) => (
      <Mono>{row.action === 'asset.video.download.issued' ? `用户 ${row.actor_local_user_id}` : v}</Mono>
    ),
  },
  { title: '动作', dataIndex: 'action', width: 220 },
  { title: '资源类型', dataIndex: 'resource_type', width: 160 },
  {
    title: '资源 ID / 追溯码',
    dataIndex: 'resource_id',
    width: 240,
    render: (v, row) => {
      const details = row.after_json as { asset_id?: number; workspace_id?: number } | undefined
      return (
        <Space orientation="vertical" size={0}>
          <Mono>{v}</Mono>
          {row.action === 'asset.video.download.issued' && details && (
            <span>素材 {details.asset_id} · 工作空间 {details.workspace_id}</span>
          )}
        </Space>
      )
    },
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

interface WatermarkSetting {
  enabled: boolean
  label: string
}

const watermarkPath = '/admin/settings/video-download-watermark'
const watermarkKey = ['admin', 'video-download-watermark'] as const

function VideoDownloadWatermark({ canWrite }: { canWrite: boolean }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const { data, isFetching, isError } = useQuery({
    queryKey: watermarkKey,
    queryFn: () => http.get<WatermarkSetting>(watermarkPath),
  })
  const save = useMutation({
    mutationFn: (enabled: boolean) => http.put<WatermarkSetting>(watermarkPath, { enabled }),
    onSuccess: (saved) => {
      client.setQueryData(watermarkKey, saved)
      void client.invalidateQueries({ queryKey: ['admin-audit-logs-list'] })
      message.success(saved.enabled ? '下载水印已开启' : '下载水印已关闭')
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: watermarkKey })
      message.error('下载水印设置失败')
    },
  })
  return (
    <Space>
      <span>视频下载水印{data && ` · ${data.label}`}</span>
      <Switch
        aria-label="视频下载水印"
        checked={data?.enabled ?? false}
        disabled={!data || !canWrite || isFetching || save.isPending}
        loading={isFetching || save.isPending}
        onChange={(enabled) => save.mutate(enabled)}
      />
      {isError && <span role="alert">水印设置读取失败</span>}
    </Space>
  )
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>({})
  const { data: session } = useAdminSession()
  const canReadWatermark = session?.roles.some((role) => role.code === RoleCode.SUPER_ADMIN && role.status === 'active')
    && session.permissions.includes(Permission.SETTINGS_READ)

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
          {session && canReadWatermark && (
            <VideoDownloadWatermark canWrite={session.permissions.includes(Permission.SETTINGS_WRITE)} />
          )}
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
          <Input.Search
            allowClear
            placeholder="资源 ID 或追溯码"
            onSearch={(v) => setFilters((f) => ({ ...f, resource_id: v.trim() || undefined }))}
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
