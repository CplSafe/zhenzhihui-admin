import { useEffect, useState } from "react";
import {
  App,
  Button,
  Drawer,
  Descriptions,
  Form,
  Input,
  Select,
  Space,
  Tag,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { Mono } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import {
  getFeedback,
  listFeedbacks,
  setFeedbackStatus,
} from "@/api/feedback";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { Feedback } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface Filters {
  status?: string;
}

function statusTag(s: string) {
  return s === "resolved" ? (
    <Tag color="green">已处理</Tag>
  ) : (
    <Tag color="orange">待处理</Tag>
  );
}

export function FeedbacksPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [viewId, setViewId] = useState<number | null>(null);
  const [form] = Form.useForm<{ status: "pending" | "resolved"; admin_note?: string }>();

  const { items, loading, error, pagination, refetch } = usePagedList<
    Feedback,
    Filters
  >({
    queryKey: "admin-feedbacks-list",
    filters,
    fetcher: listFeedbacks,
  });

  const detail = useQuery<Feedback, ApiError>({
    queryKey: ["admin", "feedback", viewId],
    queryFn: () => getFeedback(viewId as number),
    enabled: viewId !== null,
  });

  useEffect(() => {
    if (viewId && detail.data) {
      form.setFieldsValue({
        status: detail.data.status,
        admin_note: detail.data.admin_note,
      });
    }
  }, [viewId, detail.data, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-feedbacks-list"] });
    refetch();
  };

  const statusMut = useMutation({
    mutationFn: (body: { status: "pending" | "resolved"; admin_note?: string }) =>
      setFeedbackStatus(viewId as number, body),
    onSuccess: () => {
      message.success("已更新处理状态");
      setViewId(null);
      invalidate();
    },
    onError: (e: unknown) =>
      message.error(e instanceof ApiError ? e.message : "操作失败"),
  });

  const columns: TableColumnsType<Feedback> = [
    { title: "ID", dataIndex: "id", width: 70, render: (v) => <Mono>{v}</Mono> },
    { title: "用户", dataIndex: "user_id", width: 90, render: (v) => <Mono>{v}</Mono> },
    {
      title: "内容",
      dataIndex: "content",
      ellipsis: true,
      render: (v: string) => v,
    },
    { title: "联系方式", dataIndex: "contact", width: 160 },
    {
      title: "图片",
      dataIndex: "asset_ids_json",
      width: 70,
      render: (v: number[] | null) => (v && v.length ? `${v.length} 张` : "-"),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (v: string) => statusTag(v),
    },
    {
      title: "提交时间",
      dataIndex: "created_at",
      width: 180,
      render: (v) => fmtTime(v),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 100,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setViewId(r.id)}>
          查看 / 处理
        </Button>
      ),
    },
  ];

  return (
    <>
      <ListPageShell<Feedback>
        title="意见反馈"
        filters={
          <Space wrap>
            <Select
              allowClear
              placeholder="处理状态"
              style={{ width: 140 }}
              options={[
                { value: "pending", label: "待处理" },
                { value: "resolved", label: "已处理" },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            />
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
        title={`反馈详情 #${viewId}`}
        width={560}
        open={viewId !== null}
        onClose={() => setViewId(null)}
        loading={detail.isFetching}
        destroyOnHidden
      >
        {detail.data && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="用户 ID">
                {detail.data.user_id}
              </Descriptions.Item>
              <Descriptions.Item label="类型 ID">
                {detail.data.feedback_type}
              </Descriptions.Item>
              <Descriptions.Item label="内容">
                <div style={{ whiteSpace: "pre-wrap" }}>{detail.data.content}</div>
              </Descriptions.Item>
              <Descriptions.Item label="联系方式">
                {detail.data.contact || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="图片">
                {detail.data.asset_ids_json && detail.data.asset_ids_json.length
                  ? `${detail.data.asset_ids_json.length} 张(asset_id: ${detail.data.asset_ids_json.join(", ")})`
                  : "无"}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {fmtTime(detail.data.created_at)}
              </Descriptions.Item>
            </Descriptions>

            <Can permission={Permission.FEEDBACK_WRITE}>
              <Form
                form={form}
                layout="vertical"
                onFinish={(v) => statusMut.mutate(v)}
              >
                <Form.Item name="status" label="处理状态" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { value: "pending", label: "待处理" },
                      { value: "resolved", label: "已处理" },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="admin_note" label="处理备注(可选)">
                  <Input.TextArea rows={3} placeholder="内部处理记录" />
                </Form.Item>
                <Button
                  type="primary"
                  loading={statusMut.isPending}
                  onClick={() => form.submit()}
                >
                  保存处理结果
                </Button>
              </Form>
            </Can>
          </>
        )}
      </Drawer>
    </>
  );
}
