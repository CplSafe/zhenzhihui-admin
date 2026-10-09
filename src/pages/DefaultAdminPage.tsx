import { Navigate } from 'react-router-dom'
import { usePermission } from '@/hooks/usePermission'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { menuConfig } from '@/router/menuConfig'

// Custom roles may lack overview access. Land on their first permitted menu.
export function DefaultAdminPage() {
  const { has } = usePermission()
  const first = menuConfig.find(item => !item.permission || has(item.permission))
  return first ? <Navigate to={first.path} replace /> : <ForbiddenPage />
}
