import { Tag, Typography } from 'antd'
import { yuan, fmtNumber } from '@/utils/format'

// 金额单元格:tnum 等宽数字 + ¥ 元。DESIGN.md 金融数据签名。
export function Money({ cents }: { cents?: number | null }) {
  return <span className="tnum">{yuan(cents)}</span>
}

// 计数单元格:tnum 千分位整数(积分等)。
export function Count({ value }: { value?: number | null }) {
  return <span className="tnum">{fmtNumber(value)}</span>
}

// ID / 短码等技术字段:等宽淡色。
export function Mono({ children }: { children?: React.ReactNode }) {
  if (children === undefined || children === null || children === '') {
    return <Typography.Text type="secondary">-</Typography.Text>
  }
  return <span className="tnum">{children}</span>
}

// 状态色板:把后端各种 status 字符串映射到语义颜色。
const STATUS_COLOR: Record<string, string> = {
  // 通用成功/启用
  succeeded: 'green',
  active: 'green',
  enabled: 'green',
  paid: 'green',
  // 进行中
  processing: 'blue',
  running: 'blue',
  queued: 'gold',
  submitted: 'gold',
  submitting: 'gold',
  pending: 'gold',
  // 失败/禁用
  failed: 'red',
  payment_failed: 'red',
  rejected: 'red',
  disabled: 'default',
  canceled: 'default',
  deleted: 'default',
}

export function StatusTag({ status }: { status?: string }) {
  if (!status) return <span>-</span>
  return <Tag color={STATUS_COLOR[status] ?? 'default'}>{status}</Tag>
}
