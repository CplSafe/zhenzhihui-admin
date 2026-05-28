import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  RobotOutlined,
  PictureOutlined,
  AccountBookOutlined,
  CrownOutlined,
  ApiOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { Permission, type PermissionCode } from "@/types/admin";

// 菜单 / 路由元数据。新增页面时在这里加一项,侧边栏与权限过滤会自动生效。
export interface MenuItemConfig {
  key: string;
  path: string;
  label: string;
  icon?: ReactNode;
  permission?: PermissionCode;
}

const entries: ReadonlyArray<Omit<MenuItemConfig, "path">> = [
  { key: "overview", label: "运营概览", icon: <DashboardOutlined />, permission: Permission.OVERVIEW_READ },
  { key: "users", label: "用户管理", icon: <UserOutlined />, permission: Permission.USERS_READ },
  { key: "workspaces", label: "工作空间", icon: <TeamOutlined />, permission: Permission.WORKSPACES_READ },
  { key: "ai-tasks", label: "AI 任务", icon: <RobotOutlined />, permission: Permission.TASKS_READ },
  { key: "assets", label: "素材管理", icon: <PictureOutlined />, permission: Permission.ASSETS_READ },
  { key: "billing", label: "财务流水", icon: <AccountBookOutlined />, permission: Permission.BILLING_READ },
  { key: "subscriptions", label: "订阅管理", icon: <CrownOutlined />, permission: Permission.SUBSCRIPTIONS_READ },
  { key: "models", label: "模型配置", icon: <ApiOutlined />, permission: Permission.MODELS_READ },
  { key: "admin-users", label: "后台用户", icon: <SafetyCertificateOutlined />, permission: Permission.ADMIN_USERS_READ },
  { key: "audit-logs", label: "审计日志", icon: <FileSearchOutlined />, permission: Permission.AUDIT_READ },
];

export const menuConfig: MenuItemConfig[] = entries.map((e) => ({ ...e, path: `/${e.key}` }));
