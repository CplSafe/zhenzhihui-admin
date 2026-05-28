import { Card, Descriptions, Tag, Typography } from 'antd'
import { useAdminSession } from '@/hooks/useAdminSession'

// 概览页占位:展示当前会话信息,验证认证链路打通。
// 真实运营概览页待后端 /admin/overview 对接后替换。
export function OverviewPage() {
  const { data } = useAdminSession()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        运营概览
      </Typography.Title>
      <Card title="当前后台会话">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="DeepAuth 用户 ID">
            {data?.admin_user.deep_auth_user_id}
          </Descriptions.Item>
          <Descriptions.Item label="账号状态">
            <Tag color={data?.admin_user.status === 'active' ? 'green' : 'red'}>
              {data?.admin_user.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="角色">
            {data?.roles.map((r) => <Tag key={r.code}>{r.name}</Tag>)}
          </Descriptions.Item>
          <Descriptions.Item label="权限点">
            {data?.permissions.map((p) => (
              <Tag key={p} style={{ marginBottom: 4 }}>
                {p}
              </Tag>
            ))}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
