# zhenzhihui-admin

帧智绘(zhenzhihui)运营后台前端。对接 Go 业务后端 `/api/v1/admin/*`。

## 技术栈

- Vite 8 + React 19 + TypeScript
- Ant Design 6（中文 locale）
- React Router 7（`createBrowserRouter`）
- TanStack Query 5（服务端状态/缓存）
- Axios（统一信封 + 401 跳登录）

## 开发

```bash
pnpm install
pnpm dev      # 启动开发服务器,默认 http://localhost:5273
pnpm build    # tsc 类型检查 + 生产构建
pnpm preview  # 预览构建产物
```

开发态下 `/api` 与 `/auth` 由 Vite 代理到 `VITE_API_PROXY_TARGET`（默认 `http://localhost:8080`),
改后端地址改 `.env.development`。

## 认证与权限模型

认证在 DeepAuth(auth 项目)完成,后台前端不存密码:

1. 未登录访问任意接口 → 后端 401 → axios interceptor 跳 `/auth/login`(DeepAuth OAuth)。
2. 登录后 `GET /api/v1/admin/session` 拿身份/角色/权限:
   - 403 `NOT_ADMIN` → 非后台用户拦截页
   - 403 `ADMIN_DISABLED` → 账号已禁用拦截页
3. 权限点(如 `admin.users.read`)由 `usePermission()` / `<Can>` / `<RequirePermission>` 控制菜单与页面可见性。

权限点常量见 `src/types/admin.ts`,与后端 `internal/admin/permissions.go` 一一对应。

## 目录结构

```
src/
├── api/            # 接口封装(client.ts 统一信封, admin.ts 等模块)
├── components/     # 通用组件(AuthGuard / RequirePermission / Can)
├── hooks/          # useAdminSession / usePermission
├── layouts/        # MainLayout(侧边栏+头部)
├── pages/          # 页面(目前为占位,待按 docs/ 规格生成)
├── router/         # 路由(index.tsx) + 菜单配置(menuConfig.tsx)
├── types/          # API 信封类型 + admin 领域类型
├── App.tsx         # Provider 装配
└── main.tsx        # 入口
```

## 新增页面的约定

1. 在 `src/types/` / `src/api/` 补对应的类型与接口模块。
2. 在 `src/pages/` 写页面组件。
3. 在 `src/router/menuConfig.tsx` 加一项(path / label / icon / permission)——
   侧边栏与权限过滤会自动生效;在 `src/router/index.tsx` 把占位页换成真实页面。

## 待办

后台页面代码待 `docs/` 下的 MD 规格补充后逐个生成。
