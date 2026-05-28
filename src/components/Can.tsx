import type { ReactNode } from 'react'
import { usePermission } from '@/hooks/usePermission'
import type { PermissionCode } from '@/types/admin'

interface CanProps {
  // 需要的权限点;传数组时默认"任一满足"(mode='any')。
  permission: PermissionCode | string | Array<PermissionCode | string>
  mode?: 'any' | 'all'
  children: ReactNode
  // 无权限时的兜底内容,默认不渲染。
  fallback?: ReactNode
}

// 按钮级 / 区块级权限门控。无权限时渲染 fallback(默认 null)。
export function Can({ permission, mode = 'any', children, fallback = null }: CanProps) {
  const { has, hasAny, hasAll } = usePermission()

  const allowed = Array.isArray(permission)
    ? mode === 'all'
      ? hasAll(permission)
      : hasAny(permission)
    : has(permission)

  return <>{allowed ? children : fallback}</>
}
