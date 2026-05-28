import { useState } from 'react'
import { Input, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Count, Mono } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listWallets } from '@/api/queries'
import type { Wallet } from '@/types/domain'
import { fmtTime } from '@/utils/format'

const columns: TableColumnsType<Wallet> = [
  { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
  {
    title: 'workspace',
    dataIndex: 'workspace_id',
    width: 120,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '可用余额',
    dataIndex: 'balance',
    width: 140,
    render: (v) => <Count value={v} />,
  },
  {
    title: '冻结',
    dataIndex: 'frozen',
    width: 140,
    render: (v) => <Count value={v} />,
  },
  {
    title: '更新时间',
    dataIndex: 'updated_at',
    width: 180,
    render: (v) => fmtTime(v),
  },
]

export function WalletsPage() {
  const [keyword, setKeyword] = useState('')

  const { items, loading, error, pagination } = usePagedList<
    Wallet,
    { keyword: string }
  >({
    queryKey: 'admin-wallets-list',
    filters: { keyword },
    fetcher: listWallets,
  })

  return (
    <ListPageShell<Wallet>
      title="钱包"
      filters={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="按工作空间名称搜索"
            style={{ width: 280 }}
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
