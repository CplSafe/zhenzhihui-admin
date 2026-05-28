import { useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import {
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "@/api/adminUsers";
import { ROLE_OPTIONS } from "@/constants/roles";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { AdminUserView } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface Filters {
  status?: string;
}

interface EditState {
  id: number;
  roles: string[];
  remark?: string;
}

export function AdminUsersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [createForm] = Form.useForm<{
    deepauth_user_id: string;
    roles: string[];
    remark?: string;
  }>();
  const [editForm] = Form.useForm<{ roles: string[]; remark?: string }>();

  const { items, loading, error, pagination, refetch } = usePagedList<
    AdminUserView,
    Filters
  >({
    queryKey: "admin-admin-users-list",
    filters,
    fetcher: listAdminUsers,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-admin-users-list"] });
    refetch();
  };

  // 统一的写操作错误提示:把后端字符串码翻译成中文。
  const onError = (e: unknown) => {
    if (e instanceof ApiError) {
      message.error(e.message || "操作失败");
    } else {
      message.error("操作失败");
    }
  };

  const createMut = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      message.success("已新增后台用户");
      setCreateOpen(false);
      createForm.resetFields();
      invalidate();
    },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: number; roles: string[]; remark?: string }) =>
      updateAdminUser(v.id, { roles: v.roles, remark: v.remark }),
    onSuccess: () => {
      message.success("已更新");
      setEdit(null);
      invalidate();
    },
    onError,
  });

  const disableMut = useMutation({
    mutationFn: disableAdminUser,
    onSuccess: () => {
      message.success("已禁用");
      invalidate();
    },
    onError,
  });

  const enableMut = useMutation({
    mutationFn: enableAdminUser,
    onSuccess: () => {
      message.success("已恢复");
      invalidate();
    },
    onError,
  });

  const columns: TableColumnsType<AdminUserView> = [
    {
      title: "ID",
      dataIndex: ["admin_user", "id"],
      width: 80,
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: "DeepAuth ID",
      dataIndex: ["admin_user", "deepauth_user_id"],
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: "角色",
      key: "roles",
      render: (_, r) =>
        r.roles.length
          ? r.roles.map((role) => <Tag key={role.code}>{role.name}</Tag>)
          : "-",
    },
    {
      title: "状态",
      dataIndex: ["admin_user", "status"],
      width: 100,
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: "备注",
      dataIndex: ["admin_user", "remark"],
      render: (v) => v || "-",
    },
    {
      title: "创建时间",
      dataIndex: ["admin_user", "created_at"],
      width: 180,
      render: (v) => fmtTime(v),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 180,
      render: (_, r) => (
        <Can
          permission={Permission.ADMIN_USERS_WRITE}
          fallback={<span>-</span>}
        >
          <Space size="small">
            <Button
              type="link"
              size="small"
              onClick={() =>
                setEdit({
                  id: r.admin_user.id,
                  roles: r.roles.map((x) => x.code),
                  remark: r.admin_user.remark,
                })
              }
            >
              编辑
            </Button>
            {r.admin_user.status === "active" ? (
              <Popconfirm
                title="禁用该后台用户?"
                description="禁用后该账号将无法登录后台。"
                onConfirm={() => disableMut.mutate(r.admin_user.id)}
              >
                <Button type="link" size="small" danger>
                  禁用
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type="link"
                size="small"
                onClick={() => enableMut.mutate(r.admin_user.id)}
              >
                恢复
              </Button>
            )}
          </Space>
        </Can>
      ),
    },
  ];

  return (
    <>
      <ListPageShell<AdminUserView>
        title="后台用户"
        filters={
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 160 }}
              options={[
                { value: "active", label: "active 启用" },
                { value: "disabled", label: "disabled 禁用" },
              ]}
              onChange={(v) => setFilters({ status: v })}
            />
            <Can permission={Permission.ADMIN_USERS_WRITE}>
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                新增后台用户
              </Button>
            </Can>
          </Space>
        }
        columns={columns}
        dataSource={items}
        rowKey={(r) => r.admin_user.id}
        loading={loading}
        error={error}
        pagination={pagination}
      />

      <Modal
        title="新增后台用户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(v) => createMut.mutate(v)}
        >
          <Form.Item
            name="deepauth_user_id"
            label="DeepAuth 用户 ID"
            extra="用户必须先用 DeepAuth 登过一次业务系统,才能授予后台权限。"
            rules={[{ required: true, message: "请输入 deepauth_user_id" }]}
          >
            <Input placeholder="usr_abc123" />
          </Form.Item>
          <Form.Item
            name="roles"
            label="角色"
            rules={[{ required: true, message: "至少选择一个角色" }]}
          >
            <Select
              mode="multiple"
              placeholder="选择角色"
              options={ROLE_OPTIONS.map((o) => ({
                value: o.value,
                label: `${o.label} · ${o.desc}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可选,如:运营 - 模型组小张" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑后台用户 #${edit?.id ?? ""}`}
        open={edit !== null}
        onCancel={() => setEdit(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMut.isPending}
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={{ roles: edit?.roles, remark: edit?.remark }}
          onFinish={(v) => edit && updateMut.mutate({ id: edit.id, ...v })}
        >
          <Form.Item
            name="roles"
            label="角色"
            rules={[{ required: true, message: "至少选择一个角色" }]}
          >
            <Select
              mode="multiple"
              options={ROLE_OPTIONS.map((o) => ({
                value: o.value,
                label: `${o.label} · ${o.desc}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
