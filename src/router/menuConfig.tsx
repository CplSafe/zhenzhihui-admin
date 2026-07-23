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
  TagsOutlined,
  GiftOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { Permission, type PermissionCode } from "@/types/admin";

// 菜单 / 路由元数据。新增页面时在这里加一项,侧边栏与权限过滤会自动生效。
// path 显式声明:多数与 /${key} 一致,财务子页有独立子路径。
export interface MenuItemConfig {
  key: string;
  path: string;
  label: string;
  icon?: ReactNode;
  permission?: PermissionCode;
}

export const menuConfig: MenuItemConfig[] = [
  {
    key: "overview",
    path: "/overview",
    label: "运营概览",
    icon: <DashboardOutlined />,
    permission: Permission.OVERVIEW_READ,
  },
  {
    key: "users",
    path: "/users",
    label: "用户管理",
    icon: <UserOutlined />,
    permission: Permission.USERS_READ,
  },
  {
    key: "workspaces",
    path: "/workspaces",
    label: "工作空间",
    icon: <TeamOutlined />,
    permission: Permission.WORKSPACES_READ,
  },
  {
    key: "ai-tasks",
    path: "/ai-tasks",
    label: "AI 任务",
    icon: <RobotOutlined />,
    permission: Permission.TASKS_READ,
  },
  {
    key: "assets",
    path: "/assets",
    label: "素材管理",
    icon: <PictureOutlined />,
    permission: Permission.ASSETS_READ,
  },
  {
    key: "billing",
    path: "/billing",
    label: "支付订单",
    icon: <AccountBookOutlined />,
    permission: Permission.BILLING_READ,
  },
  {
    key: "credit-ledgers",
    path: "/billing/credit-ledgers",
    label: "积分流水",
    icon: <AccountBookOutlined />,
    permission: Permission.BILLING_READ,
  },
  {
    key: "wallets",
    path: "/billing/wallets",
    label: "钱包",
    icon: <AccountBookOutlined />,
    permission: Permission.BILLING_READ,
  },
  {
    key: "subscriptions",
    path: "/subscriptions",
    label: "订阅管理",
    icon: <CrownOutlined />,
    permission: Permission.SUBSCRIPTIONS_READ,
  },
  {
    key: "plans",
    path: "/plans",
    label: "套餐管理",
    icon: <TagsOutlined />,
    permission: Permission.PLANS_READ,
  },
  {
    key: "credit-packages",
    path: "/credit-packages",
    label: "积分包",
    icon: <GiftOutlined />,
    permission: Permission.CREDIT_PACKAGES_READ,
  },
  {
    key: "models",
    path: "/models",
    label: "模型配置",
    icon: <ApiOutlined />,
    permission: Permission.MODELS_READ,
  },
  {
    key: "banners",
    path: "/banners",
    label: "轮播图",
    icon: <PictureOutlined />,
    permission: Permission.BANNERS_READ,
  },
  {
    key: "banner-categories",
    path: "/banner-categories",
    label: "轮播分类",
    icon: <PictureOutlined />,
    permission: Permission.BANNERS_READ,
  },
  {
    key: "feedback-types",
    path: "/feedback-types",
    label: "反馈类型",
    icon: <TagsOutlined />,
    permission: Permission.FEEDBACK_READ,
  },
  {
    key: "feedbacks",
    path: "/feedbacks",
    label: "意见反馈",
    icon: <FileSearchOutlined />,
    permission: Permission.FEEDBACK_READ,
  },
  {
    key: "referral",
    path: "/referral",
    label: "分销管理",
    icon: <TeamOutlined />,
    permission: Permission.REFERRAL_READ,
  },
  {
    key: "providers",
    path: "/providers",
    label: "Provider 配置",
    icon: <KeyOutlined />,
    permission: Permission.SETTINGS_READ,
  },
  {
    key: "admin-users",
    path: "/admin-users",
    label: "后台用户",
    icon: <SafetyCertificateOutlined />,
    permission: Permission.ADMIN_USERS_READ,
  },
  {
    key: "audit-logs",
    path: "/audit-logs",
    label: "审计日志",
    icon: <FileSearchOutlined />,
    permission: Permission.AUDIT_READ,
  },
];
