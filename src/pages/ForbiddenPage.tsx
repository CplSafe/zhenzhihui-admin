import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

// 路由级权限不足:用户访问了无权限的页面路径。
export function ForbiddenPage() {
  const navigate = useNavigate()
  return (
    <Result
      status="403"
      title="无权访问此页面"
      subTitle="当前角色未被授予该页面所需的权限点。"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>
          返回首页
        </Button>
      }
    />
  )
}
