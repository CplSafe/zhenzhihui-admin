import { useEffect, useState } from "react";
import { App, Button, Drawer, Form, Input, Select, Space, Switch } from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { JsonField } from "@/components/JsonField";
import { Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import {
  createModel,
  disableModel,
  enableModel,
  getModel,
  listModels,
  updateModel,
  type ModelWriteBody,
} from "@/api/models";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { ModelVersion } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface Filters {
  provider?: string;
  enabled?: string;
}

const TASK_MODE_OPTIONS = [
  { value: "sync", label: "sync 同步" },
  { value: "async", label: "async 异步" },
  { value: "both", label: "both 两者" },
];

const CAPABILITY_OPTIONS = [
  { value: "responses", label: "responses 对话" },
  { value: "image", label: "image 图像" },
  { value: "video", label: "video 视频" },
];

export function ModelsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  // editId: null=未开抽屉, 0=新增, >0=编辑该 ID
  const [editId, setEditId] = useState<number | null>(null);
  const [form] = Form.useForm<ModelWriteBody>();
  // 各 JSON 字段合法性;任一非法则禁用保存,避免非法 JSON 静默存旧值(见 JsonField)。
  const [jsonValid, setJsonValid] = useState<Record<string, boolean>>({});
  const allJsonValid = Object.values(jsonValid).every(Boolean);
  const setFieldValid = (field: string) => (valid: boolean) =>
    setJsonValid((m) => ({ ...m, [field]: valid }));

  const { items, loading, error, pagination, refetch } = usePagedList<
    ModelVersion,
    Filters
  >({
    queryKey: "admin-models-list",
    filters,
    fetcher: listModels,
  });

  // 编辑模式拉详情(含 system_prompts 等结构化字段)回填表单。
  const detail = useQuery<ModelVersion, ApiError>({
    queryKey: ["admin", "model", editId],
    queryFn: () => getModel(editId as number),
    enabled: editId !== null && editId > 0,
  });

  // 切换编辑目标时在渲染期清空 JSON 校验态(避免在 effect 里 setState)。
  const [prevEditId, setPrevEditId] = useState(editId);
  if (prevEditId !== editId) {
    setPrevEditId(editId);
    setJsonValid({});
  }

  // 编辑回填:editId 切换或详情首次到达时填表单。
  // 当前 detail 查询在抽屉打开期间不会被 invalidate(refetchOnWindowFocus 全局关闭),
  // 故不会用刷新数据覆盖未保存编辑;若将来给该查询加 invalidate,需改为"每目标只填一次"。
  useEffect(() => {
    if (editId === 0) {
      form.resetFields();
      form.setFieldsValue({ enabled: true, task_mode: "sync" });
      return;
    }
    if (editId && editId > 0 && detail.data) {
      const d = detail.data;
      form.setFieldsValue({
        provider: d.provider,
        model: d.model,
        version: d.version,
        display_name: d.display_name,
        capability: d.capability,
        enabled: d.enabled,
        task_mode: d.task_mode,
        allowed_plans: d.allowed_plans,
        operation_codes: d.operation_codes,
        pricing: d.pricing,
        params_schema: d.params_schema,
        result_schema: d.result_schema,
        system_prompts: d.system_prompts,
      });
    }
  }, [editId, detail.data, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-models-list"] });
    refetch();
  };

  const onError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : "操作失败");

  const saveMut = useMutation({
    mutationFn: (body: ModelWriteBody) =>
      editId && editId > 0 ? updateModel(editId, body) : createModel(body),
    onSuccess: () => {
      message.success(editId && editId > 0 ? "已更新模型" : "已新增模型");
      setEditId(null);
      invalidate();
    },
    onError,
  });

  const enableMut = useMutation({
    mutationFn: enableModel,
    onSuccess: () => {
      message.success("已启用");
      invalidate();
    },
    onError,
  });

  const disableMut = useMutation({
    mutationFn: disableModel,
    onSuccess: () => {
      message.success("已停用");
      invalidate();
    },
    onError,
  });

  const columns: TableColumnsType<ModelVersion> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 70,
      render: (v) => <Mono>{v}</Mono>,
    },
    { title: "展示名", dataIndex: "display_name" },
    { title: "provider", dataIndex: "provider", width: 110 },
    { title: "model", dataIndex: "model", width: 140 },
    { title: "version", dataIndex: "version", width: 150 },
    { title: "能力", dataIndex: "capability", width: 110 },
    { title: "模式", dataIndex: "task_mode", width: 90 },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 90,
      render: (v: boolean) => <StatusTag status={v ? "enabled" : "disabled"} />,
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
        <Can permission={Permission.MODELS_WRITE} fallback={<span>-</span>}>
          <Space size="small">
            <Button type="link" size="small" onClick={() => setEditId(r.id)}>
              编辑
            </Button>
            {r.enabled ? (
              <Button
                type="link"
                size="small"
                danger
                onClick={() => disableMut.mutate(r.id)}
              >
                停用
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                onClick={() => enableMut.mutate(r.id)}
              >
                启用
              </Button>
            )}
          </Space>
        </Can>
      ),
    },
  ];

  const isEdit = editId !== null && editId > 0;

  return (
    <>
      <ListPageShell<ModelVersion>
        title="模型配置"
        filters={
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space wrap>
              <Select
                allowClear
                placeholder="provider"
                style={{ width: 160 }}
                options={[
                  { value: "openai", label: "openai" },
                  { value: "volcengine", label: "volcengine" },
                  { value: "bailian", label: "bailian" },
                ]}
                onChange={(v) => setFilters((f) => ({ ...f, provider: v }))}
              />
              <Select
                allowClear
                placeholder="启用状态"
                style={{ width: 140 }}
                options={[
                  { value: "true", label: "已启用" },
                  { value: "false", label: "已停用" },
                ]}
                onChange={(v) => setFilters((f) => ({ ...f, enabled: v }))}
              />
            </Space>
            <Can permission={Permission.MODELS_WRITE}>
              <Button type="primary" onClick={() => setEditId(0)}>
                新增模型
              </Button>
            </Can>
          </Space>
        }
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        error={error}
        pagination={pagination}
      />

      <Drawer
        title={isEdit ? `编辑模型 #${editId}` : "新增模型"}
        width={720}
        open={editId !== null}
        onClose={() => setEditId(null)}
        loading={isEdit && detail.isFetching}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setEditId(null)}>取消</Button>
            <Button
              type="primary"
              loading={saveMut.isPending}
              disabled={!allJsonValid}
              onClick={() => form.submit()}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item
            name="provider"
            label="Provider"
            rules={[{ required: !isEdit, message: "必填" }]}
          >
            <Input placeholder="volcengine" />
          </Form.Item>
          <Form.Item
            name="model"
            label="Model"
            rules={[{ required: !isEdit, message: "必填" }]}
          >
            <Input placeholder="seedance" />
          </Form.Item>
          <Form.Item
            name="version"
            label="Version"
            rules={[{ required: !isEdit, message: "必填" }]}
          >
            <Input placeholder="seedance-2.0" />
          </Form.Item>
          <Form.Item name="display_name" label="展示名">
            <Input placeholder="Seedance 2.0" />
          </Form.Item>
          <Form.Item name="capability" label="能力">
            <Select options={CAPABILITY_OPTIONS} placeholder="选择能力" />
          </Form.Item>
          <Form.Item name="task_mode" label="任务模式">
            <Select options={TASK_MODE_OPTIONS} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allowed_plans" label="允许的套餐 (plan code)">
            <Select mode="tags" placeholder="回车输入,如 pro / enterprise" />
          </Form.Item>
          <Form.Item name="operation_codes" label="操作码 (operation_codes)">
            <Select
              mode="tags"
              placeholder="如 video.text_to_video / video.image_to_video"
            />
          </Form.Item>
          <Form.Item name="pricing" label="计价 (pricing JSON)">
            <JsonField rows={6} onValidityChange={setFieldValid("pricing")} />
          </Form.Item>
          <Form.Item
            name="params_schema"
            label="参数 schema (params_schema JSON)"
          >
            <JsonField
              rows={8}
              onValidityChange={setFieldValid("params_schema")}
            />
          </Form.Item>
          <Form.Item
            name="result_schema"
            label="结果 schema (result_schema JSON)"
          >
            <JsonField
              rows={6}
              onValidityChange={setFieldValid("result_schema")}
            />
          </Form.Item>
          <Form.Item
            name="system_prompts"
            label="系统提示词 (system_prompts JSON,op_code → prompt)"
          >
            <JsonField
              rows={6}
              placeholder='{ "responses.chat": "..." }'
              onValidityChange={setFieldValid("system_prompts")}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
