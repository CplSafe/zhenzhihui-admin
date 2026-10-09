import { LogTerminal } from '@/components/LogTerminal'
import { useState } from 'react'
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { listOperationalLogs, type LogFilters, type LogKind, type OperationalLog } from '@/api/operationalLogs'
import { usePermission } from '@/hooks/usePermission'
import { Permission } from '@/types/admin'
import { fmtTime } from '@/utils/format'

export function OperationalLogsPage({ kind }: { kind: LogKind }) {
  const request = kind === 'request'
  const { has } = usePermission()
  const [filters, setFilters] = useState<LogFilters>({})
  const [page, setPage] = useState(1)
  const [live, setLive] = useState(false)
  const [selected, setSelected] = useState<OperationalLog | null>(null)
  const [form] = Form.useForm<LogFilters>()
  const authorizedLive = live && has(Permission.LOGS_LIVE)
  const query = useQuery({
    enabled: request,
    queryKey: ['operational-logs', kind, filters, page, authorizedLive],
    queryFn: () => listOperationalLogs(kind, { ...filters, limit: 50, offset: (page - 1) * 50, live: authorizedLive }),
    refetchInterval: q => authorizedLive && !q.state.error ? 2000 : false,
    retry: false,
  })
  return <Space orientation="vertical" size={16} style={{ width: '100%' }}>
    <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
      <div><Typography.Title level={4} style={{ margin: 0 }}>{request ? '请求日志' : '应用日志'}</Typography.Title>
        <Typography.Text type="secondary">保留最近 30 天 · {request ? (query.dataUpdatedAt ? `更新于 ${new Date(query.dataUpdatedAt).toLocaleTimeString()}` : '等待加载') : '按顺序增量追加，暂停后可继续读取'}</Typography.Text>
      </div>
      <Space>{request && has(Permission.LOGS_LIVE) && <><Switch aria-label="实时更新" checked={authorizedLive} onChange={v => { setLive(v); setPage(1) }} /><span>实时更新（2 秒）</span></>}
        {request && <Button loading={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>}</Space>
    </Space>
    <Alert type="info" showIcon title={request ? '记录进入后端的请求，包括未创建 AI 任务就失败的请求' : '查看后端应用输出的脱敏日志'}
      description={request ? '请求 ID 对应响应头 X-Request-ID。浏览器本地校验失败、网络未送达或网关直接拒绝的请求，不会出现在此处。未结束表示处理中或进程异常退出。' : '采集服务启动完成后的 Go 应用日志；不包含操作系统、Nginx 或其他容器日志。凭据及原始正文会被隐藏。'} />
    {query.error && <Alert type="error" showIcon title="日志加载失败，实时更新已暂停" description={query.error.message} action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
    <Card size="small"><Form form={form} layout="inline" onFinish={values => { setPage(1); setFilters(values) }} style={{ gap: 12 }}>
      {request ? <>
        <Form.Item name="request_id"><Input aria-label="请求 ID" placeholder="请求 ID" allowClear style={{ width: 240 }} /></Form.Item>
        <Form.Item name="route"><Input aria-label="接口路径" placeholder="接口路由，例如 /api/v1/ai/tasks" allowClear style={{ width: 290 }} /></Form.Item>
        <Form.Item name="user_id"><InputNumber aria-label="用户 ID" placeholder="用户 ID" min={1} precision={0} /></Form.Item>
        <Form.Item name="errors_only" valuePropName="checked"><Switch aria-label="仅失败请求" checkedChildren="仅失败" unCheckedChildren="全部结果" /></Form.Item>
      </> : <Form.Item name="level"><Select aria-label="日志级别" placeholder="全部级别" allowClear style={{ width: 140 }} options={['info', 'warn', 'error'].map(value => ({ value, label: value.toUpperCase() }))} /></Form.Item>}
      <DatePicker.RangePicker showTime onChange={v => { form.setFieldValue('from', v?.[0]?.toISOString()); form.setFieldValue('to', v?.[1]?.toISOString()) }} />
      <Form.Item name="from" hidden><Input /></Form.Item><Form.Item name="to" hidden><Input /></Form.Item>
      <Button type="primary" htmlType="submit">查询</Button>
    </Form></Card>
    {!request && <LogTerminal key={JSON.stringify(filters)} filters={filters} canLive={has(Permission.LOGS_LIVE)} onSelect={setSelected} />}
    {request && <Table<OperationalLog> rowKey="id" dataSource={query.error ? [] : query.data?.items ?? []} loading={query.isPending} scroll={{ x: 1150 }}
      pagination={{ current: page, pageSize: 50, total: query.data?.total ?? 0, showSizeChanger: false, disabled: authorizedLive, onChange: setPage, showTotal: total => `共 ${total} 条${authorizedLive ? ' · 实时展示最新 50 条，关闭实时更新可翻页' : ''}` }}
      columns={[
        { title: '时间', dataIndex: 'created_at', width: 180, render: fmtTime },
        { title: request ? '结果' : '级别', width: 110, render: (_, r) => <Tag color={r.level === 'error' ? 'red' : r.level === 'warn' ? 'orange' : 'green'}>{request ? r.completed ? r.status : '未结束' : r.level.toUpperCase()}</Tag> },
        ...(request ? [
          { title: '接口', key: 'route', render: (_: unknown, r: OperationalLog) => <Typography.Text code>{r.method} {r.route}</Typography.Text> },
          { title: '用户', dataIndex: 'user_id', width: 80, render: (v: number) => v || '—' },
          { title: '耗时', dataIndex: 'duration_ms', width: 100, render: (v: number, r: OperationalLog) => r.completed ? `${v} ms` : '—' },
        ] : []),
        { title: request ? '错误摘要' : '内容', dataIndex: 'message', ellipsis: true, render: (v: string) => v || '—' },
        { title: '操作', width: 85, render: (_, r) => <Button type="link" onClick={() => setSelected(r)}>详情</Button> },
      ]} />}
    <Drawer title="日志详情" open={selected !== null} onClose={() => setSelected(null)} size={640}>
      {selected && <><Descriptions column={1} bordered items={[
        { key: 'time', label: '时间', children: fmtTime(selected.created_at) },
        { key: 'id', label: '请求 ID', children: selected.request_id ? <Typography.Text copyable>{selected.request_id}</Typography.Text> : '—' },
        { key: 'route', label: '接口', children: selected.route ? `${selected.method} ${selected.route}` : '—' },
        { key: 'status', label: '状态', children: selected.completed ? selected.status || selected.level : '未结束' },
        { key: 'user', label: '用户 / 工作空间', children: `${selected.user_id || '—'} / ${selected.workspace_id || '—'}` },
        { key: 'task', label: '任务 / 模型 ID', children: `${selected.task_id || '—'} / ${selected.model_version_id || '—'}` },
        { key: 'code', label: '错误码', children: selected.error_code || '—' },
      ]} /><Typography.Paragraph style={{ marginTop: 20, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.message || '无错误信息'}</Typography.Paragraph></>}
    </Drawer>
  </Space>
}
