import { useMemo } from "react";
import { Layout, Menu, Dropdown, Avatar, Typography, theme } from "antd";
import { UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAdminSession } from "@/hooks/useAdminSession";
import { usePermission } from "@/hooks/usePermission";
import { redirectToLogin } from "@/api/client";
import { menuConfig, type MenuItemConfig } from "@/router/menuConfig";

const { Sider, Header, Content } = Layout;

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useAdminSession();
  const { has } = usePermission();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 同组路由共用入口，按菜单顺序进入当前用户有权限的第一个页面。
  const menuRoutes = useMemo(() => {
    const entries = new Map<string, MenuItemConfig>();
    for (const route of menuConfig) {
      const key = route.menuGroup ?? route.path;
      if ((!route.permission || has(route.permission)) && !entries.has(key)) entries.set(key, route);
    }
    return entries;
  }, [has]);

  // 选最长前缀匹配,避免 /billing 抢走 /billing/credit-ledgers 的高亮。
  const selectedRoute = menuConfig
    .filter((m) => location.pathname.startsWith(m.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const selectedKey = selectedRoute?.menuGroup ?? selectedRoute?.path ?? "";

  const roleNames = session?.roles.map((r) => r.name).join("、") || "后台用户";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="dark">
        <div
          style={{
            height: 56,
            margin: 16,
            color: "#fff",
            fontWeight: 300,
            fontSize: 20,
            letterSpacing: "-0.4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          帧智汇
          <span style={{ color: "#665efd", fontWeight: 400 }}>后台</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={Array.from(menuRoutes, ([key, route]) => ({ key, icon: route.icon, label: route.label }))}
          onClick={({ key }) => {
            const route = menuRoutes.get(key);
            if (route) navigate(route.path);
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Dropdown
            menu={{
              items: [
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: "切换账号",
                  onClick: redirectToLogin,
                },
              ],
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                gap: 8,
              }}
            >
              <Avatar icon={<UserOutlined />} />
              <div style={{ lineHeight: 1.2 }}>
                <Typography.Text strong>
                  {session?.admin_user.deep_auth_user_id ?? "未知"}
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
              minHeight: "100%",
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
