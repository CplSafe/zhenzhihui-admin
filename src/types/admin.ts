// admin 身份/角色/权限类型,对应后端 internal/admin 包。

export type AdminUserStatus = "active" | "disabled";

export interface AdminUser {
  id: number;
  deep_auth_user_id: string;
  local_user_id: number;
  status: AdminUserStatus;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminRole {
  id: number;
  code: string;
  name: string;
  description?: string;
  status?: string;
}

// GET /api/v1/admin/session 的 data 形状。
export interface AdminSession {
  admin_user: AdminUser;
  roles: AdminRole[];
  permissions: string[];
}

// 角色与权限 code 常量,对应 internal/admin/permissions.go。
export const RoleCode = {
  SUPER_ADMIN: "super_admin",
  OPS_ADMIN: "ops_admin",
  FINANCE_ADMIN: "finance_admin",
  MODEL_ADMIN: "model_admin",
  SUPPORT_ADMIN: "support_admin",
} as const;

export type RoleCodeValue = (typeof RoleCode)[keyof typeof RoleCode];

export const Permission = {
  OVERVIEW_READ: "admin.overview.read",
  USERS_READ: "admin.users.read",
  WORKSPACES_READ: "admin.workspaces.read",
  TASKS_READ: "admin.tasks.read",
  ASSETS_READ: "admin.assets.read",
  BILLING_READ: "admin.billing.read",
  SUBSCRIPTIONS_READ: "admin.subscriptions.read",
  MODELS_READ: "admin.models.read",
  MODELS_WRITE: "admin.models.write",
  ADMIN_USERS_READ: "admin.admin_users.read",
  ADMIN_USERS_WRITE: "admin.admin_users.write",
  AUDIT_READ: "admin.audit.read",
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];
