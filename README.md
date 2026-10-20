# zhenzhihui-admin

帧智汇(zhenzhihui)运营后台前端。对接 Go 业务后端 `/api/v1/admin/*`。

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

## 音色管理（2026-10-20）

- 公共音色 `/voices`：列表、搜索、状态筛选、新增/编辑、启停、已有音频试听。读取使用 `admin.models.read`，写入使用 `admin.models.write`。
- 复刻槽位 `/voice-slots`：输入工作空间 ID 查看已分配槽位，确认预付费后分配名额，凭证轮换后核验重绑。读取使用 `admin.settings.read`，写入使用 `admin.settings.write`。
- 接口均在 `/api/v1/admin`：`GET/PUT /voices/public`、`GET/POST /voices/slots`、`POST /voices/slots/:id/rebind`。公共列表包含停用条目，编辑时供应商 ID 锁定。预付槽位不自动购买、回收、跨空间复用；试听不触发付费生成。
- 页面只使用真实 API，无运行时模拟数据。浏览器验收用隔离请求数据测试表单、权限和响应式，不会操作线上供应商。
- 本轮验证：Node 22 下 `npm run build`、`npm test`（12 项）、改动文件 ESLint；后端新增列表及权限测试；Playwright 验证编辑、预付确认、分配、重绑、只读权限和 390px 布局。全仓 ESLint 的 `WorkspacesPage.tsx` 两处既有 effect 警告为 error，未在本轮修改。
- 发布时需先发布提供 `GET /admin/voices/public` 的后端，再发布本管理端。尚未使用真实供应商凭证验证槽位重绑；需要运营使用已购名额验收。
