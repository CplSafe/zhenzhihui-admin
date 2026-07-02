import { useEffect, useState } from 'react'
import { Button, Drawer, Input, Select, Space, Table, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { ListPageShell } from '@/components/ListPageShell'
import { Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import {
  listWorkspaceAuditLogs,
  listWorkspaceMemberStatistics,
  listWorkspaces,
} from '@/api/queries'
import type {
  Workspace,
  WorkspaceAuditLog,
  WorkspaceMemberStat,
} from '@/types/domain'
import { fmtTime } from '@/utils/format'

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

const memberStatColumns: TableColumnsType<WorkspaceMemberStat> = [
  { title: '用户 ID', dataIndex: 'user_id', width: 100, render: (v) => <Mono>{v}</Mono> },
  { title: '昵称', dataIndex: 'nickname', render: (v) => v || '—' },
  { title: '角色', dataIndex: 'role', width: 90, render: (v) => ROLE_LABEL[v] ?? v },
  { title: '本月消耗', dataIndex: 'month_credits', width: 100, render: (v) => <Mono>{v}</Mono> },
  { title: '累计消耗', dataIndex: 'total_credits', width: 100, render: (v) => <Mono>{v}</Mono> },
  { title: '本月作品', dataIndex: 'month_works', width: 100, render: (v) => <Mono>{v}</Mono> },
  { title: '累计作品', dataIndex: 'total_works', width: 100, render: (v) => <Mono>{v}</Mono> },
]

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

export function WorkspacesPage() {
  const [filters, setFilters] = useState<Filters>({ keyword: '' })
  const [statWs, setStatWs] = useState<Workspace | null>(null)
  const [stats, setStats] = useState<WorkspaceMemberStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [auditWs, setAuditWs] = useState<Workspace | null>(null)
  const [audits, setAudits] = useState<WorkspaceAuditLog[]>([])
  const [auditsLoading, setAuditsLoading] = useState(false)

  useEffect(() => {
    if (!statWs) return
    let alive = true
    setStatsLoading(true)
    listWorkspaceMemberStatistics(statWs.id)
      .then((rows) => {
        if (alive) setStats(rows ?? [])
      })
      .catch(() => {
        if (alive) {
          setStats([])
          message.error('加载成员统计失败')
        }
      })
      .finally(() => {
        if (alive) setStatsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [statWs])

  useEffect(() => {
    if (!auditWs) return
    let alive = true
    setAuditsLoading(true)
    listWorkspaceAuditLogs(auditWs.id, { limit: 100 })
      .then((page) => {
        if (alive) setAudits(page.items ?? [])
      })
      .catch(() => {
        if (alive) {
          setAudits([])
          message.error('加载审计日志失败')
        }
      })
      .finally(() => {
        if (alive) setAuditsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [auditWs])

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
      width: 180,
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => setStatWs(row)}>
            成员统计
          </Button>
          <Button type="link" size="small" onClick={() => setAuditWs(row)}>
            审计日志
          </Button>
        </Space>
      ),
    },
  ]

  const { items, loading, error, pagination } = usePagedList<Workspace, Filters>(
    {
      queryKey: 'admin-workspaces-list',
      filters,
      fetcher: listWorkspaces,
    },
  )

  return (
    <>
      <ListPageShell<Workspace>
        title="工作空间"
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
      <Drawer
        title={statWs ? `成员统计 · ${statWs.name}` : '成员统计'}
        width={820}
        open={!!statWs}
        onClose={() => setStatWs(null)}
        destroyOnClose
      >
        <Table<WorkspaceMemberStat>
          columns={memberStatColumns}
          dataSource={stats}
          rowKey="user_id"
          loading={statsLoading}
          size="small"
          pagination={false}
        />
      </Drawer>
      <Drawer
        title={auditWs ? `审计日志 · ${auditWs.name}` : '审计日志'}
        width={720}
        open={!!auditWs}
        onClose={() => setAuditWs(null)}
        destroyOnClose
      >
        <Table<WorkspaceAuditLog>
          columns={auditColumns}
          dataSource={audits}
          rowKey="id"
          loading={auditsLoading}
          size="small"
          pagination={false}
        />
      </Drawer>
    </>
  )
}
