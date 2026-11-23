import { Tabs, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { UsersPage } from "@/pages/UsersPage";
import { WorkspacesPage } from "@/pages/WorkspacesPage";
import { userManagementRoutes } from "@/router/menuConfig";

export function UserManagementPage({ activePath }: { activePath: typeof userManagementRoutes[number]["path"] }) {
  const navigate = useNavigate();
  const { has } = usePermission();

  return (
    <>
      <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
        用户管理
      </Typography.Title>
      <Tabs
        activeKey={activePath}
        onChange={(path) => navigate(path)}
        destroyOnHidden
        items={userManagementRoutes.filter((route) => has(route.permission)).map((route) => ({
          key: route.path,
          label: route.label,
          children: route.key === "users" ? <UsersPage /> : <WorkspacesPage />,
        }))}
      />
    </>
  );
}
