import { Button, Result, Spin } from "antd";
import type { ReactNode } from "react";
import { useAdminSession } from "@/hooks/useAdminSession";
import { redirectToLogin } from "@/api/client";
import { ApiCode } from "@/types/api";

// 登录态 + 后台准入守卫:
//   - 加载中 → 全屏 spinner
//   - 401 已由 axios interceptor 跳转登录,这里基本看不到
//   - 403 NOT_ADMIN / ADMIN_DISABLED → 友好拦截页
//   - 通过 → 渲染子树(布局)
export function AuthGuard({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useAdminSession();

  if (isLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-ink-mute)",
        }}
      >
        <Spin size="large" />
        <span>加载后台会话…</span>
      </div>
    );
  }

  if (error) {
    if (error.codeString === ApiCode.NOT_ADMIN) {
      return (
        <Result
          status="403"
          title="无后台访问权限"
          subTitle="当前账号不是后台管理员。如需开通,请联系超级管理员在 admin_users 中授予角色。"
          extra={
            <Button type="primary" onClick={redirectToLogin}>
              切换账号
            </Button>
          }
        />
      );
    }
    if (error.codeString === ApiCode.ADMIN_DISABLED) {
      return (
        <Result
          status="403"
          title="后台账号已禁用"
          subTitle="该账号已被禁用,请联系超级管理员恢复。"
          extra={
            <Button type="primary" onClick={redirectToLogin}>
              切换账号
            </Button>
          }
        />
      );
    }
    return (
      <Result
        status="error"
        title="加载会话失败"
        subTitle={error.message}
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            重试
          </Button>
        }
      />
    );
  }

  if (!data) return null;
  return <>{children}</>;
}
