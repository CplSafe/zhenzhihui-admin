import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Can } from "@/components/Can";
import { Mono } from "@/components/cells";
import {
  listProviderConfigs,
  testProviderConnection,
  updateProviderConfig,
} from "@/api/providers";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { ProviderConfigView } from "@/types/domain";

interface FormValues {
  // provider 名仅在「新增兼容 Provider」时可填;编辑既有 provider 时锁定。
  provider?: string;
  base_url: string;
  timeout_seconds: number;
  api_key?: string;
  // 勾选「清空 Key」→ 提交 api_key:""(后端据此清空并标记 cleared,不再回退 env)。
  clear_api_key?: boolean;
  access_key?: string;
  secret_key?: string;
  project_name?: string;
  region?: string;
}

// 自定义兼容 provider 名规则,与后端 settings.isConfigurableProvider 一致。
const CUSTOM_PROVIDER_RE = /^[a-z0-9-]{2,32}$/;

export function ProvidersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ProviderConfigView | null>(null);
  // creating=true:新增兼容 provider(provider 名可填);否则编辑既有。
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const clearKey = Form.useWatch("clear_api_key", form);
  const open = editing !== null || creating;

  const { data, isFetching, error } = useQuery<ProviderConfigView[], ApiError>({
    queryKey: ["admin", "providers"],
    queryFn: listProviderConfigs,
  });

  useEffect(() => {
    if (editing) {
      form.resetFields();
      form.setFieldsValue({
        provider: editing.provider,
        base_url: editing.base_url,
        timeout_seconds: editing.timeout_seconds,
        api_key: "",
        clear_api_key: false,
        access_key: "",
        secret_key: "",
        project_name: editing.project_name,
        region: editing.region || "cn-beijing",
      });
    } else if (creating) {
      form.resetFields();
      // 新增兼容 provider 的合理默认:超时 60s,其余留空待填。
      form.setFieldsValue({ timeout_seconds: 60, clear_api_key: false });
    }
  }, [editing, creating, form]);

  const closeModal = () => {
    setEditing(null);
    setCreating(false);
  };

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      // 编辑锁定原 provider;新增取表单里填的 provider 名。
      const provider = creating ? (v.provider ?? "").trim() : editing!.provider;
      return updateProviderConfig(provider, {
        base_url: v.base_url,
        timeout_seconds: v.timeout_seconds,
        // 三态:勾选清空 → api_key:"";填了新值 → 覆盖;都没有 → 不传(保留原 key)。
        // 新增场景下用户应当填 key,但即便没填也由后端按"无 key"处理(后续任务会失败提示)。
        ...(v.clear_api_key
          ? { api_key: "" }
          : v.api_key && v.api_key.trim()
            ? { api_key: v.api_key.trim() }
            : {}),
        ...(v.access_key?.trim() ? { access_key: v.access_key.trim() } : {}),
        ...(v.secret_key?.trim() ? { secret_key: v.secret_key.trim() } : {}),
        ...(v.project_name?.trim() ? { project_name: v.project_name.trim() } : {}),
        ...(v.region?.trim() ? { region: v.region.trim() } : {}),
      });
    },
    onSuccess: () => {
      message.success(creating ? "已新增兼容 Provider" : "已更新凭证");
      closeModal();
      qc.invalidateQueries({ queryKey: ["admin", "providers"] });
    },
    onError: (e: unknown) =>
      message.error(e instanceof ApiError ? e.message : "操作失败"),
  });

  // 测试连接:用当前表单值(base_url + 可选新 key)探测,不保存。
  // 注意:key 框留空时后端用「已保存的 key」测;提示运维这一点,避免误以为在测新 key。
  const testMut = useMutation({
    mutationFn: () => {
      const v = form.getFieldsValue();
      const provider = creating ? (v.provider ?? "").trim() : editing!.provider;
      // 勾了「清空」时忽略输入框里可能残留的 key,用已保存的 key 测(与保存语义一致)。
      const usingNewKey = !v.clear_api_key && !!(v.api_key && v.api_key.trim());
      return testProviderConnection(provider, {
        base_url: v.base_url,
        timeout_seconds: v.timeout_seconds,
        ...(usingNewKey ? { api_key: v.api_key!.trim() } : {}),
      }).then((r) => ({ ...r, usingNewKey }));
    },
    onSuccess: (r) => {
      const suffix = r.usingNewKey ? "" : "(用已保存的 Key 测试)";
      const msg = r.message + suffix;
      if (r.ok) {
        message.success(msg);
      } else {
        message.warning(msg);
      }
    },
    onError: (e: unknown) =>
      message.error(e instanceof ApiError ? e.message : "测试失败"),
  });

  const columns: TableColumnsType<ProviderConfigView> = [
    {
      title: "真人素材 AK/SK",
      key: "assetCredentials",
      width: 230,
      render: (_, r) => r.provider === "volcengine" ? (
        <Space size={6}>
          <Tag color={r.access_key_configured ? "green" : "red"}>AK {r.access_key_configured ? "已配置" : "未配置"}</Tag>
          <Tag color={r.secret_key_configured ? "green" : "red"}>SK {r.secret_key_configured ? "已配置" : "未配置"}</Tag>
          {r.access_key_masked && <Mono>{r.access_key_masked}</Mono>}
        </Space>
      ) : <span>-</span>,
    },
    {
      title: "Provider",
      dataIndex: "provider",
      width: 140,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: "Base URL",
      dataIndex: "base_url",
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: "API Key",
      key: "key",
      width: 220,
      render: (_, r) =>
        r.api_key_configured ? (
          <Space size={6}>
            <Tag color="green">已配置</Tag>
            <Mono>{r.api_key_masked}</Mono>
          </Space>
        ) : (
          <Tag color="red">未配置</Tag>
        ),
    },
    {
      title: "超时(秒)",
      dataIndex: "timeout_seconds",
      width: 100,
      render: (v) => <span className="tnum">{v}</span>,
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 90,
      render: (_, r) => (
        <Can permission={Permission.SETTINGS_WRITE} fallback={<span>-</span>}>
          <Button type="link" size="small" onClick={() => setEditing(r)}>
            编辑
          </Button>
        </Can>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
          模型 Provider 配置
        </Typography.Title>
        <Can permission={Permission.SETTINGS_WRITE}>
          <Button type="primary" onClick={() => setCreating(true)}>
            新增兼容 Provider
          </Button>
        </Can>
      </Space>

      <Alert
        type="warning"
        showIcon
        message="密钥安全"
        description="API Key 加密存储,后台只显示掩码,绝不回显明文。修改 Key 需重新输入整串;留空则保留原 Key 不变。配错 base_url / key 会导致对应 provider 的生图任务全部失败。"
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
        <Table<ProviderConfigView>
          rowKey="provider"
          columns={columns}
          dataSource={data ?? []}
          loading={isFetching}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>

      <Modal
        title={
          creating
            ? "新增兼容 Provider"
            : `编辑 ${editing?.provider ?? ""} 凭证`
        }
        open={open}
        onCancel={closeModal}
        destroyOnHidden
        footer={[
          <Button
            key="test"
            loading={testMut.isPending}
            onClick={() => testMut.mutate()}
          >
            测试连接
          </Button>,
          <Button key="cancel" onClick={closeModal}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saveMut.isPending}
            onClick={() => form.submit()}
          >
            保存
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          {creating && (
            <Form.Item
              name="provider"
              label="Provider 名"
              extra="自定义兼容上游标识,小写字母/数字/连字符,如 qwen / deepseek / zhipu。OpenAI 兼容模型用同一份适配器,加模型时填此名即可。"
              rules={[
                { required: true, message: "必填" },
                {
                  pattern: CUSTOM_PROVIDER_RE,
                  message: "2-32 位,仅小写字母、数字、连字符",
                },
              ]}
            >
              <Input placeholder="qwen" />
            </Form.Item>
          )}
          <Form.Item
            name="base_url"
            label="Base URL"
            rules={[{ required: true, message: "必填" }]}
            extra={
              creating
                ? "OpenAI 兼容端点,如阿里百炼:https://dashscope.aliyuncs.com/compatible-mode/v1"
                : undefined
            }
          >
            <Input placeholder="https://api.openai.com" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="API Key"
            extra="留空 = 不修改;填写新值则覆盖。出于安全,此处不回显当前 Key。"
          >
            <Input.Password
              placeholder={clearKey ? "将清空该 Key" : "留空则保留原 Key"}
              autoComplete="new-password"
              disabled={clearKey}
            />
          </Form.Item>
          <Form.Item name="clear_api_key" valuePropName="checked">
            <Checkbox>
              清空该 Provider 的 Key(下线该 provider,不再回退环境变量)
            </Checkbox>
          </Form.Item>
          {editing?.provider === "volcengine" && (
            <>
              <Alert type="info" showIcon style={{ marginBottom: 16 }} message="真人素材库使用 AK/SK 签名" description="与视频生成使用的 Ark API Key 独立。AK 账号需具备方舟 Assets 权限，ProjectName 必须与推理项目一致。" />
              <Form.Item name="access_key" label="AccessKey" extra="留空保留已保存值；后台不会回显明文。">
                <Input.Password autoComplete="new-password" placeholder="留空则保留原 AccessKey" />
              </Form.Item>
              <Form.Item name="secret_key" label="SecretKey" extra="留空保留已保存值；后台不会回显明文。">
                <Input.Password autoComplete="new-password" placeholder="留空则保留原 SecretKey" />
              </Form.Item>
              <Form.Item name="project_name" label="ProjectName" rules={[{ required: true, message: "必填" }]}>
                <Input placeholder="default" />
              </Form.Item>
              <Form.Item name="region" label="Region" rules={[{ required: true, message: "必填" }]}>
                <Input placeholder="cn-beijing" />
              </Form.Item>
            </>
          )}
          <Form.Item
            name="timeout_seconds"
            label="超时(秒)"
            rules={[{ required: true }]}
          >
            {/* 上限 3600s:agent 单轮要塞进多轮搜索结果与子任务汇总,
                输入常达几万 token,600s 对这类长请求不够。
                保留上限是防误填——手滑多打个零会让连接挂几小时。 */}
            <InputNumber min={1} max={3600} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
