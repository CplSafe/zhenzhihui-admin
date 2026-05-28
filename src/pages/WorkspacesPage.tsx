import { useState } from 'react'
import { Input, Select, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listWorkspaces } from '@/api/queries'
import type { Workspace } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const TYPE_LABEL: Record<string, string> = {
  personal: '个人',
  team: '团队',
  enterprise: '企业',
}

const columns: TableColumnsType<Workspace> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  { title: '名称', dataIndex: 'name' },
  {
    title: '类型',
    dataIndex: 'type',
    width: 100,
    render: (v) => TYPE_LABEL[v] ?? v,
  },
  {
    title: '所有者 ID',
    dataIndex: 'owner_user_id',
    width: 120,
    render: (v) => <Mono>{v}</Mono>,
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

interface Filters {
  keyword: string
  type?: string
  status?: string
}

export function WorkspacesPage() {
  const [filters, setFilters] = useState<Filters>({ keyword: '' })

  const { items, loading, error, pagination } = usePagedList<Workspace, Filters>(
    {
      queryKey: 'admin-workspaces-list',
      filters,
      fetcher: listWorkspaces,
    },
  )

  return (
    <ListPageShell<Workspace>
      title="工作空间"
      filters={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="名称模糊搜索"
            style={{ width: 240 }}
            onSearch={(v) => setFilters((f) => ({ ...f, keyword: v }))}
          />
          <Select
            allowClear
            placeholder="类型"
            style={{ width: 140 }}
            options={[
              { value: 'personal', label: '个人' },
              { value: 'team', label: '团队' },
              { value: 'enterprise', label: '企业' },
            ]}
            onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 140 }}
            options={[
              { value: 'enabled', label: '启用' },
              { value: 'disabled', label: '禁用' },
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
