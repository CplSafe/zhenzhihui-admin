import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Input,
  Space,
  Spin,
  Switch,
  Tag,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProductionNotifyConfig,
  saveProductionNotifyConfig,
  testProductionNotify,
  type ProductionNotifyInput,
} from "@/api/productionNotifications";
import { usePermission } from "@/hooks/usePermission";
import { Permission } from "@/types/admin";

export function ProductionNotifyButton() {
  const [open, setOpen] = useState(false);
  const { has } = usePermission();
  if (!has(Permission.SETTINGS_READ)) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>飞书通知</Button>
      <Drawer
        title="人工制作 · 飞书通知"
        open={open}
        onClose={() => setOpen(false)}
        width={560}
        destroyOnHidden
      >
        {open && <NotifyForm />}
      </Drawer>
    </>
  );
}
function NotifyForm() {
  const [form] = Form.useForm<ProductionNotifyInput>();
  const { has } = usePermission();
  const canWrite = has(Permission.SETTINGS_WRITE);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["production-notify"],
    queryFn: getProductionNotifyConfig,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  useEffect(() => {
    if (query.data)
      form.setFieldsValue({
        enabled: query.data.enabled,
        version: query.data.version,
        admin_origin: query.data.admin_origin || window.location.origin,
        webhook_url: "",
        signing_secret: "",
        clear_signing_secret: false,
      });
  }, [query.data, form]);
  const save = useMutation({
    mutationFn: saveProductionNotifyConfig,
    onSuccess: (data) => {
      qc.setQueryData(["production-notify"], data);
      void message.success("通知配置已保存");
    },
    onError: (error: Error) => void message.error(error.message),
  });
  const test = useMutation({
    mutationFn: testProductionNotify,
    onSuccess: () => void message.success("测试通知已发送，请到飞书群查看"),
    onError: (error: Error) => void message.error(error.message),
  });
  if (query.isPending) return <Spin />;
  if (query.error)
    return (
      <Alert
        type="error"
        title="通知配置加载失败"
        description={query.error.message}
        action={<Button onClick={() => void query.refetch()}>重试</Button>}
      />
    );
  const busy = save.isPending || test.isPending || query.isFetching;
  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!canWrite || busy}
      onFinish={(values) => save.mutate(values)}
    >
      <Alert
        type="info"
        showIcon
        title="T+1、T+5 共用一个机器人"
        description="新任务、T+1 付费修改和 T+5 返工申请会自动通知。启用后只通知新发生的任务，不补发历史任务；已进入发送队列的通知会保留并重试。"
        style={{ marginBottom: 16 }}
      />
      {!canWrite && (
        <Alert
          type="warning"
          title="当前账号只可查看，保存和测试需要系统设置写权限"
          style={{ marginBottom: 16 }}
        />
      )}
      <Form.Item name="version" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="enabled" label="启用任务通知" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Space style={{ marginBottom: 16 }}>
        <Tag color={query.data?.webhook_configured ? "success" : "default"}>
          {query.data?.webhook_configured ? "Webhook 已配置" : "Webhook 未配置"}
        </Tag>
        <Tag>
          {query.data?.signing_configured ? "已配置签名" : "未配置签名"}
        </Tag>
      </Space>
      <Form.Item
        name="webhook_url"
        label="飞书机器人 Webhook"
        extra="仅支持 open.feishu.cn 的自定义机器人地址。留空保留原地址，不会回显凭据。"
        rules={[
          {
            validator: (_, value: string) =>
              !value ||
              /^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9_-]{16,128}$/.test(
                value.trim(),
              )
                ? Promise.resolve()
                : Promise.reject(new Error("请填写正确的飞书机器人 Webhook")),
          },
        ]}
      >
        <Input.Password
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/…"
          autoComplete="new-password"
        />
      </Form.Item>
      <Form.Item
        name="signing_secret"
        label="签名密钥（可选）"
        extra="机器人开启签名校验时填写；留空保留原密钥。"
        rules={[{ max: 256 }]}
      >
        <Input.Password
          placeholder="留空保留原密钥"
          autoComplete="new-password"
        />
      </Form.Item>
      <Form.Item
        name="clear_signing_secret"
        label="清除已有签名密钥"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
      <Form.Item
        name="admin_origin"
        label="后台网站地址"
        extra="通知里将附上对应后台页面链接，请填写当前环境的 HTTPS 域名。"
        rules={[
          { required: true },
          {
            validator: (_, value: string) => {
              try {
                const u = new URL(value);
                if (
                  u.protocol === "https:" &&
                  !u.username &&
                  !u.password &&
                  !u.search &&
                  !u.hash &&
                  (u.pathname === "/" || u.pathname === "")
                )
                  return Promise.resolve();
              } catch {
                /* invalid URL */
              }
              return Promise.reject(
                new Error("请填写 HTTPS 后台域名，不带页面路径"),
              );
            },
          },
        ]}
      >
        <Input placeholder="https://你的后台域名" />
      </Form.Item>
      <Space wrap>
        <Button type="primary" htmlType="submit" loading={save.isPending}>
          保存通知配置
        </Button>
        <Button
          onClick={() => test.mutate()}
          loading={test.isPending}
          disabled={!canWrite || busy || !query.data?.webhook_configured}
        >
          发送测试通知
        </Button>
        <Button onClick={() => void query.refetch()} disabled={busy}>
          重新加载
        </Button>
      </Space>
      <p>测试通知使用已保存的配置，不创建任务、不扣积分。</p>
    </Form>
  );
}
