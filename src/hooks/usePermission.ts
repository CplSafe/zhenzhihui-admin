import { useMemo } from 'react'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { PermissionCode } from '@/types/admin'

type Code = PermissionCode | string

// super_admin 在后端已被塞入全部权限点,所以只需查 permissions 切片是否包含目标 code。
export function usePermission() {
  const { data } = useAdminSession()

  return useMemo(() => {
    const permissions = new Set(data?.permissions ?? [])
    return {
      permissions,
      has: (code: Code) => permissions.has(code),
      hasAny: (codes: Code[]) => codes.some((c) => permissions.has(c)),
      hasAll: (codes: Code[]) => codes.every((c) => permissions.has(c)),
    }
  }, [data?.permissions])
}
