import {
  App,
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  confirmDistributionWithdrawal,
  listDistributionWithdrawals,
  rejectDistributionWithdrawal,
} from "@/api/distribution";
import { Can } from "@/components/Can";
import { Money, Mono } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type {
  DistributionWithdrawal,
  DistributionWithdrawalMethodType,
  DistributionWithdrawalStatus,
} from "@/types/distribution";
import { fmtTime } from "@/utils/format";

const LIST_QUERY_KEY = "admin-distribution-withdrawals";

interface WithdrawalFilters {
  user_id?: number;
  distributor_account_id?: number;
  status?: DistributionWithdrawalStatus;
}

interface ReviewFormValues {
  remark?: string;
}

interface ReviewTarget {
  withdrawal: DistributionWithdrawal;
  action: "confirm" | "reject";
}

type IDFilterKey = "user_id" | "distributor_account_id";

const STATUS_META: Record<
  DistributionWithdrawalStatus,
  { label: string; color: string }
> = {
  pending: { label: "待审批", color: "gold" },
  paid: { label: "已打款", color: "green" },
  rejected: { label: "已驳回", color: "red" },
};

const METHOD_LABEL: Record<DistributionWithdrawalMethodType, string> = {
  alipay: "支付宝",
  wechat: "微信",
  bank_card: "银行卡",
};

function StatusCell({ status }: { status: DistributionWithdrawalStatus }) {
  const meta = STATUS_META[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function DistributionWithdrawalsTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ReviewFormValues>();
  const [filters, setFilters] = useState<WithdrawalFilters>({
    status: "pending",
  });
  const [userIDInput, setUserIDInput] = useState("");
  const [accountIDInput, setAccountIDInput] = useState("");
  const [invalidIDFilters, setInvalidIDFilters] = useState<
    Partial<Record<IDFilterKey, boolean>>
  >({});
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>();

  const {
    items,
    total,
    loading,
    error,
    pagination,
    refetch,
    resetPage,
  } = usePagedList<
    DistributionWithdrawal,
    WithdrawalFilters
  >({
    queryKey: LIST_QUERY_KEY,
    filters,
    fetcher: listDistributionWithdrawals,
  });

  const reviewMut = useMutation({
    mutationFn: async ({
      target,
      remark,
    }: {
      target: ReviewTarget;
      remark: string;
    }) => {
      const body = { remark };
      return target.action === "confirm"
        ? confirmDistributionWithdrawal(target.withdrawal.id, body)
        : rejectDistributionWithdrawal(target.withdrawal.id, body);
    },
    onSuccess: (_, variables) => {
      message.success(
        variables.target.action === "confirm"
          ? "已确认打款"
          : "已驳回，提现金额已退回销售余额",
      );
      setReviewTarget(undefined);
      form.resetFields();
      resetPage();
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: ["admin-distribution-accounts"],
      });
    },
    onError: (error: unknown) => {
      message.error(error instanceof ApiError ? error.message : "审批失败");
    },
  });

  const openReview = (
    withdrawal: DistributionWithdrawal,
    action: ReviewTarget["action"],
  ) => {
    form.resetFields();
    setReviewTarget({ withdrawal, action });
  };

  const applyIDFilter = (key: IDFilterKey, rawValue: string) => {
    const value = rawValue.trim();
    if (value === "") {
      setInvalidIDFilters((current) => ({ ...current, [key]: false }));
      setFilters((current) => ({ ...current, [key]: undefined }));
      return;
    }
    if (!/^[1-9]\d*$/.test(value)) {
      setInvalidIDFilters((current) => ({ ...current, [key]: true }));
      return;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      setInvalidIDFilters((current) => ({ ...current, [key]: true }));
      return;
    }
    setInvalidIDFilters((current) => ({ ...current, [key]: false }));
    setFilters((current) => ({ ...current, [key]: parsed }));
  };

  const columns: TableColumnsType<DistributionWithdrawal> = [
    {
      title: "提现单",
      key: "withdrawal",
      width: 150,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Mono>#{row.id}</Mono>
          <Typography.Text type="secondary">
            {fmtTime(row.created_at)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "销售",
      key: "seller",
      width: 210,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <span>
            {row.nickname || "未设置昵称"} <Mono>#{row.user_id}</Mono>
          </span>
          <Typography.Text type="secondary">
            {row.mobile ? <Mono>{row.mobile}</Mono> : row.email || "-"}
          </Typography.Text>
          <Typography.Text type="secondary">
            分销账号 <Mono>#{row.distributor_account_id}</Mono>
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "提现金额",
      dataIndex: "amount_cents",
      width: 130,
      render: (value: number) => (
        <Typography.Text strong>
          <Money cents={value} />
        </Typography.Text>
      ),
    },
    {
      title: "收款方式",
      key: "method",
      width: 260,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <span>
            <Tag>{METHOD_LABEL[row.method_type]}</Tag>
            {row.account_name}
          </span>
          <Typography.Text copyable={{ text: row.account_number }}>
            <Mono>{row.account_number}</Mono>
          </Typography.Text>
          {row.bank_name && (
            <Typography.Text type="secondary">
              {row.bank_name}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (status: DistributionWithdrawalStatus) => (
        <StatusCell status={status} />
      ),
    },
    {
      title: "审批结果",
      key: "review",
      width: 230,
      render: (_, row) =>
        row.reviewed_at ? (
          <Space orientation="vertical" size={0}>
            <span>{fmtTime(row.reviewed_at)}</span>
            <Typography.Text type="secondary">
              审批人 <Mono>#{row.reviewed_by_admin_user_id}</Mono>
            </Typography.Text>
            <Typography.Text ellipsis={{ tooltip: row.review_remark }}>
              {row.review_remark || "无备注"}
            </Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">等待审批</Typography.Text>
        ),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 150,
      render: (_, row) =>
        row.status === "pending" ? (
          <Can permission={Permission.REFERRAL_WRITE} fallback={<span>-</span>}>
            <Space size="small">
              <Button
                type="link"
                size="small"
                style={{ minHeight: 40 }}
                onClick={() => openReview(row, "confirm")}
              >
                确认打款
              </Button>
              <Button
                type="link"
                size="small"
                danger
                style={{ minHeight: 40 }}
                onClick={() => openReview(row, "reject")}
              >
                驳回
              </Button>
            </Space>
          </Can>
        ) : (
          <span>-</span>
        ),
    },
  ];

  const isConfirm = reviewTarget?.action === "confirm";

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        title={`当前筛选共 ${total} 笔提现申请`}
        description="确认打款前，请核对收款人、完整收款账号和金额；驳回后申请金额会自动退回销售的可提现余额。"
      />

      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Space orientation="vertical" size={2}>
            <Input.Search
              allowClear
              inputMode="numeric"
              placeholder="销售用户 ID"
              value={userIDInput}
              status={invalidIDFilters.user_id ? "error" : undefined}
              style={{ width: 160 }}
              onChange={(event) => {
                setUserIDInput(event.target.value);
                if (event.target.value === "") applyIDFilter("user_id", "");
              }}
              onSearch={(value) => applyIDFilter("user_id", value)}
            />
            {invalidIDFilters.user_id && (
              <Typography.Text type="danger">请输入正整数</Typography.Text>
            )}
          </Space>
          <Space orientation="vertical" size={2}>
            <Input.Search
              allowClear
              inputMode="numeric"
              placeholder="分销账号 ID"
              value={accountIDInput}
              status={
                invalidIDFilters.distributor_account_id
                  ? "error"
                  : undefined
              }
              style={{ width: 160 }}
              onChange={(event) => {
                setAccountIDInput(event.target.value);
                if (event.target.value === "") {
                  applyIDFilter("distributor_account_id", "");
                }
              }}
              onSearch={(value) =>
                applyIDFilter("distributor_account_id", value)
              }
            />
            {invalidIDFilters.distributor_account_id && (
              <Typography.Text type="danger">请输入正整数</Typography.Text>
            )}
          </Space>
          <Select
            allowClear
            placeholder="提现状态"
            value={filters.status}
            style={{ width: 150 }}
            options={Object.entries(STATUS_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
            onChange={(status: DistributionWithdrawalStatus | undefined) =>
              setFilters((current) => ({ ...current, status }))
            }
          />
          <Button onClick={() => refetch()} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          title="提现申请加载失败"
          description={error.message}
          action={<Button onClick={() => refetch()}>重试</Button>}
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<DistributionWithdrawal>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 1230 }}
          locale={{ emptyText: "当前筛选条件下暂无提现申请" }}
        />
      </Card>

      <Modal
        title={isConfirm ? "确认提现已打款" : "驳回提现申请"}
        open={Boolean(reviewTarget)}
        okText={isConfirm ? "确认已打款" : "确认驳回"}
        okButtonProps={{ danger: !isConfirm }}
        confirmLoading={reviewMut.isPending}
        destroyOnHidden
        closable={!reviewMut.isPending}
        keyboard={!reviewMut.isPending}
        maskClosable={!reviewMut.isPending}
        onCancel={() => {
          if (reviewMut.isPending) return;
          setReviewTarget(undefined);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        {reviewTarget && (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              type={isConfirm ? "warning" : "info"}
              showIcon
              title={
                isConfirm
                  ? "只有在线下转账成功后才能确认"
                  : "驳回后金额将自动退回销售余额"
              }
              description={
                <span>
                  提现单 <Mono>#{reviewTarget.withdrawal.id}</Mono>，金额{" "}
                  <Money cents={reviewTarget.withdrawal.amount_cents} />
                </span>
              }
            />
            <Descriptions
              size="small"
              bordered
              column={1}
              items={[
                {
                  key: "seller",
                  label: "销售",
                  children: (
                    <span>
                      {reviewTarget.withdrawal.nickname || "未设置昵称"}{" "}
                      <Mono>#{reviewTarget.withdrawal.user_id}</Mono>{" "}
                      {reviewTarget.withdrawal.mobile && (
                        <Mono>{reviewTarget.withdrawal.mobile}</Mono>
                      )}
                    </span>
                  ),
                },
                {
                  key: "method",
                  label: "收款方式",
                  children:
                    METHOD_LABEL[reviewTarget.withdrawal.method_type],
                },
                {
                  key: "account_name",
                  label: "收款人",
                  children: reviewTarget.withdrawal.account_name,
                },
                {
                  key: "account_number",
                  label: "收款账号",
                  children: (
                    <Typography.Text
                      copyable={{ text: reviewTarget.withdrawal.account_number }}
                    >
                      <Mono>{reviewTarget.withdrawal.account_number}</Mono>
                    </Typography.Text>
                  ),
                },
                ...(reviewTarget.withdrawal.bank_name
                  ? [
                      {
                        key: "bank_name",
                        label: "开户行",
                        children: reviewTarget.withdrawal.bank_name,
                      },
                    ]
                  : []),
              ]}
            />
            <Form
              form={form}
              layout="vertical"
              onFinish={(values) =>
                reviewMut.mutate({
                  target: reviewTarget,
                  remark: values.remark?.trim() || "",
                })
              }
            >
              <Form.Item
                name="remark"
                label={isConfirm ? "打款备注" : "驳回原因"}
                rules={
                  isConfirm
                    ? [{ max: 500, message: "备注最多 500 个字符" }]
                    : [
                        { required: true, whitespace: true, message: "请输入驳回原因" },
                        { max: 500, message: "驳回原因最多 500 个字符" },
                      ]
                }
              >
                <Input.TextArea
                  rows={4}
                  maxLength={500}
                  showCount
                  placeholder={
                    isConfirm
                      ? "可填写转账流水号或其他说明"
                      : "请说明驳回原因，方便后续核对"
                  }
                />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>
    </Space>
  );
}
