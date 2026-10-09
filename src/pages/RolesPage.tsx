import { useState } from 'react'
import { Alert, App, Button, Card, Checkbox, Drawer, Form, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPermissions, listRoles, saveRole, type RoleInput, type RoleView } from '@/api/roles'
import { Can } from '@/components/Can'
import { Permission } from '@/types/admin'
import { ADMIN_SESSION_KEY } from '@/hooks/useAdminSession'
import { permissionGroups, superOnlyPermissions } from '@/utils/rolePermissions'

export function RolesPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: listRoles })
  const permissions = useQuery({ queryKey: ['admin-permissions'], queryFn: listPermissions })
  const [editing, setEditing] = useState<RoleView | 'new' | null>(null)
  const [form] = Form.useForm<RoleInput>()
  const mutation = useMutation({
    mutationFn: (input: RoleInput) => saveRole(editing === 'new' || editing === null ? null : editing.id, input),
    onSuccess: () => {
      message.success('角色权限已保存，将在下一次接口请求生效')
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['admin-roles'] })
      void qc.invalidateQueries({ queryKey: ['admin-admin-users-list'] })
      void qc.invalidateQueries({ queryKey: ADMIN_SESSION_KEY })
    },
    onError: (err: Error) => message.error(err.message),
  })
  const open = (role: RoleView | 'new') => {
    form.resetFields()
    form.setFieldsValue(role === 'new' ? { code: '', name: '', status: 'active', permissions: [] } : {
      code: role.code, name: role.name, description: role.description, status: role.status as 'active' | 'disabled', permissions: role.permissions,
    })
    setEditing(role)
  }
  const selected = Form.useWatch('permissions', form) ?? []
  const groups = permissionGroups(permissions.data ?? [])
  return <Space orientation="vertical" size={16} style={{ width: '100%' }}>
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>角色与权限</Typography.Title>
      <Space><Button onClick={() => { void roles.refetch(); void permissions.refetch() }}>刷新</Button>
        <Can permission={Permission.ROLES_WRITE}><Button type="primary" onClick={() => open('new')}>创建角色</Button></Can>
      </Space>
    </Space>
    <Alert type="info" showIcon title="按角色配置菜单查看与操作权限" description="账号可分配多个角色，权限取并集；不限制数据范围。授权管理仅由超级管理员执行，其他角色可配置业务菜单及操作权限。" />
    {(roles.error || permissions.error) && <Alert type="error" showIcon title="加载失败" description={(roles.error || permissions.error)?.message} />}
    <Table<RoleView> rowKey="id" loading={roles.isLoading} dataSource={roles.data ?? []} pagination={{ pageSize: 20 }} columns={[
      { title: '角色名称', dataIndex: 'name', render: (name, r) => <Space>{name}{r.protected && <Tag color="gold">受保护</Tag>}</Space> },
      { title: '标识', dataIndex: 'code' },
      { title: '说明', dataIndex: 'description' },
      { title: '权限项', render: (_, r) => `${r.permissions.length} 项` },
      { title: '状态', dataIndex: 'status', render: s => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '启用' : '禁用'}</Tag> },
      { title: '操作', render: (_, r) => r.protected ? <Typography.Text type="secondary">全部权限，系统保留</Typography.Text> : <Can permission={Permission.ROLES_WRITE} fallback={<span>只读</span>}><Button type="link" onClick={() => open(r)}>配置权限</Button></Can> },
    ]} />
    <Drawer forceRender title={editing === 'new' ? '创建角色' : `配置角色 · ${editing?.name ?? ''}`} open={editing !== null} onClose={() => setEditing(null)} size={720} extra={<Button type="primary" loading={mutation.isPending} disabled={permissions.isPending || !!permissions.error} onClick={() => form.submit()}>保存配置</Button>}>
      <Form form={form} layout="vertical" onFinish={v => mutation.mutate(v)}>
        <Form.Item name="name" label="角色名称" rules={[{ required: true, whitespace: true, max: 64 }]}><Input maxLength={64} placeholder="例如：任务排查员" /></Form.Item>
        <Form.Item name="code" label="角色标识" extra="创建后不可修改；小写字母开头，可包含数字和下划线。" rules={[{ required: true, pattern: /^[a-z][a-z0-9_]{1,63}$/, message: '请输入 2–64 位小写角色标识' }]}><Input disabled={editing !== 'new'} placeholder="task_observer" /></Form.Item>
        <Form.Item name="description" label="说明"><Input.TextArea rows={2} maxLength={255} /></Form.Item>
        <Form.Item name="status" label="状态"><Select options={[{ value: 'active', label: '启用' }, { value: 'disabled', label: '禁用（立即停止该角色授权）' }]} /></Form.Item>
        <Form.Item name="permissions" hidden><Select mode="multiple" /></Form.Item>
        <Typography.Title level={5}>菜单与操作权限</Typography.Title>
        <Typography.Paragraph type="secondary">“查看”控制菜单及读取接口；“操作”控制对应功能的修改按钮和写入接口。多个页面共用同一权限时会一并生效。</Typography.Paragraph>
        <Space style={{marginBottom:12}}><Button onClick={() => form.setFieldValue('permissions', (permissions.data ?? []).filter(p => p.code.endsWith('.read') || p.code === Permission.LOGS_LIVE).map(p => p.code))}>全部设为只读</Button><Button onClick={() => form.setFieldValue('permissions', [])}>清空权限</Button></Space>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {groups.map(group => <Card size="small" key={group.key} title={group.label}>
            <Checkbox.Group style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }} value={selected.filter((p: string) => group.permissions.some(x => x.code === p))}
              onChange={values => form.setFieldValue('permissions', [...selected.filter((p: string) => !group.permissions.some(x => x.code === p)), ...values])}
              options={group.permissions.map(p => ({ value: p.code, label: p.name, disabled: superOnlyPermissions.has(p.code) || (editing !== null && editing !== 'new' && editing.code === 'readonly_admin' && !p.code.endsWith('.read') && p.code !== Permission.LOGS_LIVE) }))} />
          </Card>)}
        </Space>
      </Form>
    </Drawer>
  </Space>
}
