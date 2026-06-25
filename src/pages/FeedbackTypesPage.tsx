import { useEffect, useState } from "react";
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Switch,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import {
  createFeedbackType,
  deleteFeedbackType,
  disableFeedbackType,
  enableFeedbackType,
  getFeedbackType,
  listFeedbackTypes,
  updateFeedbackType,
  type FeedbackTypeWriteBody,
} from "@/api/feedback";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { FeedbackType } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface Filters {
  enabled?: string;
}

export function FeedbackTypesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [form] = Form.useForm<FeedbackTypeWriteBody>();

  const { items, loading, error, pagination, refetch } = usePagedList<
    FeedbackType,
    Filters
  >({
    queryKey: "admin-feedback-types-list",
    filters,
    fetcher: listFeedbackTypes,
  });

  const detail = useQuery<FeedbackType, ApiError>({
    queryKey: ["admin", "feedback-type", editId],
    queryFn: () => getFeedbackType(editId as number),
    enabled: editId !== null && editId > 0,
  });

  useEffect(() => {
    if (editId === 0) {
      form.resetFields();
      form.setFieldsValue({ enabled: true, position: 0 });
      return;
    }
    if (editId && editId > 0 && detail.data) {
      const d = detail.data;
      form.setFieldsValue({
        name: d.name,
        position: d.position,
        enabled: d.enabled,
      });
    }
  }, [editId, detail.data, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-feedback-types-list"] });
    refetch();
  };
  const onError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : "操作失败");

  const isEdit = editId !== null && editId > 0;

  const saveMut = useMutation({
    mutationFn: (body: FeedbackTypeWriteBody) =>
      isEdit ? updateFeedbackType(editId as number, body) : createFeedbackType(body),
    onSuccess: () => {
      message.success(isEdit ? "已更新" : "已新增");
      setEditId(null);
      invalidate();
    },
    onError,
  });
  const enableMut = useMutation({
    mutationFn: enableFeedbackType,
    onSuccess: () => {
      message.success("已启用");
      invalidate();
    },
    onError,
  });
  const disableMut = useMutation({
    mutationFn: disableFeedbackType,
    onSuccess: () => {
      message.success("已停用");
      invalidate();
    },
    onError,
  });
  const deleteMut = useMutation({
    mutationFn: deleteFeedbackType,
    onSuccess: () => {
      message.success("已删除");
      invalidate();
    },
    onError,
  });

  const columns: TableColumnsType<FeedbackType> = [
    { title: "ID", dataIndex: "id", width: 70, render: (v) => <Mono>{v}</Mono> },
    { title: "名称", dataIndex: "name" },
    { title: "排序", dataIndex: "position", width: 80 },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 90,
      render: (v: boolean) => <StatusTag status={v ? "enabled" : "disabled"} />,
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 180,
      render: (v) => fmtTime(v),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 220,
      render: (_, r) => (
        <Can permission={Permission.FEEDBACK_WRITE} fallback={<span>-</span>}>
          <Space size="small">
            <Button type="link" size="small" onClick={() => setEditId(r.id)}>
              编辑
            </Button>
            {r.enabled ? (
              <Button
                type="link"
                size="small"
                danger
                onClick={() => disableMut.mutate(r.id)}
              >
                停用
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                onClick={() => enableMut.mutate(r.id)}
              >
                启用
              </Button>
            )}
            <Popconfirm
              title="确认删除该反馈类型?"
              onConfirm={() => deleteMut.mutate(r.id)}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </Can>
      ),
    },
  ];

  return (
    <>
      <ListPageShell<FeedbackType>
        title="反馈类型配置"
        filters={
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Switch
              checkedChildren="只看启用"
              unCheckedChildren="全部"
              onChange={(on) =>
                setFilters((f) => ({ ...f, enabled: on ? "true" : undefined }))
              }
            />
            <Can permission={Permission.FEEDBACK_WRITE}>
              <Button type="primary" onClick={() => setEditId(0)}>
                新增类型
              </Button>
            </Can>
          </Space>
        }
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        error={error}
        pagination={pagination}
      />

      <Drawer
        title={isEdit ? `编辑类型 #${editId}` : "新增反馈类型"}
        width={420}
        open={editId !== null}
        onClose={() => setEditId(null)}
        loading={isEdit && detail.isFetching}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setEditId(null)}>取消</Button>
            <Button
              type="primary"
              loading={saveMut.isPending}
              onClick={() => form.submit()}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item
            name="name"
            label="类型名称"
            rules={[{ required: true, message: "必填" }]}
          >
            <Input placeholder="功能建议 / Bug 反馈 / 投诉" />
          </Form.Item>
          <Form.Item
            name="position"
            label="排序(数字越小越靠前)"
            rules={[{ required: true, message: "必填" }]}
          >
            <InputNumber min={0} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
