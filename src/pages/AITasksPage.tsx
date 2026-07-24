import { useState } from 'react'
import { Button, Drawer, Descriptions, Input, Select, Space, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ListPageShell } from '@/components/ListPageShell'
import { Count, Money, Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { getAITask, listAITasks } from '@/api/queries'
import type { ApiError } from '@/types/api'
import type { AITask } from '@/types/domain'
import { fmtTime } from '@/utils/format'

interface Filters {
  workspace_id?: number
  user_id?: number
  provider?: string
  status?: string
  provider_task_id?: string
}

function JsonBlock({ value }: { value?: unknown }) {
  if (value === undefined || value === null) return <span>-</span>
  return (
    <pre
      style={{
        margin: 0,
        maxHeight: 320,
        overflow: 'auto',
        background: 'var(--color-canvas-soft)',
        padding: 12,
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function AITasksPage() {
  const [filters, setFilters] = useState<Filters>({})
  const [activeId, setActiveId] = useState<number | null>(null)

  const { items, loading, error, pagination } = usePagedList<AITask, Filters>({
    queryKey: 'admin-ai-tasks-list',
    filters,
    fetcher: listAITasks,
  })

  const detail = useQuery<AITask, ApiError>({
    queryKey: ['admin', 'ai-task', activeId],
    queryFn: () => getAITask(activeId as number),
    enabled: activeId !== null,
  })

  const columns: TableColumnsType<AITask> = [
    { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
    {
      title: 'workspace',
      dataIndex: 'workspace_id',
      width: 110,
      render: (v) => <Mono>{v}</Mono>,
    },
    { title: 'provider', dataIndex: 'provider', width: 110 },
    { title: '操作码', dataIndex: 'operation_code', width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: '实扣积分',
      dataIndex: 'actual_cost',
      width: 110,
      render: (v) => <Count value={v} />,
    },
    {
      title: '积分收入',
      dataIndex: 'credit_revenue_cents',
      width: 110,
      render: (v) => <Money cents={v} />,
    },
    {
      title: '供应商成本',
      dataIndex: 'provider_cost_cents',
      width: 120,
      render: (v) => <Money cents={v} />,
    },
    {
      title: '毛利润',
      dataIndex: 'profit_cents',
      width: 110,
      render: (v: number | null | undefined) => (
        <span
          style={
            v !== undefined && v !== null && v < 0
              ? { color: '#cf1322' }
              : undefined
          }
        >
          <Money cents={v} />
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (v) => fmtTime(v),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setActiveId(r.id)}>
          详情
        </Button>
      ),
    },
  ]

  return (
    <>
      <ListPageShell<AITask>
        title="AI 任务"
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
            <Input
              allowClear
              placeholder="user ID"
              style={{ width: 120 }}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  user_id: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
            <Select
              allowClear
              placeholder="provider"
              style={{ width: 150 }}
              options={[
                { value: 'openai', label: 'openai' },
                { value: 'volcengine', label: 'volcengine' },
                { value: 'bailian', label: 'bailian' },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, provider: v }))}
            />
            <Input.Search
              allowClear
              placeholder="provider task id"
              style={{ width: 200 }}
              onSearch={(v) =>
                setFilters((f) => ({ ...f, provider_task_id: v || undefined }))
              }
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

      <Drawer
        title={`AI 任务详情 #${activeId ?? ''}`}
        width={680}
        open={activeId !== null}
        onClose={() => setActiveId(null)}
        loading={detail.isFetching}
      >
        {detail.data && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="状态">
              <StatusTag status={detail.data.status} />
            </Descriptions.Item>
            <Descriptions.Item label="provider">
              {detail.data.provider}
            </Descriptions.Item>
            <Descriptions.Item label="provider task id">
              <Mono>{detail.data.provider_task_id}</Mono>
            </Descriptions.Item>
            <Descriptions.Item label="操作码">
              {detail.data.operation_code}
            </Descriptions.Item>
            <Descriptions.Item label="预估 / 实际">
              <Count value={detail.data.estimated_cost} /> /{' '}
              <Count value={detail.data.actual_cost} />
            </Descriptions.Item>
            <Descriptions.Item label="上游用量">
              <Count value={detail.data.usage_total_tokens} /> token
              {detail.data.has_input_video ? ' · 含输入视频' : ''}
              {(detail.data.usage_input_tokens != null ||
                detail.data.usage_output_tokens != null) && (
                <Typography.Text type="secondary">
                  {' '}
                  （输入 <Count value={detail.data.usage_input_tokens} /> / 缓存{' '}
                  <Count value={detail.data.usage_cached_tokens} /> / 输出{' '}
                  <Count value={detail.data.usage_output_tokens} />）
                </Typography.Text>
              )}
              {detail.data.generated_outputs != null &&
                ` · 成功输出 ${detail.data.generated_outputs} 张`}
            </Descriptions.Item>
            <Descriptions.Item label="积分收入 / 供应商成本 / 毛利润">
              <Money cents={detail.data.credit_revenue_cents} /> /{' '}
              <Money cents={detail.data.provider_cost_cents} /> /{' '}
              <Money cents={detail.data.profit_cents} />
            </Descriptions.Item>
            <Descriptions.Item label="错误信息">
              {detail.data.error_message || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Prompt">
              {detail.data.prompt || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="request_json">
              <JsonBlock value={detail.data.request_json} />
            </Descriptions.Item>
            <Descriptions.Item label="result_json">
              <JsonBlock value={detail.data.result_json} />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
