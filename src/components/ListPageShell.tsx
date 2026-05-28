import type { ReactNode } from 'react'
import { Alert, Card, Space, Table, Typography } from 'antd'
import type { TableColumnsType, TablePaginationConfig } from 'antd'
import type { ApiError } from '@/types/api'

interface ListPageShellProps<T> {
  title: string
  // 筛选栏(输入框/下拉/日期等),由各页面自行组合。
  filters?: ReactNode
  columns: TableColumnsType<T>
  dataSource: T[]
  rowKey: keyof T | ((r: T) => string | number)
  loading: boolean
  error?: ApiError | null
  pagination: TablePaginationConfig
}

// 列表页统一外壳:标题 + 筛选区 + 表格。Stripe 风格:hairline 表格、冷白表头、紧凑分页。
export function ListPageShell<T extends object>({
  title,
  filters,
  columns,
  dataSource,
  rowKey,
  loading,
  error,
  pagination,
}: ListPageShellProps<T>) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
        {title}
      </Typography.Title>

      {error && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={error.message}
        />
      )}

      {filters && (
        <Card size="small" styles={{ body: { padding: 16 } }}>
          {filters}
        </Card>
      )}

      <Table<T>
        size="middle"
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey as never}
        loading={loading}
        pagination={pagination}
        scroll={{ x: 'max-content' }}
      />
    </Space>
  )
}
