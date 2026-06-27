import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Can } from "@/components/Can";
import { EntitlementsField } from "@/components/EntitlementsField";
import type { ModelOption } from "@/components/EntitlementsField";
import { Count, Money, Mono, RowActions, StatusTag } from "@/components/cells";
import {
  createPlan,
  disablePlan,
  enablePlan,
  listPlans,
  updatePlan,
} from "@/api/plans";
import { listModels } from "@/api/models";
import { useResourceCrud } from "@/hooks/useResourceCrud";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { ListPage, ModelVersion, Plan, PlanPeriod } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface FormValues {
  code: string;
  name: string;
  period: PlanPeriod;
  price_cents: number;
  base_credits: number;
  status: string;
  entitlements?: unknown;
}

// 判断套餐是否系统专用 / 注册赠送(从 entitlements_json 读),用于列表打标。
function readEntitlementsFlag(p: Plan, key: string): boolean {
  const e = p.entitlements_json;
  return !!(
    e &&
    typeof e === "object" &&
    (e as Record<string, unknown>)[key] === true
  );
}

export function PlansPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const {
    editId,
    isOpen,
    isEdit,
    openCreate,
    openEdit,
    close,
    onError,
    invalidate,
    enableMut,
    disableMut,
  } = useResourceCrud({
    queryKey: ["admin", "plans"],
    enableFn: enablePlan,
    disableFn: disablePlan,
  });

  const { data, isFetching, error } = useQuery<Plan[], ApiError>({
    queryKey: ["admin", "plans"],
    queryFn: listPlans,
  });

  // 拉模型列表,供「可用模型」下拉选择(value=model 标识,与后端 ensureModelAllowed 匹配)。
  const { data: modelsPage } = useQuery<ListPage<ModelVersion>, ApiError>({
    queryKey: ["admin", "models", "for-plan-options"],
    queryFn: () => listModels({ limit: 200 }),
  });
  const modelOptions: ModelOption[] = (() => {
    const seen = new Map<string, string>();
    for (const m of modelsPage?.items ?? []) {
      if (!m.model || seen.has(m.model)) continue;
      seen.set(m.model, m.display_name || m.model);
    }
    return Array.from(seen, ([value, name]) => ({
      value,
      label: name === value ? value : `${name}（${value}）`,
    }));
  })();

  // entitlements JSON 合法性:非法时禁用保存,避免静默存旧值(见 JsonField)。
  const [entitlementsValid, setEntitlementsValid] = useState(true);
  // 切换编辑目标时在渲染期重置校验态(避免在 effect 里 setState 触发级联渲染)。
  const [prevEditId, setPrevEditId] = useState(editId);
  if (prevEditId !== editId) {
    setPrevEditId(editId);
    setEntitlementsValid(true);
  }

  // 仅在编辑目标(editId)变化时回填表单,不依赖 editing 的对象引用——
  // 否则 invalidate() 刷新列表会换 editing 引用,导致弹窗内未保存的编辑被覆盖回滚。
  useEffect(() => {
    if (editId === 0) {
      form.resetFields();
      form.setFieldsValue({
        period: "month",
        status: "enabled",
        price_cents: 0,
        base_credits: 0,
      });
      return;
    }
    if (editId && editId > 0) {
      const plan = data?.find((p) => p.id === editId);
      if (plan) {
        form.setFieldsValue({
          code: plan.code,
          name: plan.name,
          period: plan.period,
          price_cents: plan.price_cents,
          base_credits: plan.base_credits,
          status: plan.status,
          entitlements: plan.entitlements_json,
        });
      }
    }
    // 只依赖 editId / form:刷新列表(data 变化)不应重置表单。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, form]);

  const saveMut = useMutation({
    mutationFn: (v: FormValues) =>
      isEdit
        ? updatePlan(editId!, {
            name: v.name,
            period: v.period,
            price_cents: v.price_cents,
            base_credits: v.base_credits,
            status: v.status,
            entitlements: v.entitlements,
          })
        : createPlan({
            code: v.code,
            name: v.name,
            period: v.period,
            price_cents: v.price_cents,
            base_credits: v.base_credits,
            status: v.status,
            entitlements: v.entitlements,
          }),
    onSuccess: () => {
      message.success(isEdit ? "已更新套餐" : "已新增套餐");
      close();
      invalidate();
    },
    onError,
  });

  const columns: TableColumnsType<Plan> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 70,
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: "code",
      dataIndex: "code",
      render: (v, r) => (
        <Space size={4}>
          <Mono>{v}</Mono>
          {readEntitlementsFlag(r, "is_trial_grant") && (
            <Tag color="gold">注册赠送</Tag>
          )}
          {readEntitlementsFlag(r, "system_only") && <Tag>系统</Tag>}
        </Space>
      ),
    },
    { title: "名称", dataIndex: "name" },
    { title: "周期", dataIndex: "period", width: 80 },
    {
      title: "价格",
      dataIndex: "price_cents",
      width: 110,
      render: (v) => <Money cents={v} />,
    },
    {
      title: "赠送积分",
      dataIndex: "base_credits",
      width: 110,
      render: (v) => <Count value={v} />,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 180,
      render: (v) => fmtTime(v),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 180,
      render: (_, r) => (
        <RowActions
          status={r.status}
          permission={Permission.PLANS_WRITE}
          onEdit={() => openEdit(r.id)}
          onEnable={() => enableMut.mutate(r.id)}
          onDisable={() => disableMut.mutate(r.id)}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
          套餐管理
        </Typography.Title>
        <Can permission={Permission.PLANS_WRITE}>
          <Button type="primary" onClick={openCreate}>
            新增套餐
          </Button>
        </Can>
      </Space>

      <Alert
        type="info"
        showIcon
        message="套餐权益说明"
        description="权益配置已改为表单填写:档位选「个人版 / 团队版」,可配可用模型、并发、席位、团队/空间上限(后两者仅展示分组,不强制拦截)。开「注册赠送」即设为新用户赠送套餐(最多一条,须同时开「系统专用」),试用天数由 trial_days 控制、赠送积分 = 上方「赠送积分」字段;系统专用套餐必须零价。其余少见字段在「高级权益」里以 JSON 填写。"
      />

      {error && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={error.message}
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Plan>
          rowKey="id"
          columns={columns}
          dataSource={data ?? []}
          loading={isFetching}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>

      <Modal
        title={isEdit ? `编辑套餐 #${editId}` : "新增套餐"}
        open={isOpen}
        onCancel={close}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        okButtonProps={{ disabled: !entitlementsValid }}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: !isEdit, message: "必填" }]}
          >
            <Input placeholder="pro_month" disabled={isEdit} />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: "必填" }]}
          >
            <Input placeholder="专业版月付" />
          </Form.Item>
          <Form.Item name="period" label="周期" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "week", label: "7天" },
                { value: "month", label: "月" },
                { value: "quarter", label: "季度" },
                { value: "year", label: "年" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="price_cents"
            label="价格(分)"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="base_credits"
            label="赠送积分(注册赠送套餐即试用积分)"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "enabled", label: "启用" },
                { value: "disabled", label: "停用" },
              ]}
            />
          </Form.Item>
          <Form.Item name="entitlements" label="权益配置">
            <EntitlementsField
              onValidityChange={setEntitlementsValid}
              modelOptions={modelOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
