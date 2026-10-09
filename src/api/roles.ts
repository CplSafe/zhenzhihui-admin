import { http } from '@/api/client'
import type { AdminRole } from '@/types/admin'
export interface RoleView extends AdminRole { permissions: string[]; protected: boolean; customized: boolean }
export interface PermissionDef { code: string; name: string; description: string }
export interface RoleInput { code: string; name: string; description?: string; status: 'active' | 'disabled'; permissions: string[] }
export const listRoles = () => http.get<RoleView[]>('/admin/roles')
export const listPermissions = () => http.get<PermissionDef[]>('/admin/permissions')
export const saveRole = (id: number | null, input: RoleInput) => id === null
  ? http.post<RoleView>('/admin/roles', input)
  : http.put<RoleView>(`/admin/roles/${id}`, input)
