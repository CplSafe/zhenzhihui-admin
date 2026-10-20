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
        title="本页管理预付费复刻名额，用于创建可反复调用的音色 ID"
        description={
          <>
            <p>先在火山控制台购买声音复刻名额，取得 S_ 开头的音色 ID；在此分配给工作空间后，该空间的用户即可上传录音，训练自己的声音。训练会占用一个空闲名额，成功后可反复用于配音。</p>
            <p>公共音色及 SeedAudio 直接参考录音生成均不需要此名额。官方还支持后付费复刻，首次正式合成收取槽位费；火山当前仅接入预付费复刻流程。</p>
            <p>MiniMax 国际版复刻无需分配这些槽位：上传 10–300 秒录音创建音色，7 天内首次合成激活，首次使用的音色费用随配音结算。</p>
            <p style={{ marginBottom: 0 }}>本页仅登记已购名额，不购买或训练。配音按任务正常计费；已使用名额即使删除本地音色也不会自动回收。重新绑定仅用于语音凭证轮换后核验同一名额。</p>
          </>
        }
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
