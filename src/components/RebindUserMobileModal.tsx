import { App, Form, Input, Modal, Typography } from "antd";
import { useState } from "react";
import { rebindUserMobile } from "@/api/admin";
import { ApiError } from "@/types/api";
import type { User } from "@/types/domain";

export function RebindUserMobileModal({
  user,
  onClose,
  onRebound,
}: {
  user: User;
  onClose: () => void;
  onRebound: () => void;
}) {
  const [form] = Form.useForm<{ mobile: string }>();
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  async function submit({ mobile }: { mobile: string }) {
    if (saving) return;
    setSaving(true);
    try {
      await rebindUserMobile(user.id, user.mobile ?? "", mobile.trim());
      void message.success("手机号已换绑");
      onRebound();
    } catch (error) {
      form.setFields([{
        name: "mobile",
        errors: [error instanceof ApiError ? error.message : "换绑结果暂未确认，请用同一号码重试"],
      }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="换绑手机号"
      okText="确认换绑"
      confirmLoading={saving}
      closable={!saving}
      keyboard={!saving}
      mask={{ closable: false }}
      cancelButtonProps={{ disabled: saving }}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Typography.Paragraph>
        {user.nickname || "用户"}（ID {user.id}） · 当前手机号 {user.mobile || "未绑定"}
      </Typography.Paragraph>
      <Typography.Paragraph>确认后，用户可使用新号码登录原账号。</Typography.Paragraph>
      <Form form={form} layout="vertical" disabled={saving} onFinish={(values) => void submit(values)}>
        <Form.Item
          name="mobile"
          label="新手机号"
          rules={[
            { required: true, whitespace: true, message: "请输入新手机号" },
            { pattern: /^1[3-9][0-9]{9}$/, transform: (value: string | undefined) => value?.trim(), message: "请输入有效的中国大陆手机号" },
            { validator: (_, value: string | undefined) => value?.trim() === user.mobile
              ? Promise.reject(new Error("新手机号须与原号码不同"))
              : Promise.resolve() },
          ]}
        >
          <Input inputMode="tel" autoComplete="off" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
