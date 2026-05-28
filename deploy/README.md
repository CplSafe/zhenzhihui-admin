# 部署说明(独立端口 8002)

运营后台前端部署到服务器 `115.190.63.215`,独立 nginx 端口 **8002**,
`/api` 与 `/auth` 反代到本机 `9000`(zhenzhihui 业务后端)。同源 → OAuth Cookie 打通。

## 架构

```
浏览器 → http://115.190.63.215:8002/            (admin 前端静态资源)
                       │
        nginx(8002)  ├─ /            → dist/index.html(SPA)
                       ├─ /assets/*   → dist/assets/*
                       ├─ /api/*      → 127.0.0.1:9000  (业务后端)
                       └─ /auth/*     → 127.0.0.1:9000  (OAuth 登录/回调)
```

服务器现有服务:**8001** C 端前端 · **8080** DeepAuth 认证中心 · **9000** zhenzhihui 后端。

## 登录链路(为什么这样能通)

1. 打开 `8002/` → 前端调 `GET /api/v1/admin/session`
2. 未登录 → 后端 401 → 前端跳 `/auth/login`(经 nginx 代理到 9000)
3. 9000 生成 PKCE,302 跳 DeepAuth(8080)登录页,输账号密码
4. DeepAuth 带 code 回调 `9000/auth/callback` → 后端用 code 换 token、
   种 **HttpOnly Cookie(域 = 115.190.63.215)**、302 回前端
5. 回到 `8002/` → 浏览器自动带上同域 Cookie → `/admin/session` 认出会话,
   查 `admin_users` 表返回角色/权限 → 进入后台

> 账号密码登录在 DeepAuth 完成;是否是后台管理员由 zhenzhihui 的 `admin_users` 表决定。
> 登录后若报 403 `NOT_ADMIN`,说明该账号还没在 `admin_users` 表授权。

## 部署步骤

### 1. 本地构建

```bash
cd zhenzhihui-admin
pnpm install
pnpm build           # 产出 dist/
```

### 2. 上传 dist 到服务器

```bash
# 在服务器建目录
ssh user@115.190.63.215 'sudo mkdir -p /var/www/zhenzhihui-admin'
# 上传(在本地 zhenzhihui-admin 目录执行)
rsync -avz --delete dist/ user@115.190.63.215:/var/www/zhenzhihui-admin/
```

### 3. 安装 nginx 配置

```bash
# 上传配置
scp deploy/nginx-admin.conf user@115.190.63.215:/tmp/
# 在服务器
ssh user@115.190.63.215
sudo cp /tmp/nginx-admin.conf /etc/nginx/sites-available/zhenzhihui-admin.conf
sudo ln -sf /etc/nginx/sites-available/zhenzhihui-admin.conf /etc/nginx/sites-enabled/
sudo nginx -t        # 校验配置
sudo systemctl reload nginx
```

> 如服务器用的是 `/etc/nginx/conf.d/`,直接 `sudo cp nginx-admin.conf /etc/nginx/conf.d/` 即可。
> 需放行防火墙/安全组的 **8002** 端口。

### 4. 访问

`http://115.190.63.215:8002/`

## 登录后跳回 8002(可选优化)

后端登录成功后 302 到 `auth_applications.frontend_success_url`。若它指向 8001,
登完会落在 8001;手动回到 `8002/` 即可(Cookie 同域已生效)。

如需登完直接回 8002,请运维在服务器数据库执行(把 8002 设为成功页或加白名单):

```sql
-- 视后端校验逻辑(normalizeFrontendRedirect 要求同源),
-- 把 frontend_success_url 调整为 admin 的地址即可让 redirect_to=8002 生效:
UPDATE auth_applications
SET frontend_success_url = 'http://115.190.63.215:8002/'
WHERE app_code = 'zhenzhihui' AND status = 'active';
```

> 注意:该 url 同时被 C 端(8001)使用,若两端共用一条 application,改动会影响 C 端登录回跳。
> 更稳妥的做法是为 admin 单独建一条 `auth_applications` 记录(独立 client_id + redirect_uri/success_url),
> 由运维在 DeepAuth 与业务库同步配置。

## HTTPS / 生产加固(后续)

- 当前为 HTTP。生产建议上 HTTPS(后端 Cookie 的 `Secure` 标志在 release 模式会要求 HTTPS)。
- 加 nginx 反代时若启用 HTTPS,记得 `proxy_set_header X-Forwarded-Proto https`,
  让后端正确判定 secure cookie。
