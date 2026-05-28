import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage } from 'node:http'

// 本地开发跨域方案,照搬 zhenzhihui-web:
//   - /api、/auth、/deepauth 全部经 vite 代理打到远程后端 / DeepAuth,
//     这样所有响应(含 Set-Cookie)都回到 localhost 同源,OAuth Cookie 能建立。
//   - 关键:把后端 / DeepAuth 返回的跳转 location(绝对地址)改写回 localhost,
//     让整个 OAuth 流程闭环在本地,不会跳出到 115.190.63.215。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const businessTarget = env.VITE_ZZH_REMOTE_ORIGIN || 'http://localhost:9000'
  const deepAuthTarget = env.VITE_DEEPAUTH_REMOTE_ORIGIN || 'http://localhost:8080'
  const businessCallbackUrl = `${normalizeBaseUrl(businessTarget)}/auth/callback`

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5273,
      proxy: {
        // 业务接口
        '/api': businessProxy(businessTarget),
        // OAuth 登录/回调:把后端处理完的最终回跳(绝对地址)改写为 localhost 根
        '/auth': {
          ...businessProxy(businessTarget),
          configure: (proxy) => {
            stripOrigin(proxy)
            proxy.on('proxyRes', (proxyRes, req) => {
              const location = proxyRes.headers.location
              if (
                typeof location === 'string' &&
                /^https?:\/\//.test(location)
              ) {
                proxyRes.headers.location = `${getDevOrigin(req)}/`
              }
            })
          },
        },
        // DeepAuth JSON 登录 API + 授权端点:把 DeepAuth→后端 callback 的跳转
        // 改写为 localhost callback,继续走本地代理闭环
        '/deepauth': {
          target: deepAuthTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/deepauth/, ''),
          configure: (proxy) => {
            stripOrigin(proxy)
            proxy.on('proxyRes', (proxyRes, req) => {
              const location = proxyRes.headers.location
              if (
                typeof location === 'string' &&
                location.startsWith(businessCallbackUrl)
              ) {
                proxyRes.headers.location = location.replace(
                  businessCallbackUrl,
                  `${getDevOrigin(req)}/auth/callback`,
                )
              }
            })
          },
        },
      },
    },
  }
})

function businessProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    configure: (proxy) => stripOrigin(proxy),
  }
}

// 去掉 Origin 头,避免后端 CORS / Referer 校验把代理请求当跨域拒绝。
function stripOrigin(proxy: {
  on: (e: 'proxyReq', cb: (req: { removeHeader: (h: string) => void }) => void) => void
}) {
  proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
}

function getDevOrigin(req: IncomingMessage): string {
  return `http://${req.headers.host || 'localhost:5273'}`
}

function normalizeBaseUrl(url: string): string {
  return String(url || '').replace(/\/+$/, '')
}
