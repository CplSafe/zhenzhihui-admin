import { useMemo } from 'react'
import { Layout, Menu, Dropdown, Avatar, Typography, theme } from 'antd'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAdminSession } from '@/hooks/useAdminSession'
import { usePermission } from '@/hooks/usePermission'
import { redirectToLogin } from '@/api/client'
import { menuConfig } from '@/router/menuConfig'

const { Sider, Header, Content } = Layout

export function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = useAdminSession()
  const { has } = usePermission()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // 仅渲染当前用户有权限的菜单项。
  const menuItems = useMemo(
    () =>
      menuConfig
        .filter((m) => !m.permission || has(m.permission))
        .map((m) => ({ key: m.path, icon: m.icon, label: m.label })),
    [has],
  )

  const selectedKey =
    menuConfig.find((m) => location.pathname.startsWith(m.path))?.path ?? ''

  const roleNames = session?.roles.map((r) => r.name).join('、') || '后台用户'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="dark">
        <div
          style={{
            height: 56,
            margin: 16,
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          帧智绘 · 后台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '切换账号',
                  onClick: redirectToLogin,
                },
              ],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
              <Avatar icon={<UserOutlined />} />
              <div style={{ lineHeight: 1.2 }}>
                <Typography.Text strong>
                  {session?.admin_user.deep_auth_user_id ?? '未知'}
                </Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {roleNames}
                  </Typography.Text>
                </div>
              </div>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <div
            style={{
              padding: 24,
              minHeight: '100%',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
