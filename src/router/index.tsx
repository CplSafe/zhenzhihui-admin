import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { RequirePermission } from '@/components/RequirePermission'
import { MainLayout } from '@/layouts/MainLayout'
import { OverviewPage } from '@/pages/OverviewPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { menuConfig } from '@/router/menuConfig'

// 把菜单配置展开为受权限保护的子路由。
// overview 用真实占位页,其余先用通用占位页,待按 MD 规格逐个替换。
const childRoutes = menuConfig.map((m) => {
  const element =
    m.key === 'overview' ? <OverviewPage /> : <PlaceholderPage title={m.label} />
  return {
    path: m.path.replace(/^\//, ''),
    element: (
      <RequirePermission permission={m.permission}>{element}</RequirePermission>
    ),
  }
})

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      ...childRoutes,
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
])
