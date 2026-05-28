import { useState } from 'react'
import { App, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, MobileOutlined } from '@ant-design/icons'
import {
  getAuthNavigationUrl,
  isCaptchaChallenge,
  loginWithPassword,
  startOAuth,
  type AuthStart,
} from '@/api/login'

// 极简后台登录页:手机号 + 密码。
// 账号密码在 DeepAuth 校验;登录成功后导航到后端给的 redirect_to 完成 OAuth 回调(种 Cookie),
// 再回到后台首页。本地开发靠 vite 代理把整个流程闭环在 localhost。
export function LoginPage() {
  const { message } = App.useApp()
  const [submitting, setSubmitting] = useState(false)

  const onFinish = async (values: { mobile: string; password: string }) => {
    setSubmitting(true)
    try {
      const authStart: AuthStart = await startOAuth()
      const result = await loginWithPassword({
        authStart,
        mobile: values.mobile.trim(),
        password: values.password,
      })
      // 导航到 redirect_to → 后端 /auth/callback 种 Cookie → 回到根路径
      window.location.href = getAuthNavigationUrl(authStart, result)
    } catch (err) {
      if (isCaptchaChallenge(err)) {
        message.error('该账号登录需要图形验证码,当前后台登录页暂不支持,请联系管理员或走 C 端登录。')
      } else {
        message.error(err instanceof Error ? err.message : '登录失败')
      }
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-canvas-soft)',
      }}
    >
      <Card style={{ width: 400 }} styles={{ body: { padding: 32 } }}>
        <div style={{ marginBottom: 24 }}>
          <Typography.Title
            level={3}
            style={{ margin: 0, fontWeight: 300, letterSpacing: '-0.4px' }}
          >
            帧智绘 <span style={{ color: '#665efd' }}>后台</span>
          </Typography.Title>
          <Typography.Text type="secondary">运营管理后台 · 请登录</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} disabled={submitting}>
          <Form.Item
            name="mobile"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input
              size="large"
              prefix={<MobileOutlined />}
              placeholder="手机号"
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={submitting}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
