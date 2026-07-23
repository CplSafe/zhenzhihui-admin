import { Alert, App, Button, Card, Form, InputNumber, Space, Switch, Typography } from "antd";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDistributionConfig,
  updateDistributionConfig,
} from "@/api/distribution";
import { Can } from "@/components/Can";
import { Money } from "@/components/cells";
import { usePermission } from "@/hooks/usePermission";
import { Permission } from "@/types/admin";
import { ApiCode, ApiError } from "@/types/api";
import type { DistributionConfig } from "@/types/distribution";

const QUERY_KEY = ["admin", "distribution", "config"] as const;

export function DistributionConfigTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { has } = usePermission();
  const canWrite = has(Permission.REFERRAL_WRITE);
  const [form] = Form.useForm<DistributionConfig>();

  const { data, isFetching, error } = useQuery<DistributionConfig, ApiError>({
    queryKey: QUERY_KEY,
    queryFn: getDistributionConfig,
  });
  const canRepairInvalidConfig =
    error?.codeString === ApiCode.STORED_DISTRIBUTION_CONFIG_INVALID;

  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);

  const saveMut = useMutation({
    mutationFn: updateDistributionConfig,
    onSuccess: (updated) => {
      message.success("分销配置已保存");
      form.setFieldsValue(updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (mutationError: unknown) => {
      message.error(
        mutationError instanceof ApiError ? mutationError.message : "保存失败",
      );
    },
  });

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        title="佣金按订单利润计算"
        description="订单利润 = 实收金额 - 积分成本。关闭分销总开关后，新支付订单不会产生佣金；成本按每 1000 积分的整数分值配置。"
      />

      {error && (
        <Alert
          type="error"
          showIcon
          title="全局配置加载失败"
          description={
            canWrite && canRepairInvalidConfig
              ? `${error.message}。可填写一组合法配置并保存，以修复损坏的历史配置。`
              : error.message
          }
        />
      )}

      <Card
        title="结算配置"
        loading={isFetching && !data}
        style={{ maxWidth: 680 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            enabled: false,
            cost_cents_per_1000_credits: 2000,
          }}
          disabled={!canWrite || (!data && !canRepairInvalidConfig)}
          onFinish={(values) => saveMut.mutate(values)}
        >
          <Form.Item
            name="enabled"
            label="启用分销结算"
            valuePropName="checked"
            extra="关系链仍会继续记录；此开关只控制新订单是否进行佣金结算。"
          >
            <Switch checkedChildren="已启用" unCheckedChildren="已关闭" />
          </Form.Item>

          <Form.Item
            name="cost_cents_per_1000_credits"
            label="每 1000 积分成本"
            rules={[
              { required: true, message: "请输入积分成本" },
              {
                type: "number",
                min: 1,
                max: 1_000_000_000,
                message: "积分成本须在 1 到 1,000,000,000 分之间",
              },
            ]}
            extra="金额单位为分，只允许正整数。成本越高，可返佣利润越低。"
          >
            <InputNumber
              min={1}
              max={1_000_000_000}
              precision={0}
              suffix="分"
              style={{ width: "100%" }}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(previous, current) =>
              previous.cost_cents_per_1000_credits !==
              current.cost_cents_per_1000_credits
            }
          >
            {({ getFieldValue }) => (
              <Typography.Paragraph type="secondary">
                当前折算：1000 积分成本约为{` `}
                <Money
                  cents={Number(getFieldValue("cost_cents_per_1000_credits")) || 0}
                />
              </Typography.Paragraph>
            )}
          </Form.Item>

          <Can
            permission={Permission.REFERRAL_WRITE}
            fallback={
              <Typography.Text type="secondary">
                当前账号仅可查看配置。
              </Typography.Text>
            }
          >
            <Button
              type="primary"
              htmlType="submit"
              loading={saveMut.isPending}
              disabled={!data && !canRepairInvalidConfig}
            >
              保存配置
            </Button>
          </Can>
        </Form>
      </Card>
    </Space>
  );
}
