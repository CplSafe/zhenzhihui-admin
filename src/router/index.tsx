import { createBrowserRouter, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { RequirePermission } from "@/components/RequirePermission";
import { MainLayout } from "@/layouts/MainLayout";
import { OverviewPage } from "@/pages/OverviewPage";
import { UsersPage } from "@/pages/UsersPage";
import { WorkspacesPage } from "@/pages/WorkspacesPage";
import { AITasksPage } from "@/pages/AITasksPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { PaymentOrdersPage } from "@/pages/PaymentOrdersPage";
import { CreditLedgersPage } from "@/pages/CreditLedgersPage";
import { WalletsPage } from "@/pages/WalletsPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { BannersPage } from "@/pages/BannersPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { PlansPage } from "@/pages/PlansPage";
import { CreditPackagesPage } from "@/pages/CreditPackagesPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { LoginPage } from "@/pages/LoginPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { menuConfig } from "@/router/menuConfig";

// 各菜单 key 对应的页面组件。
const pageByKey: Record<string, ReactNode> = {
  overview: <OverviewPage />,
  users: <UsersPage />,
  workspaces: <WorkspacesPage />,
  "ai-tasks": <AITasksPage />,
  assets: <AssetsPage />,
  billing: <PaymentOrdersPage />,
  "credit-ledgers": <CreditLedgersPage />,
  wallets: <WalletsPage />,
  subscriptions: <SubscriptionsPage />,
  plans: <PlansPage />,
  "credit-packages": <CreditPackagesPage />,
  models: <ModelsPage />,
  banners: <BannersPage />,
  providers: <ProvidersPage />,
  "admin-users": <AdminUsersPage />,
  "audit-logs": <AuditLogsPage />,
};

// 路由直接由 menuConfig 派生:path 去掉前导 /,权限用 RequirePermission 包一层。
const childRoutes = menuConfig.map((m) => ({
  path: m.path.replace(/^\//, ""),
  element: (
    <RequirePermission permission={m.permission}>
      {pageByKey[m.key] ?? <PlaceholderPage title={m.label} />}
    </RequirePermission>
  ),
}));

export const router = createBrowserRouter([
  // 公开登录页:不套 AuthGuard,避免未登录时被 401 拦截循环。
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      ...childRoutes,
      { path: "*", element: <Navigate to="/overview" replace /> },
    ],
  },
]);
