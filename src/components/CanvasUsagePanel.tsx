import { useState } from 'react'
import { Alert, Button, Card, DatePicker, Space, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { listWorkspaceCanvasUsage } from '@/api/queries'
import type { CanvasMemberUsage, CanvasUsage } from '@/types/domain'
import { Credits, Mono } from './cells'

const PAGE_SIZE = 20
const memberColumns: TableColumnsType<CanvasMemberUsage> = [
  { title: '用户 ID', dataIndex: 'user_id', render: (id) => <Mono>{id}</Mono> },
  { title: '成员', dataIndex: 'display_name', render: (name) => name || '—' },
  { title: '消耗积分（含历史分摊）', dataIndex: 'used_credits', align: 'right', render: (v) => <Credits value={v} /> },
  { title: '其中历史分摊', dataIndex: 'historical_allocated_credits', align: 'right', render: (v) => <Credits value={v ?? 0} /> },
]

const canvasColumns: TableColumnsType<CanvasUsage> = [
  { title: '画布 ID', dataIndex: 'canvas_id', render: (id) => <Mono>{id}</Mono> },
  {
    title: '画布',
    dataIndex: 'title',
    render: (title, canvas) => (
      <Space wrap>
        {title || '未命名画布'}
        {canvas.deleted && <Tag>已删除</Tag>}
      </Space>
    ),
  },
  { title: '已结算积分', dataIndex: 'used_credits', align: 'right', render: (v) => <Credits value={v} /> },
]

export function CanvasUsagePanel({ workspaceId }: { workspaceId: number }) {
  const [page, setPage] = useState(1)
  const [month, setMonth] = useState('')
  const query = useQuery({
    queryKey: ['admin', 'canvas-usage', workspaceId, month, page],
    queryFn: () =>
      listWorkspaceCanvasUsage(workspaceId, { month, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    retry: false,
  })
  const data = query.data
  return (
    <Card
      title="无限画布用量"
      size="small"
      extra={
        <DatePicker
          picker="month"
          aria-label="画布统计月份"
          placeholder="全部月份"
          onChange={(value) => {
            setMonth(value?.format('YYYY-MM') ?? '')
            setPage(1)
          }}
        />
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert type="info" showIcon description="总额包含可核实归属的历史实际扣费、重试，不含冻结。缺少节点明细的历史费用按历史使用成员均分（含已离开成员），单独标注历史分摊，不代表个人实际操作金额。复制或引用素材不重复计费；无法核实画布归属的费用不重复计入各画布。" />
        {query.error && (
          <Alert
            type="error"
            showIcon
            title="画布用量加载失败"
            description={query.error.message}
            action={<Button onClick={() => void query.refetch()}>重试</Button>}
          />
        )}
        {data && (
          <div>
            {month || '累计'}已结算 <Credits value={data.total_used_credits} /> 积分
          </div>
        )}
        <Table<CanvasUsage>
          size="small"
          rowKey="canvas_id"
          columns={canvasColumns}
          dataSource={data?.items ?? []}
          loading={query.isFetching}
          expandable={{
            rowExpandable: (row) => row.members?.length > 0,
            expandedRowRender: (canvas) => (
              <Table<CanvasMemberUsage>
                size="small"
                rowKey="user_id"
                columns={memberColumns}
                dataSource={canvas.members}
                pagination={false}
              />
            ),
          }}
          pagination={{
            total: data?.total ?? 0,
            pageSize: PAGE_SIZE,
            current: page,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: (total) => `共 ${total} 张画布`,
          }}
          locale={{ emptyText: query.isError ? '数据暂不可用' : '暂无画布记录' }}
        />
      </Space>
    </Card>
  )
}
