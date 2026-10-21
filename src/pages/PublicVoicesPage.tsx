import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Can } from "@/components/Can";
import { usePagedList } from "@/hooks/usePagedList";
import { listPublicVoices, savePublicVoice, syncPublicVoices } from "@/api/voices";
import type {
  PublicVoice,
  PublicVoiceBody,
  PublicVoiceFilters,
} from "@/api/voices";
import { Permission } from "@/types/admin";

export function PublicVoicesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<PublicVoiceFilters>({ provider: "volcengine-speech" });
  const [editor, setEditor] = useState<PublicVoice | "new" | null>(null);
  const [form] = Form.useForm<PublicVoiceBody>();
  const list = usePagedList({
    queryKey: "admin-public-voices",
    filters,
    fetcher: listPublicVoices,
  });
  const save = useMutation({
    mutationFn: savePublicVoice,
    onSuccess: () => {
      message.success("公共音色已保存");
      setEditor(null);
      qc.invalidateQueries({ queryKey: ["admin-public-voices"] });
    },
    onError: (e: Error) => message.error(e.message),
  });
  const sync = useMutation({
    mutationFn: syncPublicVoices,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-public-voices"] });
    },
  });
  function openEditor(voice?: PublicVoice) {
    setEditor(voice ?? "new");
    form.resetFields();
    form.setFieldsValue(
      voice
        ? {
            provider: voice.provider,
            name: voice.name,
            speaker_id: voice.speaker_id,
            description: voice.description,
            language: voice.language,
            gender: voice.gender,
            tags: voice.tags ?? [],
            preview_url: voice.preview_url ?? "",
            enabled: voice.status === "ready",
          }
        : {
            provider: "volcengine-speech",
            name: "",
            speaker_id: "",
            description: "",
            language: "zh",
            gender: "",
            tags: [],
            preview_url: "",
            enabled: true,
          },
    );
  }
  const columns: TableColumnsType<PublicVoice> = [
    { title: "供应商", dataIndex: "provider", width: 120, render: (v) => v === "minimax" ? "MiniMax 国际版" : "火山语音" },
    {
      title: "音色",
      dataIndex: "name",
      width: 180,
      render: (name, row) => (
        <>
          <Typography.Text strong>{name}</Typography.Text>
          <div>
            <Typography.Text type="secondary">
              #{row.id} · {row.language || "未标注语种"}
            </Typography.Text>
          </div>
        </>
      ),
    },
    {
      title: "供应商音色 ID",
      dataIndex: "speaker_id",
      width: 310,
      render: (id) => (
        <Typography.Text copyable style={{ overflowWrap: "anywhere" }}>
          {id}
        </Typography.Text>
      ),
    },
    {
      title: "描述 / 标签",
      key: "metadata",
      width: 240,
      render: (_, row) => (
        <>
          <div>{row.description || "—"}</div>
          <Space size={[0, 4]} wrap>
            {(row.tags ?? []).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        </>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (status) => (
        <Tag color={status === "ready" ? "green" : "default"}>
          {status === "ready" ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "试听",
      key: "preview",
      width: 260,
      render: (_, row) =>
        row.preview_url ? (
          <audio
            aria-label={`${row.name}试听`}
            controls
            preload="none"
            src={row.preview_url}
            style={{ width: 240, height: 32 }}
          />
        ) : (
          <Typography.Text type="secondary">未配置</Typography.Text>
        ),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 80,
      render: (_, row) => (
        <Can permission={Permission.MODELS_WRITE}>
          <Button type="link" onClick={() => openEditor(row)}>
            编辑
          </Button>
        </Can>
      ),
    },
  ];
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          音色管理 · 公共音色
        </Typography.Title>
        <Can permission={Permission.MODELS_WRITE}>
          <Space wrap>
            <Button loading={sync.isPending} onClick={() => sync.mutate(filters.provider ?? "volcengine-speech")}>
              同步官方音色与试听
            </Button>
            <Button type="primary" disabled={filters.provider === "minimax"} onClick={() => openEditor()}>
              新增公共音色
            </Button>
          </Space>
        </Can>
      </Space>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        维护火山语音与 MiniMax 国际版可用的公共音色和试听链接。停用后不再出现在用户可选音色中。
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        同步当前选中的供应商：火山使用「火山引擎」的 AK/SK；MiniMax 使用国际版 API Key 核对系统音色，
        并同步官网的标题、描述、封面、试听链接和筛选标签（国内官网优先，国际官网补缺）。同步保留人工编辑内容、停用状态及自定义试听，
        并更新此前同步的官网试听链接。未匹配到官网资料的音色保留原数据，可编辑补充已有音频链接。同步和播放已有试听不会调用付费语音合成。
      </Typography.Paragraph>
      {sync.isError && (
        <Alert type="error" showIcon title="官方同步失败" description={sync.error.message} />
      )}
      {sync.isSuccess && (
        <Alert
          type={sync.data.missing_preview > 0 ? "warning" : "success"}
          showIcon
          title={`已核对 ${sync.data.total} 个官方音色，新增 ${sync.data.added} 个，补齐 ${sync.data.previews_filled} 个试听`}
          description={
            sync.data.missing_preview > 0
              ? `仍有 ${sync.data.missing_preview} 个本地音色没有试听链接。官方暂未提供试听的音色，可在编辑中补充已有音频链接。`
              : "公共音色试听链接已齐全。"
          }
        />
      )}
      <Space wrap>
        <Select aria-label="音色供应商" disabled={sync.isPending} value={filters.provider} style={{ width: 180 }} onChange={(provider) => { setFilters((f) => ({ ...f, provider })); sync.reset(); }} options={[{value: "volcengine-speech", label: "火山语音"}, {value: "minimax", label: "MiniMax 国际版"}]} />
        <Input.Search
          aria-label="搜索公共音色"
          placeholder="名称或供应商音色 ID"
          allowClear
          onSearch={(q) => setFilters((f) => ({ ...f, q }))}
          style={{ width: 280, maxWidth: "100%" }}
        />
        <Select
          aria-label="音色状态"
          value={filters.status ?? ""}
          onChange={(status) => setFilters((f) => ({ ...f, status }))}
          style={{ width: 130 }}
          options={[
            { value: "", label: "全部状态" },
            { value: "ready", label: "启用" },
            { value: "disabled", label: "停用" },
          ]}
        />
        <Button onClick={() => list.refetch()} loading={list.loading}>
          刷新
        </Button>
      </Space>
      {list.error && (
        <Alert
          type="error"
          showIcon
          title="公共音色加载失败"
          description={list.error.message}
        />
      )}
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list.items}
          loading={list.loading}
          pagination={list.pagination}
          scroll={{ x: 1180 }}
          locale={{ emptyText: "暂无符合条件的公共音色" }}
        />
      </Card>
      <Modal
        title={editor === "new" ? "新增公共音色" : "编辑公共音色"}
        open={editor !== null}
        onCancel={() => !save.isPending && setEditor(null)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        cancelButtonProps={{ disabled: save.isPending }}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          disabled={save.isPending}
          onFinish={(values) =>
            save.mutate({
              ...values,
              name: values.name.trim(),
              speaker_id: values.speaker_id.trim(),
              preview_url: (values.preview_url ?? "").trim(),
              tags: values.tags ?? [],
            })
          }
        >
          <Form.Item name="provider" hidden><Input /></Form.Item>
          <Form.Item
            name="name"
            label="音色名称"
            rules={[{ required: true, whitespace: true, max: 128 }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="speaker_id"
            label="供应商音色 ID"
            extra="火山支持手动配置官方 TTS 2.0 ID。MiniMax 通过官方同步导入；复刻音色不能配置为公共音色。编辑时不可更换 ID。"
            rules={[
              { required: true },
              {
                pattern: editor !== "new" && editor?.provider === "minimax" ? undefined : /^(?:[a-z]{2}_(?:female|male)_[A-Za-z0-9_-]+_uranus_bigtts|ICL_uranus_[a-z]{2}_(?:female|male)_[A-Za-z0-9_-]+_tob)$/,
                message: "请填写官方 TTS 2.0 公共音色 ID（含 ICL_uranus 系列）",
              },
              { max: 256 },
            ]}
          >
            <Input
              disabled={editor !== "new"}
              maxLength={256}
              placeholder="zh_female_vv_uranus_bigtts"
            />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="language" label="语种代码" rules={[{ max: 16 }]}>
              <Input maxLength={16} placeholder="zh / en" />
            </Form.Item>
            <Form.Item name="gender" label="声音性别" rules={[{ max: 16 }]}>
              <Input maxLength={16} placeholder="female / male" />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述" rules={[{ max: 1000 }]}>
            <Input.TextArea maxLength={1000} rows={3} showCount />
          </Form.Item>
          <Form.Item
            name="tags"
            label="标签"
            rules={[
              {
                validator: (_, tags: string[] = []) =>
                  tags.length <= 20 &&
                  tags.every((tag) => [...tag].length <= 64)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error("最多 20 个标签，每个不超过 64 字"),
                      ),
              },
            ]}
          >
            <Select
              mode="tags"
              tokenSeparators={[","]}
              placeholder="输入后回车添加"
            />
          </Form.Item>
          <Form.Item
            name="preview_url"
            label="试听链接"
            extra="可留空；使用可公开访问的 HTTPS 音频地址。这里只播放已有素材，不调用付费生成。"
            rules={[
              {
                validator: (_, value: string) => {
                  if (!value) return Promise.resolve();
                  try {
                    const u = new URL(value);
                    if (
                      u.protocol === "https:" &&
                      !u.username &&
                      !u.password &&
                      value.length <= 2048
                    )
                      return Promise.resolve();
                  } catch {
                    /* Show form validation below. */
                  }
                  return Promise.reject(
                    new Error("请输入不含账号密码的 HTTPS 链接"),
                  );
                },
              },
            ]}
          >
            <Input maxLength={2048} placeholder="https://…" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
