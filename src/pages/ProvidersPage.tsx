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
  base_url: string;
  timeout_seconds: number;
  api_key?: string;
  // 勾选「清空 Key」→ 提交 api_key:""(后端据此清空并标记 cleared,不再回退 env)。
  clear_api_key?: boolean;
}

export function ProvidersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ProviderConfigView | null>(null);
  const [form] = Form.useForm<FormValues>();
  const clearKey = Form.useWatch("clear_api_key", form);

  const { data, isFetching, error } = useQuery<ProviderConfigView[], ApiError>({
    queryKey: ["admin", "providers"],
    queryFn: listProviderConfigs,
  });

  useEffect(() => {
    if (editing) {
      form.resetFields();
      form.setFieldsValue({
        base_url: editing.base_url,
        timeout_seconds: editing.timeout_seconds,
        api_key: "",
        clear_api_key: false,
      });
    }
  }, [editing, form]);

  const saveMut = useMutation({
    mutationFn: (v: FormValues) =>
      updateProviderConfig(editing!.provider, {
        base_url: v.base_url,
        timeout_seconds: v.timeout_seconds,
        // 三态:勾选清空 → api_key:"";填了新值 → 覆盖;都没有 → 不传(保留原 key)。
        ...(v.clear_api_key
          ? { api_key: "" }
          : v.api_key && v.api_key.trim()
            ? { api_key: v.api_key.trim() }
            : {}),
      }),
    onSuccess: () => {
      message.success("已更新凭证");
      setEditing(null);
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
      // 勾了「清空」时忽略输入框里可能残留的 key,用已保存的 key 测(与保存语义一致)。
      const usingNewKey = !v.clear_api_key && !!(v.api_key && v.api_key.trim());
      return testProviderConnection(editing!.provider, {
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
      <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
        模型 Provider 配置
      </Typography.Title>

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
        title={`编辑 ${editing?.provider ?? ""} 凭证`}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        destroyOnHidden
        footer={[
          <Button
            key="test"
            loading={testMut.isPending}
            onClick={() => testMut.mutate()}
          >
            测试连接
          </Button>,
          <Button key="cancel" onClick={() => setEditing(null)}>
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
          <Form.Item
            name="base_url"
            label="Base URL"
            rules={[{ required: true, message: "必填" }]}
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
          <Form.Item
            name="timeout_seconds"
            label="超时(秒)"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={600} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
