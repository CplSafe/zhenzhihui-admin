import { Button, Space, Tag, Typography } from "antd";
import { Can } from "@/components/Can";
import type { PermissionCode } from "@/types/admin";
import { yuan, fmtNumber } from "@/utils/format";

// 金额单元格:tnum 等宽数字 + ¥ 元。DESIGN.md 金融数据签名。
export function Money({ cents }: { cents?: number | null }) {
  return <span className="tnum">{yuan(cents)}</span>;
}

// 计数单元格:tnum 千分位整数(积分等)。
export function Count({ value }: { value?: number | null }) {
  return <span className="tnum">{fmtNumber(value)}</span>;
}

// ID / 短码等技术字段:等宽淡色。
export function Mono({ children }: { children?: React.ReactNode }) {
  if (children === undefined || children === null || children === "") {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }
  return <span className="tnum">{children}</span>;
}

// 状态色板:把后端各种 status 字符串映射到语义颜色。
const STATUS_COLOR: Record<string, string> = {
  // 通用成功/启用
  succeeded: "green",
  settled: "green",
  credited: "green",
  active: "green",
  enabled: "green",
  paid: "green",
  // 进行中
  processing: "blue",
  running: "blue",
  queued: "gold",
  submitted: "gold",
  submitting: "gold",
  pending: "gold",
  // 失败/禁用
  failed: "red",
  blocked: "red",
  payment_failed: "red",
  rejected: "red",
  ineligible: "default",
  zero: "default",
  no_profit: "default",
  no_referrer: "default",
  disabled: "default",
  canceled: "default",
  deleted: "default",
  // 工作空间:待激活(买 team 套餐开新空间未付款)/ 已解散
  activation_pending: "gold",
  disbanded: "default",
};

export function StatusTag({ status }: { status?: string }) {
  if (!status) return <span>-</span>;
  return <Tag color={STATUS_COLOR[status] ?? "default"}>{status}</Tag>;
}

interface RowActionsProps {
  // status=enabled 时显示「停用」,否则显示「启用」。
  status: string;
  permission: PermissionCode | string;
  onEdit: () => void;
  onEnable: () => void;
  onDisable: () => void;
}

// 「编辑 + 启用/停用」操作列。权限不足时整列渲染为占位符。
// 抽出供套餐 / 积分包等启停型管理页共用。
export function RowActions({
  status,
  permission,
  onEdit,
  onEnable,
  onDisable,
}: RowActionsProps) {
  return (
    <Can permission={permission} fallback={<span>-</span>}>
      <Space size="small">
        <Button type="link" size="small" onClick={onEdit}>
          编辑
        </Button>
        {status === "enabled" ? (
          <Button type="link" size="small" danger onClick={onDisable}>
            停用
          </Button>
        ) : (
          <Button type="link" size="small" onClick={onEnable}>
            启用
          </Button>
        )}
      </Space>
    </Can>
  );
}
