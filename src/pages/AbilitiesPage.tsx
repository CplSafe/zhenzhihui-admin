import { useEffect, useState } from "react";
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
  DIRECT_OPERATIONS,
  operationCategory,
  abilityModelOptions,
  fitsAbilityTextLimit,
} from "@/utils/businessAbilities";

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
    execution_operation_code: operation_code,
    tool_code: "",
    tool_version: 0,
  })),
  ...TOOL_BINDINGS.map(([tool_code, tool_version, name]) => ({
    value: `${tool_code}:v${tool_version}`,
    label: `${name} · ${tool_code} v${tool_version}`,
    execution_operation_code: "image.image_to_image",
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
  operation_code: string;
  default_model_version_id: number;
}

type SaveInput =
  | { code: string; body: AbilityPatchBody }
  | { code: null; body: AbilityCreateBody };

function AbilityEditor({
  ability,
  abilities,
  saving,
  onSave,
}: {
  ability: BusinessAbility | null;
  abilities: BusinessAbility[];
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
    : ability?.execution_operation_code || ability?.operation_code;
  const watchedBinding = Form.useWatch("binding", form);
  const watchedOperation = Form.useWatch("operation_code", form);
  const watchedDefault = Form.useWatch("default_model_version_id", form);
  const selectedDefault =
    watchedDefault ?? ability?.default_model_version_id ?? 0;
  const selectedBinding = bindings.find(
    (option) => option.value === (watchedBinding ?? binding),
  );
  const pendingAbility =
    ability && selectedBinding
      ? {
          ...ability,
          operation_code: (watchedOperation ?? ability.operation_code).trim(),
          execution_operation_code: selectedBinding.execution_operation_code,
          tool_code: selectedBinding.tool_code,
          tool_version: selectedBinding.tool_version,
        }
      : null;
  const pendingDefinitions = pendingAbility
    ? abilities.map((definition) =>
        definition.code === pendingAbility.code ? pendingAbility : definition,
      )
    : abilities;
  const candidates = pendingAbility
    ? abilityModelOptions(
        pendingAbility,
        models.data ?? [],
        pendingDefinitions,
        ability?.operation_code,
      )
    : [];
  // Keep a stale/disabled current default visible and clearable instead of showing
  // an unlabeled numeric ID or silently overwriting it during unrelated edits.
  if (
    selectedDefault &&
    !candidates.some((option) => option.value === selectedDefault)
  ) {
    candidates.push({
      value: selectedDefault,
      label: `#${selectedDefault}（当前默认，已不可用，请重新选择或清除）`,
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
        operation_code: ability?.operation_code ?? "",
        default_model_version_id: ability?.default_model_version_id ?? 0,
      }}
      onFinish={(values) => {
        const selected = bindings.find(
          (option) => option.value === values.binding,
        );
        if (!selected) return;
        const editable = {
          operation_code: values.operation_code.trim(),
          execution_operation_code: selected.execution_operation_code,
          tool_code: selected.tool_code,
          tool_version: selected.tool_version,
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
          onSave({
            code: null,
            body: {
              ...editable,
              code: values.code.trim(),
              default_model_version_id: 0,
            },
          });
        }
      }}
    >
      <Alert
        type="info"
        showIcon
        title="业务操作码与技术执行绑定可分别编辑"
        style={{ marginBottom: 20 }}
        description={
          <>
            业务操作码是前端查询与调用时使用的唯一标识，可自由命名。修改后请同步调用方；后端会自动更新模型中声明的旧操作码，技术执行绑定保持原选择。修改技术绑定时，所有已分配模型与默认模型都必须兼容。模型分配可在
            <Link to="/models">模型配置</Link>中调整。
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
        name="operation_code"
        label="业务操作码 (operation_code)"
        extra="任意唯一名称，去除首尾空白后不可为空，最多 128 字节；无需使用 image 等前缀。"
        rules={[
          { required: true, whitespace: true, message: "请输入业务操作码" },
          {
            validator: (_, value: string) =>
              fitsAbilityTextLimit("operation", value)
                ? Promise.resolve()
                : Promise.reject(new Error("业务操作码最多 128 字节")),
          },
        ]}
      >
        <Input maxLength={128} placeholder="如 brand/lighting 或 图片打光" />
      </Form.Item>
      <Form.Item
        name="binding"
        label="技术执行绑定"
        rules={[{ required: true, message: "请选择已实现的操作或工具" }]}
      >
        <Select
          disabled={saving}
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
        extra="按当前业务操作码与技术执行绑定筛选已分配模型，并读取全部分页。修改绑定后不兼容的原默认会保留，需明确清除或重选；停用模型会标注状态。"
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

export function AbilitiesPage({ onBusyChange }: { onBusyChange?: (busy: boolean) => void } = {}) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BusinessAbility | null | undefined>();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string>();
  const [status, setStatus] = useState<boolean | undefined>();
  const abilities = useQuery({
    queryKey: ["admin", "abilities"],
    queryFn: listAbilities,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "abilities"] });
    qc.invalidateQueries({ queryKey: ["admin-models-list"] });
    qc.invalidateQueries({ queryKey: ["admin", "model"] });
    qc.invalidateQueries({ queryKey: ["admin", "models", "all"] });
  };
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
  useEffect(() => { onBusyChange?.(save.isPending || toggle.isPending); }, [save.isPending, toggle.isPending, onBusyChange]);
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
      title: "业务操作码",
      dataIndex: "operation_code",
      render: (value) => <Mono>{value}</Mono>,
    },
    {
      title: "技术执行操作",
      dataIndex: "execution_operation_code",
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
      (category === undefined || operationCategory(ability) === category) &&
      (status === undefined || status === ability.enabled) &&
      `${ability.code} ${ability.operation_code} ${ability.display_name} ${ability.description}`
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
              <Select allowClear placeholder="全部类型" value={category} onChange={setCategory} style={{width:140}}
                options={[{value:"image",label:"图片"},{value:"video",label:"视频"},{value:"audio",label:"音频"},{value:"dialog",label:"对话"},{value:"prompt",label:"提示词"}]} />
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
            abilities={abilities.data ?? []}
            saving={save.isPending}
            onSave={(input) => save.mutate(input)}
          />
        )}
      </Drawer>
    </>
  );
}
