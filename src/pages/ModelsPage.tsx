import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Collapse,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Upload,
} from "antd";
import type { TableColumnsType, UploadProps } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { JsonField } from "@/components/JsonField";
import { PricingField } from "@/components/PricingField";
import { SystemPromptsField } from "@/components/SystemPromptsField";
import { Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import {
  createModel,
  disableModel,
  enableModel,
  getModel,
  listModels,
  testModelConnection,
  updateModel,
  uploadModelLogo,
  type ModelWriteBody,
  type TestConnectionResult,
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

// logo 用 contain 而不是 cover:厂商 logo 常带留白且比例不一,裁切会切掉字。
const LOGO_THUMB = { width: 32, height: 32, objectFit: "contain" as const };
const LOGO_PREVIEW = { width: 40, height: 40, objectFit: "contain" as const };

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
  // 测连通结果(回复 + token + 扣费预览),切换编辑目标时清空。
  const [probe, setProbe] = useState<TestConnectionResult | null>(null);
  const [form] = Form.useForm<ModelWriteBody>();
  // system_prompts 的 opcode 下拉来源:跟随表单里已填的 operation_codes。
  const watchedOps = Form.useWatch("operation_codes", form);
  const watchedCapability = Form.useWatch("capability", form);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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
    setProbe(null);
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
        logo_url: d.logo_url,
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

  // 测连通:对已保存模型真实发一条 chat,回显模型回复 + token + 扣费预览。
  const testMut = useMutation({
    mutationFn: () =>
      testModelConnection(editId as number, {
        operation_code: form.getFieldValue("operation_codes")?.[0],
        prompt: "你好",
      }),
    onSuccess: (r) => setProbe(r),
    onError: (e: unknown) => {
      setProbe(null);
      message.error(e instanceof ApiError ? e.message : "测连通失败");
    },
  });

  // 上传 logo:成功后把返回的公开 URL 写回表单(运营也可以完全不上传、直接粘外部 URL)。
  const beforeUploadLogo: UploadProps["beforeUpload"] = async (file) => {
    // 客户端预校验(服务端才是权威闸门,这里给运营即时反馈,挡明显错误)。
    const f = file as File;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (f.type && !allowed.includes(f.type)) {
      message.error("logo 仅支持 JPEG/PNG/WebP/GIF 图片");
      return Upload.LIST_IGNORE;
    }
    const maxBytes = 10 * 1024 * 1024; // 10MB,与后端一致
    if (f.size > maxBytes) {
      message.error("文件超过 10MB,请压缩后再上传");
      return Upload.LIST_IGNORE;
    }
    setUploadingLogo(true);
    try {
      const res = await uploadModelLogo(f);
      form.setFieldsValue({ logo_url: res.logo_url });
      message.success("logo 已上传");
    } catch (e) {
      message.error(
        e instanceof ApiError ? e.message : "上传失败,可改为直接填写 URL",
      );
    } finally {
      setUploadingLogo(false);
    }
    return false; // 阻止 antd 默认上传行为,完全自管。
  };

  const columns: TableColumnsType<ModelVersion> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 70,
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: "Logo",
      dataIndex: "logo_url",
      width: 80,
      render: (v: string | undefined) =>
        v ? <img src={v} alt="logo" style={LOGO_THUMB} /> : <span>-</span>,
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
            {isEdit && (
              <Button
                loading={testMut.isPending}
                onClick={() => testMut.mutate()}
              >
                测连通
              </Button>
            )}
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
        {probe && (
          <Alert
            type="success"
            showIcon
            closable
            onClose={() => setProbe(null)}
            style={{ marginBottom: 16 }}
            message="连通成功"
            description={
              <div>
                <div style={{ marginBottom: 4 }}>
                  模型回复:{probe.reply || "(空)"}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  输入 {probe.prompt_tokens} token · 输出{" "}
                  {probe.completion_tokens} token · 本次约扣{" "}
                  {probe.estimated_credits} 积分(测连通不实际扣费)
                </div>
              </div>
            }
          />
        )}
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
          <Form.Item
            name="logo_url"
            label="厂商 Logo(选填)"
            extra="点上传到对象存储自动回填,或直接粘贴模型官方 logo 的图片 URL。"
          >
            <Input placeholder="https://cdn.example.com/logos/volcengine.png" />
          </Form.Item>
          <Form.Item label=" " colon={false}>
            <Space align="center">
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={beforeUploadLogo}
              >
                <Button icon={<UploadOutlined />} loading={uploadingLogo}>
                  上传 Logo
                </Button>
              </Upload>
              {/* 预览只订阅 logo_url:用 useWatch 会让整个抽屉(含多个 JSON 编辑器)逐键重渲染。 */}
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.logo_url !== cur.logo_url}
              >
                {({ getFieldValue }) => {
                  const url = getFieldValue("logo_url");
                  return url ? (
                    <img src={url} alt="logo 预览" style={LOGO_PREVIEW} />
                  ) : null;
                }}
              </Form.Item>
            </Space>
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
          <Form.Item
            name="pricing"
            label="计价(按千 token 积分单价;视频也按 token,只填一个单价)"
          >
            <PricingField
              capability={watchedCapability}
              onValidityChange={setFieldValid("pricing")}
            />
          </Form.Item>
          <Form.Item
            name="system_prompts"
            label="系统提示词(按操作码配置,后端注入、前端不可覆盖)"
          >
            <SystemPromptsField operationCodes={watchedOps ?? []} />
          </Form.Item>
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: "adv",
                label:
                  "高级设置(参数 / 结果 schema,选填 — 对话模型一般无需填写)",
                children: (
                  <>
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
                      style={{ marginBottom: 0 }}
                    >
                      <JsonField
                        rows={6}
                        onValidityChange={setFieldValid("result_schema")}
                      />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>
    </>
  );
}
