import { useState } from 'react'
import { Input, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Mono } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listUsers } from '@/api/queries'
import type { User } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const columns: TableColumnsType<User> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  { title: '昵称', dataIndex: 'nickname', render: (v) => v || '-' },
  { title: '手机号', dataIndex: 'mobile', render: (v) => <Mono>{v}</Mono> },
  { title: '邮箱', dataIndex: 'email', render: (v) => v || '-' },
  {
    title: 'DeepAuth ID',
    dataIndex: 'deepauth_user_id',
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '注册时间',
    dataIndex: 'created_at',
    width: 180,
    render: (v) => fmtTime(v),
  },
]

export function UsersPage() {
  const [keyword, setKeyword] = useState('')

  const { items, loading, error, pagination } = usePagedList<
    User,
    { keyword: string }
  >({
    queryKey: 'admin-users-list',
    filters: { keyword },
    fetcher: listUsers,
  })

  return (
    <ListPageShell<User>
      title="用户管理"
      filters={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="手机号 / 邮箱 / 昵称 / DeepAuth ID"
            style={{ width: 320 }}
            onSearch={setKeyword}
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
