import { http } from '@/api/client'
import type { AdminSession } from '@/types/admin'

// GET /api/v1/admin/session — 当前后台会话(身份/角色/权限)。
// 401 → 未登录(interceptor 已跳登录);403 → 非 admin / 已禁用。
export function fetchAdminSession(): Promise<AdminSession> {
  return http.get<AdminSession>('/admin/session')
}
