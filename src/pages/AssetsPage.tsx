import { useState } from 'react'
import { Input, Select, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listAssets } from '@/api/queries'
import type { Asset } from '@/types/domain'
import { fmtTime, humanBytes } from '@/utils/format'

interface Filters {
  workspace_id?: number
  user_id?: number
  type?: string
  status?: string
}

const columns: TableColumnsType<Asset> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  { title: '名称', dataIndex: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', width: 90 },
  { title: '来源', dataIndex: 'source', width: 100 },
  {
    title: 'workspace',
    dataIndex: 'workspace_id',
    width: 110,
    render: (v) => <Mono>{v}</Mono>,
  },
  { title: 'MIME', dataIndex: 'mime_type', width: 140, render: (v) => v || '-' },
  {
    title: '大小',
    dataIndex: 'size_bytes',
    width: 110,
    render: (v) => <span className="tnum">{humanBytes(v)}</span>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (v) => <StatusTag status={v} />,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    width: 180,
    render: (v) => fmtTime(v),
  },
]

export function AssetsPage() {
  const [filters, setFilters] = useState<Filters>({})

  const { items, loading, error, pagination } = usePagedList<Asset, Filters>({
    queryKey: 'admin-assets-list',
    filters,
    fetcher: listAssets,
  })

  return (
    <ListPageShell<Asset>
      title="素材管理"
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
            style={{ width: 130 }}
            options={[
              { value: 'image', label: '图片' },
              { value: 'video', label: '视频' },
              { value: 'audio', label: '音频' },
              { value: 'prompt', label: '提示词' },
            ]}
            onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 130 }}
            options={[
              { value: 'active', label: 'active' },
              { value: 'pending', label: 'pending' },
              { value: 'rejected', label: 'rejected' },
              { value: 'deleted', label: 'deleted' },
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
