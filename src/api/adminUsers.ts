import { http } from "@/api/client";
import { listGet } from "@/api/queries";
import type { AdminUserView } from "@/types/domain";

export interface AdminUserListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export const listAdminUsers = listGet<AdminUserView, AdminUserListParams>(
  "/admin/admin-users",
);

export const getAdminUser = (id: number) =>
  http.get<AdminUserView>(`/admin/admin-users/${id}`);

export interface CreateAdminUserBody {
  deepauth_user_id: string;
  roles: string[];
  remark?: string;
}
export const createAdminUser = (body: CreateAdminUserBody) =>
  http.post<AdminUserView>("/admin/admin-users", body);

export interface UpdateAdminUserBody {
  roles?: string[];
  remark?: string;
}
export const updateAdminUser = (id: number, body: UpdateAdminUserBody) =>
  http.patch<AdminUserView>(`/admin/admin-users/${id}`, body);

export const disableAdminUser = (id: number) =>
  http.post<AdminUserView>(`/admin/admin-users/${id}/disable`);

export const enableAdminUser = (id: number) =>
  http.post<AdminUserView>(`/admin/admin-users/${id}/enable`);
