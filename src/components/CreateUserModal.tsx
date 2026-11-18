import { useRef, useState } from "react";
import { Alert, Form, Input, Modal } from "antd";
import { http } from "@/api/client";
import type { User } from "@/types/domain";

interface UserCreateInput {
  mobile: string;
  nickname?: string;
  password: string;
}

export function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: User, existingIdentity: boolean) => void;
}) {
  const [form] = Form.useForm<UserCreateInput>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function submit(values: UserCreateInput) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const result = await http.post<{ user: User; existing_identity: boolean }>(
        "/admin/users",
        { ...values, mobile: values.mobile.trim(), nickname: values.nickname?.trim() },
      );
      form.resetFields();
      onCreated(result.user, result.existing_identity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败，请稍后重试");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Modal
      open
      title="新增用户"
      okText="创建账号"
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={pending}
      cancelButtonProps={{ disabled: pending }}
      closable={!pending}
      maskClosable={!pending}
      keyboard={!pending}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        message="创建普通用户，可使用初始密码或短信验证码登录。已有账号不会被覆盖，也不会获得后台管理权限。"
        style={{ marginBottom: 16 }}
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={submit} disabled={pending}>
        <Form.Item name="mobile" label="手机号" rules={[
          { required: true, message: "请输入手机号" },
          { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的11位手机号" },
        ]}>
          <Input autoComplete="off" maxLength={11} />
        </Form.Item>
        <Form.Item name="nickname" label="昵称" rules={[{ max: 64, message: "昵称最多64字" }]}>
          <Input placeholder="不填则使用手机号尾号" maxLength={64} />
        </Form.Item>
        <Form.Item name="password" label="初始密码" rules={[
          { required: true, message: "请输入初始密码" },
          { min: 8, max: 128, message: "密码长度为8至128位" },
          { pattern: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)\S+$/, message: "需包含大小写字母和数字，不能含空白" },
        ]}>
          <Input.Password autoComplete="new-password" maxLength={128} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
