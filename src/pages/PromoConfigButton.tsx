import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPromoConfig, savePromoConfig, type PromoConfig } from "@/api/promo";
import { usePermission } from "@/hooks/usePermission";
import { Permission } from "@/types/admin";

export function PromoConfigButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>功能配置</Button>
      <Drawer
        title="T+5 功能配置"
        open={open}
        onClose={() => setOpen(false)}
        width={640}
        destroyOnHidden
      >
        {open && <ConfigForm />}
      </Drawer>
    </>
  );
}
function ConfigForm() {
  const [form] = Form.useForm<PromoConfig>();
  const { message } = App.useApp();
  const { has } = usePermission();
  const canSave = has(Permission.SETTINGS_WRITE);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["promo-config"],
    queryFn: getPromoConfig,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (query.data) form.setFieldsValue(query.data);
  }, [query.data, form]);
  const save = useMutation({
    mutationFn: savePromoConfig,
    onSuccess: (data) => {
      qc.setQueryData(["promo-config"], data);
      void message.success("配置已保存，已有订单保持原报价和规则");
    },
    onError: (error: Error) => void message.error(error.message),
  });
  if (query.isPending) return <Spin />;
  if (query.error)
    return (
      <Alert
        type="error"
        title="配置加载失败"
        description={query.error.message}
        action={<Button onClick={() => void query.refetch()}>重试</Button>}
      />
    );
  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!canSave || save.isPending || query.isFetching}
      onFinish={(values) => save.mutate(values)}
    >
      <Alert
        type="info"
        showIcon
        title="单价按积分/秒填写；总价 = 单价 × 时长 × 总价系数。保存后新订单使用新规则，已有订单保留快照。"
        style={{ marginBottom: 16 }}
      />
      {!canSave && (
        <Typography.Paragraph type="secondary">
          当前账号仅可查看，保存需要系统设置权限。
        </Typography.Paragraph>
      )}
      <Form.Item
        name="entry_name"
        label="入口名称"
        rules={[{ required: true, whitespace: true, max: 100 }]}
      >
        <Input maxLength={100} />
      </Form.Item>
      {(
        [
          ["enabled", "开放新订单"],
          ["tag_enabled", "显示 T+5 标签"],
          ["price_show", "显示价格"],
          ["offline_fallback", "允许线下补交素材"],
        ] as const
      ).map(([name, label]) => (
        <Form.Item key={name} name={name} label={label} valuePropName="checked">
          <Switch />
        </Form.Item>
      ))}
      <Form.Item
        name="base_rate"
        label="基础单价（积分/秒）"
        dependencies={["enabled"]}
        rules={[
          { required: true },
          {
            validator: (_, value) =>
              form.getFieldValue("enabled") && !(value > 0)
                ? Promise.reject(new Error("开放前必须配置大于 0 的积分单价"))
                : Promise.resolve(),
          },
        ]}
      >
        <InputNumber min={0} max={100000} precision={3} />
      </Form.Item>
      <Form.Item
        name="multiplier_bps"
        label="总价系数（10000 = 1 倍，15000 = 1.5 倍）"
        rules={[{ required: true }]}
      >
        <InputNumber min={10000} max={100000} precision={0} />
      </Form.Item>
      {(
        [
          ["sla_days", "首次交付（自然日）", 1, 60],
          ["rework_window_days", "交付后可申请返工（自然日）", 1, 30],
          ["rework_days", "返工期限（首次交付日后自然日）", 1, 30],
          ["max_files", "最大素材数量", 3, 500],
          ["wip_alert", "在制订单提醒阈值", 1, Number.MAX_SAFE_INTEGER],
        ] as const
      ).map(([name, label, min, max]) => (
        <Form.Item
          key={name}
          name={name}
          label={label}
          rules={[{ required: true }]}
        >
          <InputNumber min={min} max={max} precision={0} />
        </Form.Item>
      ))}
      <Form.Item
        name="max_file_bytes"
        label="单文件上限（字节，1073741824 = 1 GiB）"
        rules={[{ required: true }]}
      >
        <InputNumber
          min={1}
          max={5 * 2 ** 30}
          precision={0}
          style={{ width: "100%" }}
        />
      </Form.Item>
      <Form.Item
        name="max_total_bytes"
        label="总素材上限（字节，10737418240 = 10 GiB）"
        dependencies={["max_file_bytes"]}
        rules={[
          { required: true },
          {
            validator: (_, value) =>
              value < form.getFieldValue("max_file_bytes")
                ? Promise.reject(new Error("总上限不能小于单文件上限"))
                : Promise.resolve(),
          },
        ]}
      >
        <InputNumber
          min={1}
          max={50 * 2 ** 30}
          precision={0}
          style={{ width: "100%" }}
        />
      </Form.Item>
      <Form.Item
        name="duration_options_seconds"
        label="可选时长（秒，60–600）"
        rules={[
          { required: true, type: "array", min: 1 },
          {
            validator: (_, values: number[]) =>
              values?.some(
                (v) =>
                  !Number.isInteger(Number(v)) ||
                  Number(v) < 60 ||
                  Number(v) > 600,
              )
                ? Promise.reject(new Error("时长需为 60–600 的整数秒"))
                : Promise.resolve(),
          },
        ]}
        getValueProps={(values: number[] | null) => ({
          value: (values ?? []).map(String),
        })}
        normalize={(values: string[]) => values.map(Number)}
      >
        <Select
          mode="tags"
          options={[60, 180, 300, 600].map((v) => ({
            value: String(v),
            label: `${v} 秒`,
          }))}
        />
      </Form.Item>
      <Form.Item
        name="ratio_options"
        label="可选画幅"
        rules={[{ required: true, type: "array", min: 1 }]}
      >
        <Select
          mode="multiple"
          options={["16:9", "9:16", "1:1", "4:3"].map((value) => ({ value }))}
        />
      </Form.Item>
      <Form.Item
        name="resolution_options"
        label="可选分辨率"
        rules={[{ required: true, type: "array", min: 1 }]}
      >
        <Select
          mode="multiple"
          options={["720P", "1080P", "2K", "4K"].map((value) => ({ value }))}
        />
      </Form.Item>
      <Form.Item
        name="allowed_mime"
        label="允许的素材格式（MIME）"
        rules={[{ required: true, type: "array", min: 1 }]}
      >
        <Select
          mode="multiple"
          options={[
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
            "text/plain",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "audio/mpeg",
            "audio/wav",
          ].map((value) => ({ value }))}
        />
      </Form.Item>
      <Form.Item
        name="notify_to_admin_ids"
        label="提醒接收人（后台账号 ID，最多 50 个）"
        getValueProps={(values: number[] | null) => ({
          value: (values ?? []).map(String),
        })}
        normalize={(values: string[]) => values.map(Number)}
        rules={[
          { type: "array", max: 50 },
          {
            validator: (_, values: number[]) =>
              values?.some(
                (v) => !Number.isSafeInteger(Number(v)) || Number(v) <= 0,
              )
                ? Promise.reject(new Error("请填写正整数账号 ID"))
                : Promise.resolve(),
          },
        ]}
      >
        <Select mode="tags" />
      </Form.Item>
      <Form.Item name="service_tel" label="客服电话" rules={[{ max: 100 }]}>
        <Input maxLength={100} />
      </Form.Item>
      <Space>
        <Button type="primary" htmlType="submit" loading={save.isPending}>
          保存配置
        </Button>
        <Button onClick={() => query.data && form.setFieldsValue(query.data)}>
          恢复已加载配置
        </Button>
      </Space>
    </Form>
  );
}
