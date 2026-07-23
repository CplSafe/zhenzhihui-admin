import { App, Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  createDistributionAccount,
  disableDistributionAccount,
  enableDistributionAccount,
  listDistributionAccounts,
  updateDistributionAccount,
} from "@/api/distribution";
import { Can } from "@/components/Can";
import { Money, Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import { useResourceCrud } from "@/hooks/useResourceCrud";
import { Permission } from "@/types/admin";
import type {
  DistributionAccount,
  DistributionAccountStatus,
} from "@/types/distribution";
import { fmtTime } from "@/utils/format";

const LIST_QUERY_KEY = "admin-distribution-accounts";
interface AccountFilters {
  user_id?: number;
  status?: DistributionAccountStatus;
  keyword?: string;
}

function toPositiveInt(value: string): number | undefined {
  const normalized = value.trim();
  const parsed = Number(normalized);
  return normalized && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}

interface AccountFormValues {
  user_id: number;
  direct_rate_percent: number;
  indirect_rate_percent: number;
  remark?: string;
}

function percentLabel(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

function userCell(userId: number, nickname?: string, mobile?: string) {
  return (
    <Space orientation="vertical" size={0}>
      <span>
        <Mono>#{userId}</Mono> {nickname || "-"}
      </span>
      <Typography.Text type="secondary">
        {mobile ? <Mono>{mobile}</Mono> : "手机号未回传"}
      </Typography.Text>
    </Space>
  );
}

export function DistributionAccountsTab() {
  const { message } = App.useApp();
  const [form] = Form.useForm<AccountFormValues>();
  const [filters, setFilters] = useState<AccountFilters>({});
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
    queryKey: [LIST_QUERY_KEY],
    enableFn: enableDistributionAccount,
    disableFn: disableDistributionAccount,
  });

  const { items, total, loading, error, pagination } = usePagedList<
    DistributionAccount,
    AccountFilters
  >({
    queryKey: LIST_QUERY_KEY,
    filters,
    fetcher: listDistributionAccounts,
  });

  const startCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      direct_rate_percent: 50,
      indirect_rate_percent: 10,
    });
    openCreate();
  };

  const startEdit = (account: DistributionAccount) => {
    form.setFieldsValue({
      user_id: account.user_id,
      direct_rate_percent: account.direct_rate_bps / 100,
      indirect_rate_percent: account.indirect_rate_bps / 100,
      remark: account.remark,
    });
    openEdit(account.id);
  };

  const saveMut = useMutation({
    mutationFn: (values: AccountFormValues) => {
      const rates = {
        direct_rate_bps: percentToBps(values.direct_rate_percent),
        indirect_rate_bps: percentToBps(values.indirect_rate_percent),
      };
      const remark = values.remark?.trim();
      return isEdit
        ? updateDistributionAccount(editId!, {
            ...rates,
            remark: remark ?? "",
          })
        : createDistributionAccount({
            user_id: values.user_id,
            ...rates,
            ...(remark ? { remark } : {}),
          });
    },
    onSuccess: () => {
      message.success(isEdit ? "已更新分销账号" : "已开通分销账号");
      close();
      invalidate();
    },
    onError,
  });

  const columns: TableColumnsType<DistributionAccount> = [
    {
      title: "账号",
      key: "user",
      width: 220,
      render: (_, row) => userCell(row.user_id, row.nickname, row.mobile),
    },
    {
      title: "直推比例",
      dataIndex: "direct_rate_bps",
      width: 110,
      render: (value: number) => (
        <Typography.Text className="tnum">
          {percentLabel(value)}
        </Typography.Text>
      ),
    },
    {
      title: "间推比例",
      dataIndex: "indirect_rate_bps",
      width: 110,
      render: (value: number) => (
        <span className="tnum">{percentLabel(value)}</span>
      ),
    },
    {
      title: "佣金余额",
      dataIndex: "balance_cents",
      width: 130,
      render: (value: number) => <Money cents={value} />,
    },
    {
      title: "累计佣金",
      dataIndex: "total_earned_cents",
      width: 130,
      render: (value: number) => <Money cents={value} />,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: "备注",
      dataIndex: "remark",
      width: 180,
      ellipsis: true,
      render: (value?: string) => value || "-",
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 180,
      render: (value: string) => fmtTime(value),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 150,
      render: (_, row) => (
        <Can permission={Permission.REFERRAL_WRITE} fallback={<span>-</span>}>
          <Space size="small">
            <Button
              type="link"
              size="small"
              style={{ minHeight: 40 }}
              onClick={() => startEdit(row)}
            >
              编辑
            </Button>
            <Popconfirm
              title={row.status === "enabled" ? "停用分销账号？" : "启用分销账号？"}
              description={
                row.status === "enabled"
                  ? "停用后，该账号的新订单不再产生佣金。"
                  : "启用后，新订单将按当前比例结算佣金。"
              }
              onConfirm={() =>
                row.status === "enabled"
                  ? disableMut.mutate(row.id)
                  : enableMut.mutate(row.id)
              }
            >
              <Button
                type="link"
                size="small"
                style={{ minHeight: 40 }}
                danger={row.status === "enabled"}
                loading={
                  (row.status === "enabled" ? disableMut : enableMut)
                    .isPending &&
                  (row.status === "enabled" ? disableMut : enableMut)
                    .variables === row.id
                }
              >
                {row.status === "enabled" ? "停用" : "启用"}
              </Button>
            </Popconfirm>
          </Space>
        </Can>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Text type="secondary">
          共 {total} 个分销账号；直推比例用于本人邀请的客户，间推比例用于下级邀请的客户。当前版本仅记账，暂不提供提现或打款。
        </Typography.Text>
        <Can permission={Permission.REFERRAL_WRITE}>
          <Button type="primary" onClick={startCreate}>
            开通分销账号
          </Button>
        </Can>
      </Space>

      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="用户 ID"
            style={{ width: 140 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                user_id: toPositiveInt(value),
              }))
            }
          />
          <Input.Search
            allowClear
            placeholder="手机号 / 昵称 / 邮箱"
            style={{ width: 220 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                keyword: value.trim() || undefined,
              }))
            }
          />
          <Select
            allowClear
            placeholder="账号状态"
            style={{ width: 140 }}
            options={[
              { value: "enabled", label: "已启用" },
              { value: "disabled", label: "已停用" },
            ]}
            onChange={(value: DistributionAccountStatus | undefined) =>
              setFilters((current) => ({ ...current, status: value }))
            }
          />
        </Space>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          title="分销账号加载失败"
          description={error.message}
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<DistributionAccount>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 1320 }}
        />
      </Card>

      <Modal
        title={isEdit ? `编辑分销账号 #${editId}` : "开通分销账号"}
        open={isOpen}
        onCancel={close}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => saveMut.mutate(values)}
        >
          <Form.Item
            name="user_id"
            label="用户 ID"
            rules={[{ required: true, message: "请输入用户 ID" }]}
            extra={isEdit ? "分销账号绑定的用户不可更换。" : "仅指定用户可获得分销佣金。"}
          >
            <InputNumber
              min={1}
              precision={0}
              disabled={isEdit}
              style={{ width: "100%" }}
              placeholder="请输入本地用户 ID"
            />
          </Form.Item>
          <Form.Item
            name="direct_rate_percent"
            label="直推佣金比例"
            rules={[
              { required: true, message: "请输入直推佣金比例" },
              { type: "number", min: 0, max: 100, message: "比例须在 0% 到 100% 之间" },
            ]}
            extra="该账号直接邀请的客户产生利润时使用此比例。"
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              step={0.01}
              suffix="%"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            name="indirect_rate_percent"
            label="间推佣金比例"
            rules={[
              { required: true, message: "请输入间推佣金比例" },
              { type: "number", min: 0, max: 100, message: "比例须在 0% 到 100% 之间" },
            ]}
            extra="其直接下级邀请的客户产生利润时，该账号使用此比例。"
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              step={0.01}
              suffix="%"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
            rules={[
              {
                validator: (_, value?: string) =>
                  !value || Array.from(value).length <= 500
                    ? Promise.resolve()
                    : Promise.reject(new Error("备注最多 500 个字符")),
              },
            ]}
            extra="最多 500 个字符。"
          >
            <Input.TextArea
              rows={3}
              placeholder="例如：华东渠道合作伙伴"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
