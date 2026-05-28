import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Can } from '@/components/Can'
import { Mono } from '@/components/cells'
import { listProviderConfigs, updateProviderConfig } from '@/api/providers'
import { Permission } from '@/types/admin'
import { ApiError } from '@/types/api'
import type { ProviderConfigView } from '@/types/domain'

interface FormValues {
  base_url: string
  timeout_seconds: number
  api_key?: string
}

export function ProvidersPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ProviderConfigView | null>(null)
  const [form] = Form.useForm<FormValues>()

  const { data, isFetching, error } = useQuery<ProviderConfigView[], ApiError>({
    queryKey: ['admin', 'providers'],
    queryFn: listProviderConfigs,
  })

  useEffect(() => {
    if (editing) {
      form.resetFields()
      form.setFieldsValue({
        base_url: editing.base_url,
        timeout_seconds: editing.timeout_seconds,
        api_key: '',
      })
    }
  }, [editing, form])

  const saveMut = useMutation({
    mutationFn: (v: FormValues) =>
      updateProviderConfig(editing!.provider, {
        base_url: v.base_url,
        timeout_seconds: v.timeout_seconds,
        // 留空 = 不改 key(不传 api_key 字段);填了才更新。
        ...(v.api_key && v.api_key.trim() ? { api_key: v.api_key.trim() } : {}),
      }),
    onSuccess: () => {
      message.success('已更新凭证')
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['admin', 'providers'] })
    },
    onError: (e: unknown) =>
      message.error(e instanceof ApiError ? e.message : '操作失败'),
  })

  const columns: TableColumnsType<ProviderConfigView> = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      width: 140,
      render: (v) => <Tag>{v}</Tag>,
    },
    { title: 'Base URL', dataIndex: 'base_url', render: (v) => <Mono>{v}</Mono> },
    {
      title: 'API Key',
      key: 'key',
      width: 220,
      render: (_, r) =>
        r.api_key_configured ? (
          <Space size={6}>
            <Tag color="green">已配置</Tag>
            <Mono>{r.api_key_masked}</Mono>
          </Space>
        ) : (
          <Tag color="red">未配置</Tag>
        ),
    },
    {
      title: '超时(秒)',
      dataIndex: 'timeout_seconds',
      width: 100,
      render: (v) => <span className="tnum">{v}</span>,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 90,
      render: (_, r) => (
        <Can permission={Permission.SETTINGS_WRITE} fallback={<span>-</span>}>
          <Button type="link" size="small" onClick={() => setEditing(r)}>
            编辑
          </Button>
        </Can>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
        模型 Provider 配置
      </Typography.Title>

      <Alert
        type="warning"
        showIcon
        message="密钥安全"
        description="API Key 加密存储,后台只显示掩码,绝不回显明文。修改 Key 需重新输入整串;留空则保留原 Key 不变。配错 base_url / key 会导致对应 provider 的生图任务全部失败。"
      />

      {error && <Alert type="error" showIcon message="加载失败" description={error.message} />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ProviderConfigView>
          rowKey="provider"
          columns={columns}
          dataSource={data ?? []}
          loading={isFetching}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={`编辑 ${editing?.provider ?? ''} 凭证`}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="https://api.openai.com" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="API Key"
            extra="留空 = 不修改;填写新值则覆盖。出于安全,此处不回显当前 Key。"
          >
            <Input.Password placeholder="留空则保留原 Key" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="timeout_seconds" label="超时(秒)" rules={[{ required: true }]}>
            <InputNumber min={1} max={600} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
