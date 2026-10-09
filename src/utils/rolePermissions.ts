export const superOnlyPermissions = new Set(['admin.roles.write', 'admin.admin_users.write'])
const labels: Record<string, string> = {
  overview: '运营概览', users: '用户管理', workspaces: '工作空间', tasks: 'AI 任务 / 智能体会话', assets: '素材管理', billing: '财务流水 / 钱包', subscriptions: '订阅', models: '模型配置', admin_users: '后台用户', roles: '角色管理', audit: '审计日志', plans: '套餐', credit_packages: '积分包', settings: 'Provider / 智能体配置', grants: '授予套餐 / 调整积分', banners: '轮播图 / 分类', feedback: '意见反馈 / 类型', referral: '分销管理', sensitive_words: '敏感词', request_logs: '请求日志', server_logs: '应用日志', logs: '实时日志',
}
export function permissionGroups<T extends { code: string; name: string }>(permissions: T[]) {
  const grouped = new Map<string, T[]>()
  for (const permission of permissions) {
    const key = permission.code.split('.')[1]
    grouped.set(key, [...(grouped.get(key) ?? []), permission])
  }
  return [...grouped].map(([key, items]) => ({ key, label: labels[key] ?? key, permissions: items }))
}
