import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  createAbility,
  listAbilities,
  updateAbility,
  type AbilityCreateBody,
  type AbilityPatchBody,
} from "@/api/abilities";
import { listAllModels } from "@/api/models";
import { Can } from "@/components/Can";
import { ListPageShell } from "@/components/ListPageShell";
import { Mono, StatusTag } from "@/components/cells";
import { Permission } from "@/types/admin";
import type { BusinessAbility } from "@/types/domain";
import {
  abilityModelOptions,
  fitsAbilityTextLimit,
} from "@/utils/businessAbilities";

// These are the backend's implemented execution bindings, not arbitrary tags.
const DIRECT_OPERATIONS = [
  "image.text_to_image",
  "image.image_to_image",
  "image.upscale",
  "video.upscale",
  "responses.multimodal",
  "prompt.enhance.video",
  "prompt.enhance.image",
  "prompt.enhance.polish",
  "image.face_blur",
  "image.face_detect",
  "video.replicate",
  "video.generate",
  "video.edit",
  "video.extend",
  "agent.chat",
  "audio.speech_to_text",
  "audio.generate",
  "audio.text_to_speech",
];
const TOOL_BINDINGS = [
  ["image.multi_angle", 1, "多角度编辑"],
  ["image.multi_angle", 2, "多角度编辑"],
  ["image.portrait_texture", 1, "人像质感"],
  ["image.portrait_texture", 2, "人像质感"],
  ["image.portrait_emotion", 1, "情绪调节"],
  ["image.panorama", 1, "场景全景"],
  ["image.relight", 1, "打光"],
] as const;
const bindings = [
  ...DIRECT_OPERATIONS.map((operation_code) => ({
    value: operation_code,
    label: `${operation_code}（直接执行）`,
    operation_code,
    tool_code: "",
    tool_version: 0,
  })),
  ...TOOL_BINDINGS.map(([tool_code, tool_version, name]) => ({
    value: `${tool_code}:v${tool_version}`,
    label: `${name} · ${tool_code} v${tool_version}`,
    operation_code: "image.image_to_image",
    tool_code,
    tool_version,
  })),
];

interface AbilityForm {
  code: string;
  display_name: string;
  description: string;
  enabled: boolean;
  binding: string;
  default_model_version_id: number;
}

type SaveInput =
  | { code: string; body: AbilityPatchBody }
  | { code: null; body: AbilityCreateBody };

function AbilityEditor({
  ability,
  saving,
  onSave,
}: {
  ability: BusinessAbility | null;
  saving: boolean;
  onSave: (input: SaveInput) => void;
}) {
  const [form] = Form.useForm<AbilityForm>();
  const models = useQuery({
    queryKey: ["admin", "models", "all"],
    queryFn: listAllModels,
    enabled: ability !== null,
    staleTime: 0,
  });
  const binding = ability?.tool_code
    ? `${ability.tool_code}:v${ability.tool_version}`
    : ability?.operation_code;
  const candidates = ability
    ? abilityModelOptions(ability, models.data ?? [])
    : [];
  // Keep a stale/disabled current default visible and clearable instead of showing
  // an unlabeled numeric ID or silently overwriting it during unrelated edits.
  if (
    ability?.default_model_version_id &&
    !candidates.some(
      (option) => option.value === ability.default_model_version_id,
    )
  ) {
    candidates.push({
      value: ability.default_model_version_id,
      label: `#${ability.default_model_version_id}（当前默认，已不可用，请重新选择或清除）`,
      disabled: true,
    });
  }
  return (
    <Form
      form={form}
      layout="vertical"
      disabled={saving}
      initialValues={{
        code: ability?.code ?? "",
        display_name: ability?.display_name ?? "",
        description: ability?.description ?? "",
        enabled: ability?.enabled ?? true,
        binding,
        default_model_version_id: ability?.default_model_version_id ?? 0,
      }}
      onFinish={(values) => {
        const editable = {
          display_name: values.display_name.trim(),
          description: values.description.trim(),
          enabled: values.enabled,
        };
        if (ability) {
          const body: AbilityPatchBody = { ...editable };
          if (
            values.default_model_version_id !== ability.default_model_version_id
          )
            body.default_model_version_id = values.default_model_version_id;
          onSave({ code: ability.code, body });
        } else {
          const selected = bindings.find(
            (option) => option.value === values.binding,
          );
          if (selected)
            onSave({
              code: null,
              body: {
                ...editable,
                code: values.code.trim(),
                operation_code: selected.operation_code,
                tool_code: selected.tool_code,
                tool_version: selected.tool_version,
                default_model_version_id: 0,
              },
            });
        }
      }}
    >
      <Alert
        type="info"
        showIcon
        title="能力代码与执行绑定创建后不可修改"
        style={{ marginBottom: 20 }}
        description={
          <>
            先创建能力，再到<Link to="/models">模型配置</Link>
            勾选可使用的模型，最后回到这里设置默认模型。
          </>
        }
      />
      <Form.Item
        name="code"
        label="能力代码"
        rules={[
          { required: true, whitespace: true },
          {
            pattern: /^[a-z][a-z0-9_.-]{0,63}$/,
            message:
              "使用小写字母开头，仅限小写字母、数字、点、短横线和下划线（最多 64 位）",
          },
        ]}
      >
        <Input
          disabled={!!ability || saving}
          maxLength={64}
          placeholder="如 relight"
        />
      </Form.Item>
      <Form.Item
        name="display_name"
        label="显示名称"
        rules={[
          { required: true, whitespace: true, message: "请输入显示名称" },
          {
            validator: (_, value: string) =>
              fitsAbilityTextLimit("name", value)
                ? Promise.resolve()
                : Promise.reject(
                    new Error("显示名称最多 128 字节（约 42 个汉字）"),
                  ),
          },
        ]}
      >
        <Input maxLength={128} placeholder="如 打光" />
      </Form.Item>
      <Form.Item
        name="description"
        label="说明"
        rules={[
          {
            validator: (_, value: string) =>
              fitsAbilityTextLimit("description", value)
                ? Promise.resolve()
                : Promise.reject(new Error("说明最多 4096 字节")),
          },
        ]}
      >
        <Input.TextArea rows={3} maxLength={2000} showCount />
      </Form.Item>
      <Form.Item
        name="binding"
        label="执行绑定"
        rules={[{ required: true, message: "请选择已实现的操作或工具" }]}
      >
        <Select
          disabled={!!ability || saving}
          showSearch
          optionFilterProp="label"
          options={bindings}
          placeholder="选择操作或工具版本"
        />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked">
        <Switch />
      </Form.Item>
      {models.isError && (
        <Alert
          type="error"
          showIcon
          title="候选模型加载失败"
          description={models.error.message}
          action={<Button onClick={() => models.refetch()}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form.Item
        name="default_model_version_id"
        label="默认模型"
        extra="仅可选择已分配该能力且支持执行操作的模型；此处会读取全部模型分页。停用能力不会自动启用模型。"
      >
        <Select
          loading={!!ability && models.isFetching}
          disabled={
            !ability ||
            models.isPending ||
            models.isError ||
            models.isFetching ||
            saving
          }
          showSearch
          optionFilterProp="label"
          options={[{ value: 0, label: "不设置默认模型" }, ...candidates]}
        />
      </Form.Item>
      <Space style={{ width: "100%", justifyContent: "flex-end" }}>
        <Button type="primary" htmlType="submit" loading={saving}>
          保存
        </Button>
      </Space>
    </Form>
  );
}

export function AbilitiesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BusinessAbility | null | undefined>();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<boolean | undefined>();
  const abilities = useQuery({
    queryKey: ["admin", "abilities"],
    queryFn: listAbilities,
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "abilities"] });
  const onError = (error: Error) => message.error(error.message || "操作失败");
  const save = useMutation({
    mutationFn: (input: SaveInput) =>
      input.code === null
        ? createAbility(input.body)
        : updateAbility(input.code, input.body),
    onSuccess: () => {
      message.success("业务能力已保存");
      setEditing(undefined);
      invalidate();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (ability: BusinessAbility) =>
      updateAbility(ability.code, { enabled: !ability.enabled }),
    onSuccess: () => {
      message.success("能力状态已更新");
      invalidate();
    },
    onError,
  });
  const columns: TableColumnsType<BusinessAbility> = [
    {
      title: "能力代码",
      dataIndex: "code",
      render: (code) => <Mono>{code}</Mono>,
    },
    { title: "显示名称", dataIndex: "display_name" },
    {
      title: "说明",
      dataIndex: "description",
      width: 260,
      render: (value) => (
        <Typography.Paragraph
          ellipsis={{ rows: 2, tooltip: value }}
          style={{ margin: 0 }}
        >
          {value || "—"}
        </Typography.Paragraph>
      ),
    },
    {
      title: "执行操作",
      dataIndex: "operation_code",
      render: (value) => <Mono>{value}</Mono>,
    },
    {
      title: "工具版本",
      render: (_, ability) =>
        ability.tool_code
          ? `${ability.tool_code} v${ability.tool_version}`
          : "直接执行",
    },
    {
      title: "默认模型",
      dataIndex: "default_model_version_id",
      render: (id) => (id ? <Mono>#{id}</Mono> : "未设置"),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      render: (enabled) => (
        <StatusTag status={enabled ? "enabled" : "disabled"} />
      ),
    },
    {
      title: "操作",
      fixed: "right",
      width: 150,
      render: (_, ability) => (
        <Can permission={Permission.MODELS_WRITE} fallback="—">
          <Space size="small">
            <Button
              type="link"
              size="small"
              disabled={toggle.isPending}
              onClick={() => setEditing(ability)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger={ability.enabled}
              loading={
                toggle.isPending && toggle.variables?.code === ability.code
              }
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(ability)}
            >
              {ability.enabled ? "停用" : "启用"}
            </Button>
          </Space>
        </Can>
      ),
    },
  ];
  const visible = (abilities.data ?? []).filter(
    (ability) =>
      (status === undefined || status === ability.enabled) &&
      `${ability.code} ${ability.display_name} ${ability.description}`
        .toLowerCase()
        .includes(keyword.toLowerCase()),
  );
  return (
    <>
      <ListPageShell
        title="业务能力"
        rowKey="code"
        columns={columns}
        dataSource={visible}
        loading={abilities.isPending}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        filters={
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space wrap>
              <Input.Search
                allowClear
                placeholder="搜索代码、名称或说明"
                onSearch={setKeyword}
                style={{ width: 260 }}
              />
              <Select
                allowClear
                placeholder="启用状态"
                onChange={setStatus}
                style={{ width: 140 }}
                options={[
                  { value: true, label: "已启用" },
                  { value: false, label: "已停用" },
                ]}
              />
              <Button
                onClick={() => abilities.refetch()}
                loading={abilities.isFetching}
              >
                刷新
              </Button>
            </Space>
            <Can permission={Permission.MODELS_WRITE}>
              <Button type="primary" onClick={() => setEditing(null)}>
                新增能力
              </Button>
            </Can>
          </Space>
        }
      />
      {abilities.isError && (
        <Alert
          type="error"
          showIcon
          title="业务能力加载失败"
          description={abilities.error.message}
          action={<Button onClick={() => abilities.refetch()}>重试</Button>}
        />
      )}
      <Drawer
        title={editing ? `编辑能力 · ${editing.display_name}` : "新增业务能力"}
        width={560}
        open={editing !== undefined}
        destroyOnHidden
        closable={!save.isPending}
        maskClosable={!save.isPending}
        keyboard={!save.isPending}
        onClose={() => {
          if (!save.isPending) setEditing(undefined);
        }}
      >
        {editing !== undefined && (
          <AbilityEditor
            key={editing?.code ?? "create"}
            ability={editing}
            saving={save.isPending}
            onSave={(input) => save.mutate(input)}
          />
        )}
      </Drawer>
    </>
  );
}
