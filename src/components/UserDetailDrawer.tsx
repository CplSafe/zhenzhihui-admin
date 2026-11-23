import { useState } from "react";
import {
  Alert,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Can } from "@/components/Can";
import { UsageSummaryPanel } from "@/components/UsageSummaryPanel";
import { UserCanvasPreview } from "@/components/UserCanvasPreview";
import { UserHierarchyPanel } from "@/components/UserHierarchyPanel";
import { Credits, Mono } from "@/components/cells";
import { getUser } from "@/api/queries";
import { listPlans } from "@/api/plans";
import { adjustCredits, grantPlan, createTeamGrant } from "@/api/grants";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { AdminUserDetail, Plan, UserWorkspaceItem, Workspace } from "@/types/domain";
import { fmtCredits, fmtTime, formatCreditsAsCny } from "@/utils/format";

const TYPE_LABEL = { personal: "个人空间", team: "团队空间", enterprise: "企业空间" };
const ROLE_LABEL: Record<string, string> = { owner: "所有者", admin: "管理员", member: "成员" };
const STATUS_LABEL: Record<string, string> = {
  enabled: "已启用",
  disabled: "已停用",
  disbanded: "已解散",
  activation_pending: "待激活",
  removed: "已移除",
  left: "已退出",
};

function quotaLabel(value?: number) {
  if (value == null) return "—";
  return value === 0 ? "不限" : `${fmtCredits(value)} 积分`;
}

export function UserDetailDrawer({
  userId,
  initialWorkspaceId,
  canViewCanvases,
  onClose,
}: {
  userId: number | null;
  initialWorkspaceId?: number | null;
  canViewCanvases: boolean;
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
  const [usageWorkspaceId, setUsageWorkspaceId] = useState(initialWorkspaceId ?? null);
  const [canvasWorkspace, setCanvasWorkspace] = useState<Workspace | null>(null);

  const detail = useQuery<AdminUserDetail, ApiError>({
    queryKey: ["admin", "user-detail", userId],
    queryFn: () => getUser(userId as number),
    enabled: userId !== null,
  });

  const refresh = (workspaceId?: number) => {
    const workspaceDetail = workspaceId === undefined
      ? ["admin", "workspace-detail"]
      : ["admin", "workspace-detail", workspaceId];
    for (const queryKey of [
      ["admin", "user-detail"],
      ["admin", "usage-summary"],
      ["admin-users-list"],
      ["admin-workspaces-list"],
      workspaceDetail,
    ]) {
      void qc.invalidateQueries({ queryKey });
    }
  };

  return (
    <>
      <Drawer
        title={`用户详情 #${userId ?? ""}`}
        size={680}
        open={userId !== null}
        onClose={onClose}
        loading={detail.isFetching}
        destroyOnHidden
      >
        {detail.isError && !detail.data && (
          <Alert
            type="error"
            showIcon
            title="用户详情加载失败"
            description={detail.error.message}
            action={<Button size="small" onClick={() => void detail.refetch()}>重试</Button>}
          />
        )}
        {detail.data && (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Typography.Text type="secondary">人民币估算按 1 积分折合 {formatCreditsAsCny(1)}。</Typography.Text>
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
            {(detail.data.workspaces || []).map((item) => {
              const { workspace, membership, wallet, subscription } = item;
              const role = membership?.role || item.role;
              const showUsage = usageWorkspaceId === workspace.id;
              return (
                <Card
                  key={workspace.id}
                  size="small"
                  title={
                    <Space wrap>
                      <Mono>#{workspace.id}</Mono>
                      <span title={workspace.name}>{workspace.name}</span>
                      <Tag>{TYPE_LABEL[workspace.type]}</Tag>
                    </Space>
                  }
                >
                  <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                    <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                      <Descriptions.Item label="成员角色">{ROLE_LABEL[role] ?? (role || "—")}</Descriptions.Item>
                      <Descriptions.Item label="空间状态">{STATUS_LABEL[workspace.status] ?? workspace.status}</Descriptions.Item>
                      <Descriptions.Item label="成员状态">
                        {membership ? STATUS_LABEL[membership.status] ?? membership.status : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="加入时间">{fmtTime(membership?.created_at)}</Descriptions.Item>
                      <Descriptions.Item label="AI 生成设置">
                        {membership ? (
                          <Tag color={membership.can_generate ? "green" : "default"}>
                            {membership.can_generate ? "已开启" : "已关闭"}
                          </Tag>
                        ) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="单任务积分上限">
                        {quotaLabel(membership?.max_task_credits)}
                      </Descriptions.Item>
                      <Descriptions.Item label="月度积分配额">
                        {quotaLabel(membership?.monthly_credit_limit)}
                      </Descriptions.Item>
                      <Descriptions.Item label="空间可用积分">
                        <Credits value={wallet?.balance} showEquivalent />
                      </Descriptions.Item>
                      <Descriptions.Item label="空间冻结积分">
                        <Credits value={wallet?.frozen} showEquivalent />
                      </Descriptions.Item>
                      <Descriptions.Item label="空间订阅" span="filled">
                        {subscription ? (
                          <Tag color="green">
                            套餐 #{subscription.plan_id} · 至 {fmtTime(subscription.current_period_end)}
                          </Tag>
                        ) : "无订阅"}
                      </Descriptions.Item>
                    </Descriptions>
                    <Space wrap size="small">
                      <Button
                        size="small"
                        aria-expanded={showUsage}
                        onClick={() => setUsageWorkspaceId(showUsage ? null : workspace.id)}
                      >
                        {showUsage ? "收起使用统计" : "查看使用统计"}
                      </Button>
                      {canViewCanvases && (
                        <Button size="small" onClick={() => setCanvasWorkspace(workspace)}>查看画布</Button>
                      )}
                      <Can permission={Permission.WORKSPACES_READ}>
                        <Link to={`/workspaces?workspace_id=${workspace.id}`}>打开空间详情</Link>
                      </Can>
                      {userId !== null && (
                        <Can permission={Permission.ASSETS_READ}>
                          <Link to={`/assets?user_id=${userId}&workspace_id=${workspace.id}&source=generated`}>查看生成素材</Link>
                        </Can>
                      )}
                      <Can permission={Permission.GRANTS_WRITE}>
                        <Button size="small" onClick={() => setGrantTarget(item)}>
                          授予套餐
                        </Button>
                        <Button size="small" onClick={() => setCreditTarget(item)}>
                          加积分
                        </Button>
                      </Can>
                    </Space>
                    {showUsage && userId !== null && (
                      <UsageSummaryPanel scope="user" id={userId} workspaceId={workspace.id} />
                    )}
                  </Space>
                </Card>
              );
            })}
          </Space>
        )}
      </Drawer>

      {canViewCanvases && userId !== null && canvasWorkspace && (
        <UserCanvasPreview
          userId={userId}
          workspace={canvasWorkspace}
          onClose={() => setCanvasWorkspace(null)}
        />
      )}

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
          refresh(grantTarget?.workspace.id);
        }}
      />
      <AdjustCreditModal
        target={creditTarget}
        onClose={() => setCreditTarget(null)}
        onDone={() => {
          message.success("已加积分");
          setCreditTarget(null);
          refresh(creditTarget?.workspace.id);
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
