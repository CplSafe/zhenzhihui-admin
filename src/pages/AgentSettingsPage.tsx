import { useEffect } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Space,
  Tag,
  Typography,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Can } from "@/components/Can";
import { Mono } from "@/components/cells";
import { getAgentConfig, updateAgentConfig } from "@/api/agent";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { AgentConfigView } from "@/types/domain";

interface FormValues {
  search_api_key?: string;
  // 勾选「清空 Key」→ 提交空串,后端据此清空。
  clear_search_api_key?: boolean;
  chat_operation_code: string;
  video_operation_code: string;
}

export function AgentSettingsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const clearKey = Form.useWatch("clear_search_api_key", form);

  const { data, isFetching, error } = useQuery<AgentConfigView, ApiError>({
    queryKey: ["admin", "agent", "config"],
    queryFn: getAgentConfig,
  });

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      search_api_key: "",
      clear_search_api_key: false,
      chat_operation_code: data.chat_operation_code,
      video_operation_code: data.video_operation_code,
    });
  }, [data, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      updateAgentConfig({
        // 不传 = 保留原 key;空串 = 清空;非空 = 覆盖。
        search_api_key: values.clear_search_api_key
          ? ""
          : values.search_api_key?.trim() || undefined,
        chat_operation_code: values.chat_operation_code,
        video_operation_code: values.video_operation_code,
      }),
    onSuccess: () => {
      message.success("已保存,配置即时生效");
      void qc.invalidateQueries({ queryKey: ["admin", "agent", "config"] });
    },
    onError: (err: ApiError) => message.error(err.message),
  });

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        智能体配置
      </Typography.Title>

      {error && <Alert type="error" showIcon message={error.message} />}

      <Alert
        type="info"
        showIcon
        message="搜索能力"
        description={
          <>
            智能体通过搜索验证市场数据(1688 供货价、竞品售价、平台销量)。
            未配置搜索 Key 时,智能体会明确告知"搜索未配置"而不是编造数据,
            但分析质量会显著下降。Key 加密存储,保存后不可再读出明文。
          </>
        }
      />

      <Card
        title="当前状态"
        loading={isFetching}
        extra={
          data?.search_api_key_set ? (
            <Tag color="success">搜索已启用</Tag>
          ) : (
            <Tag color="warning">搜索未配置</Tag>
          )
        }
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="搜索 API Key">
            {data?.search_api_key_set ? (
              <Mono>{data.search_api_key_masked}</Mono>
            ) : (
              <Typography.Text type="secondary">未配置</Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="对话 operation code">
            <Mono>{data?.chat_operation_code}</Mono>
          </Descriptions.Item>
          <Descriptions.Item label="视频 operation code">
            <Mono>{data?.video_operation_code}</Mono>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="修改配置">
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => save.mutate(values)}
          disabled={isFetching}
        >
          <Form.Item
            label="搜索 API Key(博查)"
            name="search_api_key"
            extra="留空表示不修改。保存后只显示掩码,如需更换请重新粘贴整串。"
          >
            <Input.Password
              placeholder={
                data?.search_api_key_set ? "留空则保留现有 Key" : "粘贴博查 API Key"
              }
              autoComplete="off"
              disabled={clearKey}
            />
          </Form.Item>

          <Form.Item name="clear_search_api_key" valuePropName="checked">
            <Checkbox>清空搜索 Key(智能体将无法联网搜索)</Checkbox>
          </Form.Item>

          <Form.Item
            label="对话 operation code"
            name="chat_operation_code"
            rules={[{ required: true, message: "不能为空" }]}
            extra="智能体每轮模型调用使用的操作码,需与模型配置里的一致。默认 agent.chat"
          >
            <Input placeholder="agent.chat" />
          </Form.Item>

          <Form.Item
            label="视频 operation code"
            name="video_operation_code"
            rules={[{ required: true, message: "不能为空" }]}
            extra="智能体提交视频生成使用的操作码。默认 video.generate"
          >
            <Input placeholder="video.generate" />
          </Form.Item>

          <Can permission={Permission.SETTINGS_WRITE}>
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              保存
            </Button>
          </Can>
        </Form>
      </Card>
    </Space>
  );
}
