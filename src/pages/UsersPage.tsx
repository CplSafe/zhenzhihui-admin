import { UserHierarchyPanel } from "@/components/UserHierarchyPanel";
import { useState } from "react";
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { UsageSummaryPanel } from "@/components/UsageSummaryPanel";
import { Credits, Mono } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import { getUser, listUsers } from "@/api/queries";
import { listPlans } from "@/api/plans";
import { adjustCredits, grantPlan, createTeamGrant } from "@/api/grants";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type {
  AdminUserDetail,
  Plan,
  User,
  UserWorkspaceItem,
} from "@/types/domain";
import { fmtCredits, fmtTime } from "@/utils/format";

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
  const [keyword, setKeyword] = useState("");
  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  const { items, loading, error, pagination } = usePagedList<
    User,
    { keyword: string }
  >({
    queryKey: "admin-users-list",
    filters: { keyword },
    fetcher: listUsers,
  });

  const detailCols: TableColumnsType<User> = [
    ...columns,
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setActiveUserId(r.id)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <ListPageShell<User>
        title="用户管理"
        filters={
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="手机号 / 邮箱 / 昵称 / DeepAuth ID"
              style={{ width: 320 }}
              onSearch={setKeyword}
            />
          </Space>
        }
        columns={detailCols}
        dataSource={items}
        rowKey="id"
        loading={loading}
        error={error}
        pagination={pagination}
      />

      <UserDetailDrawer
        key={activeUserId ?? "closed"}
        userId={activeUserId}
        onClose={() => setActiveUserId(null)}
      />
    </>
  );
}

// 用户详情抽屉:展示用户信息 + 其 workspace 列表(钱包/订阅),可对每个 workspace
// 授予套餐 / 加积分(权限 admin.grants.write)。
function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: number | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [grantTarget, setGrantTarget] = useState<UserWorkspaceItem | null>(
    null,
  );
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [creditTarget, setCreditTarget] = useState<UserWorkspaceItem | null>(
    null,
  );

  const detail = useQuery<AdminUserDetail, ApiError>({
    queryKey: ["admin", "user-detail", userId],
    queryFn: () => getUser(userId as number),
    enabled: userId !== null,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "user-detail", userId] });
    void qc.invalidateQueries({ queryKey: ["admin", "usage-summary"] });
  };

  return (
    <>
      <Drawer
        title={`用户详情 #${userId ?? ""}`}
        width={680}
        open={userId !== null}
        onClose={onClose}
        loading={detail.isFetching}
        destroyOnHidden
      >
        {detail.data && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {userId !== null && <UsageSummaryPanel scope="user" id={userId} />}
            <Descriptions column={1} bordered size="small" title="基础信息">
              <Descriptions.Item label="昵称">
                {detail.data.user.nickname || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="手机号">
                <Mono>{detail.data.user.mobile}</Mono>
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {detail.data.user.email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="DeepAuth ID">
                <Mono>{detail.data.user.deepauth_user_id}</Mono>
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {fmtTime(detail.data.user.created_at)}
              </Descriptions.Item>
            </Descriptions>

            {userId !== null && <UserHierarchyPanel userId={userId} />}

            <Typography.Text strong>
              工作空间({detail.data.workspace_count})
            </Typography.Text>
            <Can permission={Permission.GRANTS_WRITE}>
              <Button onClick={() => setCreatingTeam(true)}>新增团队并授予套餐</Button>
            </Can>
            {detail.data.workspaces.map((w) => (
              <Card
                key={w.workspace.id}
                size="small"
                title={
                  <Space>
                    <Mono>#{w.workspace.id}</Mono>
                    {w.workspace.name}
                    <Tag>{w.role}</Tag>
                  </Space>
                }
                extra={
                  <Can permission={Permission.GRANTS_WRITE}>
                    <Space size="small">
                      <Button size="small" onClick={() => setGrantTarget(w)}>
                        授予套餐
                      </Button>
                      <Button size="small" onClick={() => setCreditTarget(w)}>
                        加积分
                      </Button>
                    </Space>
                  </Can>
                }
              >
                <Space size={24}>
                  <span>
                    余额:
                    <Credits value={w.wallet?.balance ?? 0} />
                  </span>
                  <span>
                    冻结:
                    <Credits value={w.wallet?.frozen ?? 0} />
                  </span>
                  <span>
                    订阅:
                    {w.subscription ? (
                      <Tag color="green">
                        plan #{w.subscription.plan_id} · 至{" "}
                        {fmtTime(w.subscription.current_period_end)}
                      </Tag>
                    ) : (
                      <Tag color="red">无</Tag>
                    )}
                  </span>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Drawer>

      {creatingTeam && userId !== null && (
        <GrantPlanModal
          key={userId}
          target={null}
          newTeamUserId={userId}
          onClose={() => setCreatingTeam(false)}
          onDone={() => {
            message.success("已新增团队并授予套餐");
            setCreatingTeam(false);
            refresh();
          }}
        />
      )}
      <GrantPlanModal
        target={grantTarget}
        onClose={() => setGrantTarget(null)}
        onDone={() => {
          message.success("已授予套餐");
          setGrantTarget(null);
          refresh();
        }}
      />
      <AdjustCreditModal
        target={creditTarget}
        onClose={() => setCreditTarget(null)}
        onDone={() => {
          message.success("已加积分");
          setCreditTarget(null);
          refresh();
        }}
      />
    </>
  );
}

function GrantPlanModal({
  target,
  newTeamUserId,
  onClose,
  onDone,
}: {
  target: UserWorkspaceItem | null;
  newTeamUserId?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ plan_id: number; grant_credits: boolean; name?: string }>();
  const open = target !== null || newTeamUserId !== undefined;

  // 拉套餐列表供选择(仅在打开时)。
  const plans = useQuery<Plan[], ApiError>({
    queryKey: ["admin", "plans"],
    queryFn: listPlans,
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: (v: { plan_id: number; grant_credits: boolean; name?: string }) =>
      newTeamUserId !== undefined
        ? createTeamGrant(newTeamUserId, { ...v, name: v.name!.trim() })
        : grantPlan(target!.workspace.id, v),
    onSuccess: onDone,
    onError: (e: unknown) =>
      message.error(e instanceof ApiError ? e.message : "授予失败"),
  });

  return (
    <Modal
      title={newTeamUserId !== undefined ? "新增团队并授予套餐" : `授予套餐 → ${target?.workspace.name ?? ""} #${target?.workspace.id ?? ""}`}
      open={open}
      onCancel={() => { if (!mut.isPending) onClose(); }}
      onOk={() => { if (!mut.isPending) form.submit(); }}
      confirmLoading={mut.isPending}
      cancelButtonProps={{ disabled: mut.isPending }}
      destroyOnHidden
    >
      <Form
        form={form}
        preserve={false}
        disabled={mut.isPending}
        layout="vertical"
        initialValues={{ grant_credits: true }}
        onFinish={(v) => mut.mutate(v)}
      >
        {newTeamUserId !== undefined && (
          <Form.Item name="name" label="团队名称" rules={[
            { required: true, whitespace: true, message: "请输入团队名称" },
            { validator: (_, value: string) => !value || [...value.trim()].length <= 128 ? Promise.resolve() : Promise.reject(new Error("团队名称不能超过 128 字符")) },
          ]}>
            <Input placeholder="填写新团队的名称" />
          </Form.Item>
        )}
        <Form.Item
          name="plan_id"
          label="套餐"
          rules={[{ required: true, message: "请选择套餐" }]}
        >
          <Select
            loading={plans.isFetching}
            placeholder="选择要授予的套餐"
            options={(plans.data ?? []).filter((p) => p.status === "enabled").map((p) => ({
              value: p.id,
              label: `${p.name}(${p.code})· 赠 ${fmtCredits(p.base_credits)} 积分`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="grant_credits"
          label="同时按套餐赠送积分(累加,不覆盖已有余额)"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AdjustCreditModal({
  target,
  onClose,
  onDone,
}: {
  target: UserWorkspaceItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ amount: number; reason?: string }>();

  const mut = useMutation({
    mutationFn: (v: { amount: number; reason?: string }) =>
      adjustCredits(target!.workspace.id, v),
    onSuccess: onDone,
    onError: (e: unknown) =>
      message.error(e instanceof ApiError ? e.message : "加积分失败"),
  });

  return (
    <Modal
      title={`加积分 → 空间 #${target?.workspace.id ?? ""}`}
      open={target !== null}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={mut.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => mut.mutate(v)}>
        <Form.Item
          name="amount"
          label="积分数额(正数,最多 3 位小数,累加不覆盖;上限 10 亿)"
          rules={[{ required: true, message: "请输入正数(最多 3 位小数)" }]}
        >
          <InputNumber
            min={0.001}
            max={1_000_000_000}
            precision={3}
            step={0.001}
            style={{ width: "100%" }}
            placeholder="1000"
          />
        </Form.Item>
        <Form.Item name="reason" label="原因(记入流水)">
          <Input placeholder="如:运营补偿 / 活动赠送" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
