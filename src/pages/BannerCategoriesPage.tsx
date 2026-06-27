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
} from "antd";
import { Switch } from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import {
  createBannerCategory,
  deleteBannerCategory,
  disableBannerCategory,
  enableBannerCategory,
  getBannerCategory,
  listBannerCategories,
  updateBannerCategory,
  type BannerCategoryWriteBody,
} from "@/api/banners";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { BannerCategory } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface Filters {
  enabled?: string;
}

export function BannerCategoriesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [form] = Form.useForm<BannerCategoryWriteBody>();

  const { items, loading, error, pagination, refetch } = usePagedList<
    BannerCategory,
    Filters
  >({
    queryKey: "admin-banner-categories-list",
    filters,
    fetcher: listBannerCategories,
  });

  const detail = useQuery<BannerCategory, ApiError>({
    queryKey: ["admin", "banner-category", editId],
    queryFn: () => getBannerCategory(editId as number),
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
        slug: d.slug,
        position: d.position,
        enabled: d.enabled,
      });
    }
  }, [editId, detail.data, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-banner-categories-list"] });
    refetch();
  };
  const onError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : "操作失败");

  const isEdit = editId !== null && editId > 0;

  const saveMut = useMutation({
    mutationFn: (body: BannerCategoryWriteBody) =>
      isEdit
        ? updateBannerCategory(editId as number, body)
        : createBannerCategory(body),
    onSuccess: () => {
      message.success(isEdit ? "已更新" : "已新增");
      setEditId(null);
      invalidate();
    },
    onError,
  });
  const enableMut = useMutation({
    mutationFn: enableBannerCategory,
    onSuccess: () => {
      message.success("已启用");
      invalidate();
    },
    onError,
  });
  const disableMut = useMutation({
    mutationFn: disableBannerCategory,
    onSuccess: () => {
      message.success("已停用");
      invalidate();
    },
    onError,
  });
  const deleteMut = useMutation({
    mutationFn: deleteBannerCategory,
    onSuccess: () => {
      message.success("已删除");
      invalidate();
    },
    onError,
  });

  const columns: TableColumnsType<BannerCategory> = [
    { title: "ID", dataIndex: "id", width: 70, render: (v) => <Mono>{v}</Mono> },
    { title: "名称", dataIndex: "name" },
    {
      title: "slug(前端拉取键)",
      dataIndex: "slug",
      render: (v) => <Mono>{v}</Mono>,
    },
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
        <Can permission={Permission.BANNERS_WRITE} fallback={<span>-</span>}>
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
              title="确认删除该分类?属于它的轮播图不会被删,但该位置将不再展示"
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
      <ListPageShell<BannerCategory>
        title="轮播分类(投放位置)"
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
            <Can permission={Permission.BANNERS_WRITE}>
              <Button type="primary" onClick={() => setEditId(0)}>
                新增分类
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
        title={isEdit ? `编辑分类 #${editId}` : "新增轮播分类"}
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
            label="分类名称(后台展示)"
            rules={[{ required: true, message: "必填" }]}
          >
            <Input placeholder="首页轮播 / 登录页" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="slug(前端拉取键,仅小写字母/数字/-/_)"
            rules={[
              { required: true, message: "必填" },
              {
                pattern: /^[a-z0-9_-]+$/,
                message: "只能包含小写字母、数字、- 和 _",
              },
            ]}
            extra="前端按它拉取该位置的轮播图,如 home / login。保存后请勿随意更改。"
          >
            <Input placeholder="home" />
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
