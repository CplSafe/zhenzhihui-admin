import { useState } from "react";
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
import { addVoiceSlot, listVoiceSlots, rebindVoiceSlot } from "@/api/voices";
import type { VoiceSlot } from "@/api/voices";
import { Permission } from "@/types/admin";

export function VoiceSlotsPage() {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [workspaceID, setWorkspaceID] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm<{
    speaker_id: string;
    prepaid_confirmed: boolean;
  }>();
  const validWorkspace =
    workspaceID !== null &&
    Number.isSafeInteger(workspaceID) &&
    workspaceID > 0;
  const slots = useQuery({
    queryKey: ["admin-voice-slots", workspaceID],
    queryFn: () => listVoiceSlots(workspaceID!),
    enabled: validWorkspace,
  });
  const add = useMutation({
    mutationFn: addVoiceSlot,
    onSuccess: (_, input) => {
      message.success("预付费槽位已分配");
      setAdding(false);
      qc.invalidateQueries({
        queryKey: ["admin-voice-slots", input.workspace_id],
      });
    },
    onError: (e: Error) => message.error(e.message),
  });
  const rebind = useMutation({
    mutationFn: rebindVoiceSlot,
    onSuccess: () => {
      message.success("供应商核验通过，槽位凭证已重新绑定");
      qc.invalidateQueries({ queryKey: ["admin-voice-slots"] });
    },
  });
  const columns: TableColumnsType<VoiceSlot> = [
    { title: "槽位 ID", dataIndex: "id", width: 100 },
    { title: "工作空间 ID", dataIndex: "workspace_id", width: 130 },
    {
      title: "供应商音色 ID",
      dataIndex: "speaker_id",
      width: 280,
      render: (id) => <Typography.Text copyable>{id}</Typography.Text>,
    },
    {
      title: "分配状态",
      key: "state",
      width: 140,
      render: (_, row) => (
        <Tag color={row.voice_id ? "blue" : "green"}>
          {row.voice_id ? "已使用" : "尚未使用"}
        </Tag>
      ),
    },
    {
      title: "关联音色 ID",
      dataIndex: "voice_id",
      width: 140,
      render: (id) => id ?? "—",
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_, row) => (
        <Can permission={Permission.SETTINGS_WRITE}>
          <Button
            type="link"
            disabled={rebind.isPending}
            onClick={() =>
              modal.confirm({
                title: "使用当前凭证重新绑定槽位？",
                content: `将核验 ${row.speaker_id} 是否属于当前 volcengine-speech 凭证，并更新槽位及关联音色的绑定。仅在凭证轮换后使用，不会购买名额或重新训练。`,
                okText: "核验并绑定",
                cancelText: "取消",
                onOk: () =>
                  rebind.mutateAsync(row.id).catch((e: Error) => {
                    message.error(e.message);
                    throw e;
                  }),
              })
            }
          >
            重新绑定凭证
          </Button>
        </Can>
      ),
    },
  ];
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        音色管理 · 复刻槽位
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        title="先在供应商侧购买复刻名额，再分配给工作空间"
        description="配置沿用 volcengine-speech。此处不购买、不训练、不额外扣平台积分。槽位一经使用，即使删除音色也不会自动回收或跨空间复用。"
      />
      <Space wrap>
        <Typography.Text>工作空间 ID</Typography.Text>
        <InputNumber
          aria-label="工作空间 ID"
          min={1}
          max={Number.MAX_SAFE_INTEGER}
          precision={0}
          value={workspaceID}
          disabled={adding || rebind.isPending}
          onChange={setWorkspaceID}
          placeholder="输入工作空间 ID"
          style={{ width: 210 }}
        />
        <Button
          disabled={!validWorkspace}
          loading={slots.isFetching}
          onClick={() => slots.refetch()}
        >
          刷新
        </Button>
        <Can permission={Permission.SETTINGS_WRITE}>
          <Button
            type="primary"
            disabled={!validWorkspace}
            onClick={() => {
              form.resetFields();
              setAdding(true);
            }}
          >
            分配预付费槽位
          </Button>
        </Can>
      </Space>
      {slots.error && (
        <Alert
          type="error"
          showIcon
          title="槽位加载失败"
          description={slots.error.message}
        />
      )}
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={validWorkspace ? (slots.data ?? []) : []}
          loading={slots.isFetching}
          scroll={{ x: 940 }}
          pagination={{ pageSize: 20, showTotal: (n) => `共 ${n} 个槽位` }}
          locale={{
            emptyText: validWorkspace
              ? "该工作空间暂无已分配槽位"
              : "先输入工作空间 ID 查看槽位",
          }}
        />
      </Card>
      <Modal
        title={`为工作空间 #${workspaceID} 分配槽位`}
        open={adding}
        onCancel={() => !add.isPending && setAdding(false)}
        confirmLoading={add.isPending}
        cancelButtonProps={{ disabled: add.isPending }}
        onOk={() => form.submit()}
        okText="确认分配"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          disabled={add.isPending}
          onFinish={(values) => {
            if (validWorkspace)
              add.mutate({
                ...values,
                speaker_id: values.speaker_id.trim(),
                workspace_id: workspaceID,
              });
          }}
        >
          <Form.Item
            name="speaker_id"
            label="已购买的音色 ID"
            rules={[
              { required: true },
              {
                pattern: /^S_[A-Za-z0-9_-]{1,120}$/,
                message: "请输入有效的 S_ 开头槽位 ID",
              },
            ]}
          >
            <Input placeholder="S_…" maxLength={122} />
          </Form.Item>
          <Form.Item
            name="prepaid_confirmed"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value: boolean) =>
                  value
                    ? Promise.resolve()
                    : Promise.reject(new Error("请确认已在供应商侧购买此槽位")),
              },
            ]}
          >
            <Checkbox>确认此槽位已预付费购买，且属于当前语音凭证</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
