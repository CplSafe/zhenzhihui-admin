import {
  App,
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
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
  DistributionSalesType,
} from "@/types/distribution";
import { fmtTime } from "@/utils/format";

const LIST_QUERY_KEY = "admin-distribution-accounts";
interface AccountFilters {
  user_id?: number;
  status?: DistributionAccountStatus;
  sales_type?: DistributionSalesType;
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
  user_id?: number;
  mobile?: string;
  sales_type: DistributionSalesType;
  customer_discount_fold: number;
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

function discountLabel(bps: number): string {
  return `${Number((bps / 1000).toFixed(3))} 折`;
}

function discountFoldToBps(fold: number): number {
  return Math.round(fold * 1000);
}

const SALES_TYPE_OPTIONS = [
  { value: "company", label: "公司销售" },
  { value: "bytedance", label: "字节销售" },
  { value: "partner", label: "合作伙伴" },
] satisfies Array<{ value: DistributionSalesType; label: string }>;

function salesTypeLabel(value: DistributionSalesType): string {
  return (
    SALES_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

function toggleDescription(account: DistributionAccount): string {
  if (account.sales_type === "partner") {
    return account.status === "enabled"
      ? "停用后，该账号的新订单不再产生佣金。"
      : "启用后，该账号的新订单将按当前比例结算佣金。";
  }
  return account.status === "enabled"
    ? "停用后，新订单不再产生佣金，其直属客户也不再享受销售折扣。"
    : "启用后，新订单按当前比例结算佣金，直属客户恢复销售折扣。";
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
  const selectedSalesType = Form.useWatch("sales_type", form);
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
      sales_type: "company",
      customer_discount_fold: 10,
      direct_rate_percent: 50,
      indirect_rate_percent: 10,
    });
    openCreate();
  };

  const startEdit = (account: DistributionAccount) => {
    form.resetFields();
    form.setFieldsValue({
      user_id: account.user_id,
      sales_type: account.sales_type,
      customer_discount_fold:
        account.sales_type === "partner"
          ? 10
          : account.customer_discount_bps / 1000,
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
      const salesConfig = {
        sales_type: values.sales_type,
        customer_discount_bps:
          values.sales_type === "partner"
            ? 10000
            : discountFoldToBps(values.customer_discount_fold),
      };
      const remark = values.remark?.trim();
      if (isEdit) {
        return updateDistributionAccount(editId!, {
          ...salesConfig,
          ...rates,
          remark: remark ?? "",
        });
      }
      const mobile = values.mobile?.trim();
      if (!mobile) {
        throw new Error("请输入手机号");
      }
      return createDistributionAccount({
        mobile,
        ...salesConfig,
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
      title: "销售类型",
      dataIndex: "sales_type",
      width: 110,
      render: (value: DistributionSalesType) => (
        <Tag>{salesTypeLabel(value)}</Tag>
      ),
    },
    {
      title: "客户订阅折扣",
      dataIndex: "customer_discount_bps",
      width: 130,
      render: (value: number, row) =>
        row.sales_type === "partner" ? (
          <Typography.Text type="secondary">不参与折上折</Typography.Text>
        ) : (
          <span className="tnum">{discountLabel(value)}</span>
        ),
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
              description={toggleDescription(row)}
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
          {`共 ${total} 个分销账号；` +
            "公司/字节销售的客户订阅折扣会叠加在套餐活动价上，" +
            "合作伙伴不参与折上折；直推/间推比例仅用于利润返佣。" +
            "提现申请与打款结果请在“提现审批”中处理。"}
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
            placeholder="销售类型"
            style={{ width: 140 }}
            options={SALES_TYPE_OPTIONS}
            onChange={(value: DistributionSalesType | undefined) =>
              setFilters((current) => ({ ...current, sales_type: value }))
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
          scroll={{ x: 1560 }}
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
          {isEdit ? (
            <Form.Item
              name="user_id"
              label="绑定用户 ID"
              extra="分销账号绑定的用户不可更换。"
            >
              <InputNumber disabled style={{ width: "100%" }} />
            </Form.Item>
          ) : (
            <Form.Item
              name="mobile"
              label="用户手机号"
              rules={[
                { required: true, message: "请输入手机号" },
                { max: 32, message: "手机号最多 32 个字符" },
              ]}
              extra="请输入已注册用户的手机号；系统会精确匹配，不会自动创建用户。"
            >
              <Input
                allowClear
                autoComplete="tel"
                inputMode="tel"
                maxLength={32}
                placeholder="例如：13800138000"
              />
            </Form.Item>
          )}
          <Form.Item
            name="sales_type"
            label="销售类型"
            rules={[{ required: true, message: "请选择销售类型" }]}
          >
            <Select
              options={SALES_TYPE_OPTIONS}
              onChange={(value: DistributionSalesType) => {
                if (value === "partner") {
                  form.setFieldValue("customer_discount_fold", 10);
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="customer_discount_fold"
            label="客户订阅折扣"
            rules={[
              { required: true, message: "请输入客户订阅折扣" },
              {
                type: "number",
                min: 0.001,
                max: 10,
                message: "折扣须在 0.001 折到 10 折之间",
              },
            ]}
            extra={
              selectedSalesType === "partner"
                ? "合作伙伴不参与折上折，客户订阅折扣固定为 10 折。"
                : "在套餐活动价基础上继续折扣；9 折对应后端 9000，" +
                  "10 折表示不追加优惠。"
            }
          >
            <InputNumber
              min={0.001}
              max={10}
              precision={3}
              step={0.1}
              suffix="折"
              disabled={selectedSalesType === "partner"}
              style={{ width: "100%" }}
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
