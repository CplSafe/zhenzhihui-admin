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
  Upload,
} from "antd";
import type { TableColumnsType, UploadProps } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Can } from "@/components/Can";
import { Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import {
  createBanner,
  deleteBanner,
  disableBanner,
  enableBanner,
  getBanner,
  listBanners,
  updateBanner,
  uploadBannerImage,
  type BannerWriteBody,
} from "@/api/banners";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { Banner } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface Filters {
  enabled?: string;
}

export function BannersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  // editId: null=未开抽屉, 0=新增, >0=编辑该 ID
  const [editId, setEditId] = useState<number | null>(null);
  const [form] = Form.useForm<BannerWriteBody>();
  const [uploading, setUploading] = useState(false);

  const { items, loading, error, pagination, refetch } = usePagedList<
    Banner,
    Filters
  >({
    queryKey: "admin-banners-list",
    filters,
    fetcher: listBanners,
  });

  const detail = useQuery<Banner, ApiError>({
    queryKey: ["admin", "banner", editId],
    queryFn: () => getBanner(editId as number),
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
        title: d.title,
        image_url: d.image_url,
        link_url: d.link_url,
        description: d.description,
        position: d.position,
        enabled: d.enabled,
      });
    }
  }, [editId, detail.data, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-banners-list"] });
    refetch();
  };
  const onError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : "操作失败");

  const isEdit = editId !== null && editId > 0;

  const saveMut = useMutation({
    mutationFn: (body: BannerWriteBody) =>
      isEdit ? updateBanner(editId as number, body) : createBanner(body),
    onSuccess: () => {
      message.success(isEdit ? "已更新轮播图" : "已新增轮播图");
      setEditId(null);
      invalidate();
    },
    onError,
  });

  const enableMut = useMutation({
    mutationFn: enableBanner,
    onSuccess: () => {
      message.success("已启用");
      invalidate();
    },
    onError,
  });
  const disableMut = useMutation({
    mutationFn: disableBanner,
    onSuccess: () => {
      message.success("已停用");
      invalidate();
    },
    onError,
  });
  const deleteMut = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      message.success("已删除");
      invalidate();
    },
    onError,
  });

  // 上传图片:成功后把返回的公开 URL 写回表单 image_url 字段。
  const beforeUpload: UploadProps["beforeUpload"] = async (file) => {
    setUploading(true);
    try {
      const res = await uploadBannerImage(file as File);
      form.setFieldsValue({ image_url: res.image_url });
      message.success("图片已上传");
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : "上传失败,可改为直接填写图片 URL");
    } finally {
      setUploading(false);
    }
    return false; // 阻止 antd 默认上传行为,完全自管。
  };

  const columns: TableColumnsType<Banner> = [
    { title: "ID", dataIndex: "id", width: 70, render: (v) => <Mono>{v}</Mono> },
    {
      title: "预览",
      dataIndex: "image_url",
      width: 120,
      render: (v: string) =>
        v ? (
          <img
            src={v}
            alt="banner"
            style={{
              width: 96,
              height: 40,
              objectFit: "cover",
              borderRadius: 4,
            }}
          />
        ) : (
          <span>-</span>
        ),
    },
    { title: "标题", dataIndex: "title" },
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
              title="确认删除该轮播图?"
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
      <ListPageShell<Banner>
        title="轮播图管理"
        filters={
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space wrap>
              <Switch
                checkedChildren="只看启用"
                unCheckedChildren="全部"
                onChange={(on) =>
                  setFilters((f) => ({ ...f, enabled: on ? "true" : undefined }))
                }
              />
            </Space>
            <Can permission={Permission.BANNERS_WRITE}>
              <Button type="primary" onClick={() => setEditId(0)}>
                新增轮播图
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
        title={isEdit ? `编辑轮播图 #${editId}` : "新增轮播图"}
        width={560}
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
            name="title"
            label="标题"
            rules={[{ required: true, message: "必填" }]}
          >
            <Input placeholder="夏季活动" />
          </Form.Item>
          <Form.Item
            name="image_url"
            label="图片"
            rules={[{ required: true, message: "上传图片或填写图片 URL" }]}
            extra="点上传到对象存储自动回填,或直接粘贴外部图片 URL。"
          >
            <Input placeholder="https://.../banner.jpg" />
          </Form.Item>
          <Form.Item label=" " colon={false}>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={beforeUpload}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                上传图片
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="link_url"
            label="跳转链接(可选)"
            extra="点击 banner 跳转的地址,留空则不可点。"
          >
            <Input placeholder="https://example.com/activity" />
          </Form.Item>
          <Form.Item name="description" label="描述(可选)">
            <Input.TextArea rows={2} placeholder="内部备注或副标题" />
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
