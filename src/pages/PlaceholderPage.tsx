import { Empty, Typography } from 'antd'

// 通用占位页:页面代码待后续按 MD 规格生成时替换。
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      <Empty description={`「${title}」页面待实现`} style={{ marginTop: 64 }} />
    </div>
  )
}
