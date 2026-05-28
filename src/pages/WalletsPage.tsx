import { useState } from 'react'
import { Input, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Count, Mono } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { listWallets } from '@/api/queries'
import type { AdminWalletItem } from '@/types/domain'
import { fmtTime } from '@/utils/format'

// 钱包列表项是 { wallet, workspace } 嵌套结构(后端联了 workspace),
// 列用 dataIndex 数组路径取嵌套字段。
const columns: TableColumnsType<AdminWalletItem> = [
  {
    title: '钱包 ID',
    dataIndex: ['wallet', 'id'],
    width: 90,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: 'workspace',
    dataIndex: ['workspace', 'id'],
    width: 110,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '工作空间',
    dataIndex: ['workspace', 'name'],
    render: (v) => v || '-',
  },
  {
    title: '可用余额',
    dataIndex: ['wallet', 'balance'],
    width: 140,
    render: (v) => <Count value={v} />,
  },
  {
    title: '冻结',
    dataIndex: ['wallet', 'frozen'],
    width: 120,
    render: (v) => <Count value={v} />,
  },
  {
    title: '所有者 ID',
    dataIndex: ['workspace', 'owner_user_id'],
    width: 110,
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: '更新时间',
    dataIndex: ['wallet', 'updated_at'],
    width: 180,
    render: (v) => fmtTime(v),
  },
]

export function WalletsPage() {
  const [keyword, setKeyword] = useState('')

  const { items, loading, error, pagination } = usePagedList<
    AdminWalletItem,
    { keyword: string }
  >({
    queryKey: 'admin-wallets-list',
    filters: { keyword },
    fetcher: listWallets,
  })

  return (
    <ListPageShell<AdminWalletItem>
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
      rowKey={(r) => r.wallet.id}
      loading={loading}
      error={error}
      pagination={pagination}
    />
  )
}
