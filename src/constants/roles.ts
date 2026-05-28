import { RoleCode, type RoleCodeValue } from "@/types/admin";

// 角色选项,对应后端 internal/admin/permissions.go AllRoles()。
export const ROLE_OPTIONS = [
  { value: RoleCode.SUPER_ADMIN, label: "超级管理员", desc: "全部权限" },
  { value: RoleCode.OPS_ADMIN, label: "运营管理员", desc: "用户/空间/任务/素材" },
  { value: RoleCode.FINANCE_ADMIN, label: "财务管理员", desc: "钱包/订单/订阅" },
  { value: RoleCode.MODEL_ADMIN, label: "模型管理员", desc: "模型目录读写" },
  { value: RoleCode.SUPPORT_ADMIN, label: "客服管理员", desc: "用户/空间/任务" },
] as const;

const ROLE_LABEL = new Map<string, string>(
  ROLE_OPTIONS.map((o) => [o.value, o.label]),
);

export function roleLabel(code: RoleCodeValue | string): string {
  return ROLE_LABEL.get(code) ?? code;
}
