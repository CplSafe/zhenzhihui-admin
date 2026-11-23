import { useState } from 'react'
import { Alert, Button, Descriptions, Drawer, Input, Select, Skeleton, Space, Table, Tabs } from 'antd'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ListPageShell } from '@/components/ListPageShell'
import { Can } from '@/components/Can'
import { Permission } from '@/types/admin'
import { CanvasUsagePanel } from '@/components/CanvasUsagePanel'
import { UsageSummaryPanel } from '@/components/UsageSummaryPanel'
import { Credits, Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { usePermission } from '@/hooks/usePermission'
import { getWorkspace, listWorkspaceAuditLogs, listWorkspaceMemberStatistics, listWorkspaces } from '@/api/queries'
import type { ApiError } from '@/types/api'
import type { Workspace, WorkspaceAuditLog, WorkspaceMemberStat } from '@/types/domain'
import { readRouteId } from '@/router/routeId'
import { fmtTime, formatCreditsAsCny } from '@/utils/format'

const TYPE_LABEL: Record<string, string> = {
  personal: '个人',
  team: '团队',
  enterprise: '企业',
}

const ROLE_LABEL: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
}

// 审计动作 → 中文标签(对齐后端 domain.AuditAction* 枚举)。
const ACTION_LABEL: Record<string, string> = {
  'invitation.created': '创建邀请',
  'invitation.revoked': '撤销邀请',
  'invitation.redeemed': '接受邀请',
  'member.role_changed': '变更角色',
  'member.removed': '移除成员',
  'member.left': '成员退出',
  'workspace.ownership_transferred': '转让所有权',
  'workspace.disbanded': '解散空间',
}

const auditColumns: TableColumnsType<WorkspaceAuditLog> = [
  { title: '时间', dataIndex: 'created_at', width: 170, render: (v) => fmtTime(v) },
  { title: '动作', dataIndex: 'action', width: 120, render: (v) => ACTION_LABEL[v] ?? v },
  { title: '操作人', dataIndex: 'actor_user_id', width: 100, render: (v) => <Mono>{v}</Mono> },
  {
    title: '目标用户',
    dataIndex: 'target_user_id',
    width: 100,
    render: (v) => (v ? <Mono>{v}</Mono> : '—'),
  },
]

interface Filters {
  keyword: string
  type?: string
  status?: string
}

type WorkspaceView = 'usage' | 'members' | 'audit'

function userInWorkspaceUrl(userId: number, workspaceId: number) {
  return `/users?workspace_id=${workspaceId}&user_id=${userId}`
}

export function WorkspacesPage() {
  const [filters, setFilters] = useState<Filters>({ keyword: '' })
  const [searchParams, setSearchParams] = useSearchParams()
  const workspaceId = readRouteId(searchParams.get('workspace_id'))
  const selectedView = searchParams.get('view')
  const view = selectedView === 'members' || selectedView === 'audit' ? selectedView : 'usage'

  function selectWorkspace(id: number | null, view: WorkspaceView = 'usage') {
    const next = new URLSearchParams(searchParams)
    if (id === null) next.delete('workspace_id')
    else next.set('workspace_id', String(id))
    if (view === 'usage') next.delete('view')
    else next.set('view', view)
    setSearchParams(next, { replace: id === null || id === workspaceId })
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
      width: 120,
      render: (v) => <StatusTag status={v} />,
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
      width: 260,
      render: (_, row) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => selectWorkspace(row.id)}>
            使用统计
          </Button>
          <Button type="link" size="small" onClick={() => selectWorkspace(row.id, 'members')}>
            成员统计
          </Button>
          <Button type="link" size="small" onClick={() => selectWorkspace(row.id, 'audit')}>
            审计日志
          </Button>
        </Space>
      ),
    },
  ]

  const { items, loading, error, pagination } = usePagedList<Workspace, Filters>({
    queryKey: 'admin-workspaces-list',
    filters,
    fetcher: listWorkspaces,
  })

  return (
    <>
      <ListPageShell<Workspace>
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
              style={{ width: 160 }}
              options={[
                { value: 'enabled', label: '启用' },
                { value: 'disabled', label: '禁用' },
                { value: 'activation_pending', label: '待激活' },
                { value: 'disbanded', label: '已解散' },
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
      {workspaceId !== null && (
        <WorkspaceDetailDrawer
          key={workspaceId}
          workspaceId={workspaceId}
          view={view}
          onChangeView={(nextView) => selectWorkspace(workspaceId, nextView)}
          onClose={() => selectWorkspace(null)}
        />
      )}
    </>
  )
}

function WorkspaceDetailDrawer({
  workspaceId,
  view,
  onChangeView,
  onClose,
}: {
  workspaceId: number
  view: WorkspaceView
  onChangeView: (view: WorkspaceView) => void
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: ['admin', 'workspace-detail', workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    retry: false,
  })
  const detail = query.data
  const ownerLabel = detail && (detail.owner?.nickname
    ? `${detail.owner.nickname} · #${detail.workspace.owner_user_id}`
    : `#${detail.workspace.owner_user_id}`)

  return (
    <Drawer
      title={detail ? `${detail.workspace.name} · 空间 #${workspaceId}` : `空间 #${workspaceId}`}
      size={820}
      open
      onClose={onClose}
      extra={detail && (
        <Can permission={Permission.USERS_READ}>
          <Link to={`/users?workspace_id=${workspaceId}`}>查看空间用户</Link>
        </Can>
      )}
    >
      {query.isPending && <Skeleton active />}
      {query.error && (
        <Alert
          type="error"
          showIcon
          title="加载空间详情失败"
          description={query.error.message}
          action={<Button size="small" onClick={() => void query.refetch()}>重试</Button>}
        />
      )}
      {detail && (
        <>
          <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="类型">{TYPE_LABEL[detail.workspace.type] ?? detail.workspace.type}</Descriptions.Item>
            <Descriptions.Item label="状态"><StatusTag status={detail.workspace.status} /></Descriptions.Item>
            <Descriptions.Item label="所有者">
              <Can permission={Permission.USERS_READ} fallback={ownerLabel}>
                <Link to={userInWorkspaceUrl(detail.workspace.owner_user_id, workspaceId)}>{ownerLabel}</Link>
              </Can>
            </Descriptions.Item>
            <Descriptions.Item label="有效成员">{detail.member_count}</Descriptions.Item>
            {detail.wallet && (
              <Descriptions.Item label="冻结积分"><Credits value={detail.wallet.frozen} showEquivalent /></Descriptions.Item>
            )}
            <Descriptions.Item label="人民币折算">1 积分 = {formatCreditsAsCny(1)}</Descriptions.Item>
          </Descriptions>
          <Tabs
            activeKey={view}
            onChange={(key) => {
              if (key === 'usage' || key === 'members' || key === 'audit') onChangeView(key)
            }}
            destroyOnHidden
            items={[
              {
                key: 'usage',
                label: '使用统计',
                children: (
                  <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                    <UsageSummaryPanel scope="workspace" id={workspaceId} />
                    <Can permission={Permission.BILLING_READ}>
                      <CanvasUsagePanel workspaceId={workspaceId} />
                    </Can>
                  </Space>
                ),
              },
              { key: 'members', label: '成员统计', children: <WorkspaceMemberStatistics workspaceId={workspaceId} /> },
              { key: 'audit', label: '审计日志', children: <WorkspaceAuditLogs workspaceId={workspaceId} /> },
            ]}
          />
        </>
      )}
    </Drawer>
  )
}

function WorkspaceMemberStatistics({ workspaceId }: { workspaceId: number }) {
  const { has } = usePermission()
  const canViewUsers = has(Permission.USERS_READ)
  const query = useQuery<WorkspaceMemberStat[], ApiError>({
    queryKey: ['admin', 'workspace-member-statistics', workspaceId],
    queryFn: () => listWorkspaceMemberStatistics(workspaceId),
    retry: false,
  })
  const columns: TableColumnsType<WorkspaceMemberStat> = [
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      width: 90,
      render: (userId: number) => canViewUsers
        ? <Link to={userInWorkspaceUrl(userId, workspaceId)}><Mono>{userId}</Mono></Link>
        : <Mono>{userId}</Mono>,
    },
    { title: '昵称', dataIndex: 'nickname', render: (v) => v || '—' },
    { title: '角色', dataIndex: 'role', render: (v) => ROLE_LABEL[v] ?? v },
    { title: '成员状态', dataIndex: 'status', render: (v) => <StatusTag status={v} /> },
    { title: '本月消耗积分', dataIndex: 'month_credits', sorter: (a, b) => a.month_credits - b.month_credits, render: (v) => <Credits value={v} showEquivalent /> },
    { title: '累计消耗积分', dataIndex: 'total_credits', sorter: (a, b) => a.total_credits - b.total_credits, render: (v) => <Credits value={v} showEquivalent /> },
    { title: '本月作品', dataIndex: 'month_works', sorter: (a, b) => a.month_works - b.month_works, render: (v) => <Mono>{v}</Mono> },
    { title: '累计作品', dataIndex: 'total_works', sorter: (a, b) => a.total_works - b.total_works, render: (v) => <Mono>{v}</Mono> },
  ]

  if (query.error && !query.data) {
    return <Alert type="error" showIcon title="加载成员统计失败" description={query.error.message}
      action={<Button size="small" onClick={() => void query.refetch()}>重试</Button>} />
  }
  return (
    <Table<WorkspaceMemberStat>
      columns={columns}
      dataSource={query.data ?? []}
      rowKey="user_id"
      loading={query.isFetching}
      size="small"
      scroll={{ x: 'max-content' }}
      pagination={false}
    />
  )
}

function WorkspaceAuditLogs({ workspaceId }: { workspaceId: number }) {
  const query = useQuery({
    queryKey: ['admin', 'workspace-audit-logs', workspaceId],
    queryFn: () => listWorkspaceAuditLogs(workspaceId, { limit: 100 }),
    retry: false,
  })

  if (query.error && !query.data) {
    return <Alert type="error" showIcon title="加载审计日志失败" description={query.error.message}
      action={<Button size="small" onClick={() => void query.refetch()}>重试</Button>} />
  }
  return (
    <Table<WorkspaceAuditLog>
      columns={auditColumns}
      dataSource={query.data?.items ?? []}
      rowKey="id"
      loading={query.isFetching}
      size="small"
      scroll={{ x: 'max-content' }}
      pagination={false}
    />
  )
}
