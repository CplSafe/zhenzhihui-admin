import { useEffect } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { Table } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Can } from "@/components/Can";
import { Count, Money, Mono, RowActions, StatusTag } from "@/components/cells";
import {
  createCreditPackage,
  disableCreditPackage,
  enableCreditPackage,
  listCreditPackages,
  updateCreditPackage,
} from "@/api/creditPackages";
import { useResourceCrud } from "@/hooks/useResourceCrud";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type { CreditPackage } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface FormValues {
  code: string;
  name: string;
  amount_cents: number;
  credits: number;
  status: string;
}

export function CreditPackagesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const {
    editId,
    isOpen,
    isEdit,
    openCreate,
    openEdit,
    close,
    onError,
    invalidate,
    enableMut,
    disableMut,
  } = useResourceCrud({
    queryKey: ["admin", "credit-packages"],
    enableFn: enableCreditPackage,
    disableFn: disableCreditPackage,
  });

  const { data, isFetching, error } = useQuery<CreditPackage[], ApiError>({
    queryKey: ["admin", "credit-packages"],
    queryFn: listCreditPackages,
  });

  const editing = data?.find((p) => p.id === editId);

  useEffect(() => {
    if (editId === 0) {
      form.resetFields();
      form.setFieldsValue({ status: "enabled", amount_cents: 0, credits: 0 });
    } else if (editing) {
      form.setFieldsValue({
        code: editing.code,
        name: editing.name,
        amount_cents: editing.amount_cents,
        credits: editing.credits,
        status: editing.status,
      });
    }
  }, [editId, editing, form]);

  const saveMut = useMutation({
    mutationFn: (v: FormValues) =>
      isEdit
        ? updateCreditPackage(editId!, {
            name: v.name,
            amount_cents: v.amount_cents,
            credits: v.credits,
            status: v.status,
          })
        : createCreditPackage({
            code: v.code,
            name: v.name,
            amount_cents: v.amount_cents,
            credits: v.credits,
            status: v.status,
          }),
    onSuccess: () => {
      message.success(isEdit ? "已更新积分包" : "已新增积分包");
      close();
      invalidate();
    },
    onError,
  });

  const columns: TableColumnsType<CreditPackage> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 70,
      render: (v) => <Mono>{v}</Mono>,
    },
    { title: "code", dataIndex: "code", render: (v) => <Mono>{v}</Mono> },
    { title: "名称", dataIndex: "name" },
    {
      title: "价格",
      dataIndex: "amount_cents",
      width: 120,
      render: (v) => <Money cents={v} />,
    },
    {
      title: "积分",
      dataIndex: "credits",
      width: 120,
      render: (v) => <Count value={v} />,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (v) => <StatusTag status={v} />,
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
      width: 180,
      render: (_, r) => (
        <RowActions
          status={r.status}
          permission={Permission.CREDIT_PACKAGES_WRITE}
          onEdit={() => openEdit(r.id)}
          onEnable={() => enableMut.mutate(r.id)}
          onDisable={() => disableMut.mutate(r.id)}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
          积分包管理
        </Typography.Title>
        <Can permission={Permission.CREDIT_PACKAGES_WRITE}>
          <Button type="primary" onClick={openCreate}>
            新增积分包
          </Button>
        </Can>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={error.message}
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CreditPackage>
          rowKey="id"
          columns={columns}
          dataSource={data ?? []}
          loading={isFetching}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>

      <Modal
        title={isEdit ? `编辑积分包 #${editId}` : "新增积分包"}
        open={isOpen}
        onCancel={close}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: !isEdit, message: "必填" }]}
          >
            <Input placeholder="credits_10k" disabled={isEdit} />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: "必填" }]}
          >
            <Input placeholder="10,000 积分包" />
          </Form.Item>
          <Form.Item
            name="amount_cents"
            label="价格(分)"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="credits" label="积分数" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "enabled", label: "启用" },
                { value: "disabled", label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
