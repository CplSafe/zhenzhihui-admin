import { CreateUserModal } from "@/components/CreateUserModal";
import { UserDetailDrawer } from "@/components/UserDetailDrawer";
import { useState } from "react";
import { App, Button, Input, Modal, Space, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { Mono } from "@/components/cells";
import { useAdminSession } from "@/hooks/useAdminSession";
import { usePagedList } from "@/hooks/usePagedList";
import { usePermission } from "@/hooks/usePermission";
import { startUserImpersonation } from "@/api/admin";
import { listUsers, type UserListParams } from "@/api/queries";
import { readRouteId } from "@/router/routeId";
import { Permission, RoleCode } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { User } from "@/types/domain";
import { fmtTime } from "@/utils/format";

const columns: TableColumnsType<User> = [
  { title: "ID", dataIndex: "id", width: 80, render: (v) => <Mono>{v}</Mono> },
  { title: "昵称", dataIndex: "nickname", render: (v) => v || "-" },
  { title: "手机号", dataIndex: "mobile", render: (v) => <Mono>{v}</Mono> },
  { title: "邮箱", dataIndex: "email", render: (v) => v || "-" },
  {
    title: "DeepAuth ID",
    dataIndex: "deepauth_user_id",
    render: (v) => <Mono>{v}</Mono>,
  },
  {
    title: "注册时间",
    dataIndex: "created_at",
    width: 170,
    render: (v) => fmtTime(v),
  },
];

export function UsersPage() {
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { data: adminSession } = useAdminSession();
  const { has } = usePermission();
  const canImpersonate = has(Permission.USERS_READ) && !!adminSession?.roles.some((role) => role.code === RoleCode.SUPER_ADMIN);
  const canOpenWorkspace = has(Permission.WORKSPACES_READ);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeUserId = readRouteId(searchParams.get("user_id"));
  const workspaceFilter = readRouteId(searchParams.get("workspace_id"));
  const [keyword, setKeyword] = useState("");
  const [loginTarget, setLoginTarget] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const { items, loading, error, pagination } = usePagedList<
    User,
    UserListParams
  >({
    queryKey: "admin-users-list",
    filters: { keyword, workspace_id: workspaceFilter ?? undefined },
    fetcher: listUsers,
  });

  function selectUser(userId: number | null, clearWorkspaceFilter = false) {
    const next = new URLSearchParams(searchParams);
    if (userId === null) next.delete("user_id");
    else next.set("user_id", String(userId));
    if (clearWorkspaceFilter) next.delete("workspace_id");
    setSearchParams(next, { replace: userId === null });
  }

  async function signInAsUser(userId: number) {
    let destination: URL;
    try {
      destination = new URL("/view-as-user", import.meta.env.VITE_ZZH_REMOTE_ORIGIN);
      if (destination.protocol !== "https:") throw new Error("Expected HTTPS");
    } catch {
      void message.error("用户端访问地址未配置为 HTTPS");
      return;
    }

    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      void message.error("浏览器拦截了新标签页，请允许弹出窗口后重试");
      return;
    }

    setSigningIn(true);
    try {
      tab.opener = null;
      tab.document.title = "正在登录用户端";
      tab.document.body.textContent = "正在登录用户端…";

      const { code } = await startUserImpersonation(userId);
      if (!code) throw new Error("Missing impersonation code");
      if (tab.closed) {
        void message.error("登录标签页已关闭，请重试");
        return;
      }
      destination.hash = new URLSearchParams({ code, mode: "account" }).toString();
      const link = tab.document.createElement("a");
      link.href = destination.href;
      link.rel = "noreferrer";
      link.hidden = true;
      tab.document.body.append(link);
      link.click();
      setLoginTarget(null);
    } catch (error) {
      tab.close();
      void message.error(error instanceof ApiError ? error.message : "登录用户端失败，请重试");
    } finally {
      setSigningIn(false);
    }
  }

  const detailCols: TableColumnsType<User> = [
    ...columns,
    {
      title: "团队所有者",
      key: "owned_teams",
      render: (_, { owned_teams }) => owned_teams?.length ? (
        <Space orientation="vertical" size={2}>
          {owned_teams.map((team) => {
            const name = <>{team.name || "未命名团队"} <Mono>#{team.id}</Mono></>;
            return canOpenWorkspace
              ? <Link key={team.id} to={`/workspaces?workspace_id=${team.id}`}>{name}</Link>
              : <span key={team.id}>{name}</span>;
          })}
        </Space>
      ) : "否",
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: canImpersonate ? 200 : 80,
      render: (_, r) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => selectUser(r.id)}>
            详情
          </Button>
          {canImpersonate && (
            <Button
              type="link"
              size="small"
              onClick={() => setLoginTarget(r)}
            >
              以用户身份登录
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {creating && (
        <CreateUserModal onClose={() => setCreating(false)} onCreated={(user, existingIdentity) => {
          setCreating(false);
          setKeyword(user.mobile || "");
          selectUser(user.id, true);
          void queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
          void message.success(existingIdentity ? "已有认证账号已同步，原密码保持不变" : "账号已创建，可用初始密码登录");
        }} />
      )}
      <ListPageShell<User>
        filters={
          <Space wrap>
            <Can permission={[Permission.USERS_READ, Permission.USERS_CREATE]} mode="all">
              <Button type="primary" onClick={() => setCreating(true)}>新增用户</Button>
            </Can>
            <Input.Search
              allowClear
              placeholder="手机号 / 邮箱 / 昵称 / DeepAuth ID"
              style={{ width: 320 }}
              onSearch={setKeyword}
            />
            {workspaceFilter !== null && (
              <Tag closable onClose={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("workspace_id");
                setSearchParams(next);
              }}>
                空间 #{workspaceFilter} 的成员
              </Tag>
            )}
          </Space>
        }
        columns={detailCols}
        dataSource={items}
        rowKey="id"
        loading={loading}
        error={error}
        pagination={pagination}
      />

      <Modal
        title="以用户身份登录"
        open={canImpersonate && loginTarget !== null}
        okText="确认登录"
        okButtonProps={{ danger: true }}
        cancelButtonProps={{ disabled: signingIn }}
        confirmLoading={signingIn}
        onOk={() => {
          if (canImpersonate && loginTarget && !signingIn) void signInAsUser(loginTarget.id);
        }}
        onCancel={() => {
          if (!signingIn) setLoginTarget(null);
        }}
      >
        {loginTarget && (
          <Typography.Paragraph>
            将在新标签页以 <Typography.Text strong>{loginTarget.nickname || loginTarget.mobile || loginTarget.email || "未命名用户"}（ID {loginTarget.id}）</Typography.Text> 登录用户端。
          </Typography.Paragraph>
        )}
        <Typography.Paragraph>
          您将使用该用户已有的权限。修改会保存到该用户或其工作空间，生成任务等操作可能消耗工作空间积分。
        </Typography.Paragraph>
      </Modal>

      <UserDetailDrawer
        key={`${activeUserId ?? "closed"}:${workspaceFilter ?? "all"}`}
        userId={activeUserId}
        initialWorkspaceId={workspaceFilter}
        canViewCanvases={canImpersonate}
        onClose={() => selectUser(null)}
      />
    </>
  );
}
