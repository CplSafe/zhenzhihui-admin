import { App, Alert, Button, Card, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listDistributionCommissions,
  retryDistributionSettlement,
} from "@/api/distribution";
import { Can } from "@/components/Can";
import { Count, Money, Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";
import type {
  DistributionCommission,
  DistributionSettlementStatus,
} from "@/types/distribution";
import { fmtTime } from "@/utils/format";

const LIST_QUERY_KEY = "admin-distribution-commissions";

interface CommissionFilters {
  beneficiary_user_id?: number;
  customer_user_id?: number;
  payment_order_id?: number;
  status?: DistributionSettlementStatus;
}

function toPositiveInt(value: string): number | undefined {
  const normalized = value.trim();
  const parsed = Number(normalized);
  return normalized && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}

function identityCell(userId?: number, mobile?: string) {
  if (!userId) return <Typography.Text type="secondary">-</Typography.Text>;
  return (
    <Space orientation="vertical" size={0}>
      <Mono>#{userId}</Mono>
      <Typography.Text type="secondary">
        {mobile ? <Mono>{mobile}</Mono> : "手机号未回传"}
      </Typography.Text>
    </Space>
  );
}

function isRetryable(row: DistributionCommission): boolean {
  // 一次结算最多有两条流水，只在首行（或无流水的结算行）展示一次重试入口。
  return (
    row.settlement_status === "blocked" && row.relation_level !== 2
  );
}

export function DistributionCommissionsTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CommissionFilters>({});

  const { items, loading, error, pagination } = usePagedList<
    DistributionCommission,
    CommissionFilters
  >({
    queryKey: LIST_QUERY_KEY,
    filters,
    fetcher: listDistributionCommissions,
  });

  const retryMut = useMutation({
    mutationFn: retryDistributionSettlement,
    onSuccess: () => {
      message.success("已重新提交佣金结算");
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
    },
    onError: (error: unknown) => {
      message.error(error instanceof ApiError ? error.message : "重试失败");
    },
  });

  const columns: TableColumnsType<DistributionCommission> = [
    {
      title: "流水 / 结算",
      key: "ids",
      width: 130,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          {row.id > 0 ? (
            <span>流水 <Mono>#{row.id}</Mono></span>
          ) : (
            <Typography.Text type="secondary">无佣金条目</Typography.Text>
          )}
          <Typography.Text type="secondary">
            结算 <Mono>#{row.settlement_id}</Mono>
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "支付订单",
      key: "order",
      width: 180,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Mono>#{row.payment_order_id}</Mono>
          <Typography.Text type="secondary">
            {row.order_type}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "客户",
      key: "customer",
      width: 170,
      render: (_, row) =>
        identityCell(row.customer_user_id, row.customer_mobile),
    },
    {
      title: "受益人",
      key: "beneficiary",
      width: 170,
      render: (_, row) =>
        identityCell(row.beneficiary_user_id, row.beneficiary_mobile),
    },
    {
      title: "关系",
      key: "relation",
      width: 110,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          {row.relation_level ? (
            <>
              <Tag className="tnum">{row.relation_level} 级</Tag>
              <span className="tnum">
                {((row.rate_bps ?? 0) / 100).toFixed(2)}%
              </span>
            </>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: "佣金",
      dataIndex: "amount_cents",
      width: 120,
      render: (value?: number) =>
        value === undefined ? "-" : <Money cents={value} />,
    },
    {
      title: "利润核算",
      key: "profit",
      width: 190,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <span>实收 <Money cents={row.revenue_cents} /></span>
          <Typography.Text type="secondary">
            <Count value={row.credits} /> 积分 · 成本 <Money cents={row.cost_cents} />
            {` `}（<Money cents={row.cost_cents_per_1000_credits} />/千积分）
          </Typography.Text>
          <span>利润 <Money cents={row.profit_cents} /></span>
        </Space>
      ),
    },
    {
      title: "状态",
      key: "status",
      width: 170,
      render: (_, row) => (
        <Space orientation="vertical" size={2}>
          <Space size={4} wrap>
            <StatusTag status={row.settlement_status} />
            {row.entry_status && <StatusTag status={row.entry_status} />}
          </Space>
          {(row.block_reason || row.skip_reason) && (
            <Tooltip title={row.block_reason || row.skip_reason}>
              <Typography.Text type="danger" ellipsis style={{ maxWidth: 150 }}>
                {row.block_reason || row.skip_reason}
              </Typography.Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 180,
      render: (value: string) => fmtTime(value),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 90,
      render: (_, row) =>
        isRetryable(row) ? (
          <Can permission={Permission.REFERRAL_WRITE} fallback={<span>-</span>}>
            <Popconfirm
              title="重新结算这笔佣金？"
              description="请先确认导致异常或跳过的原因已经处理。"
              onConfirm={() => retryMut.mutate(row.settlement_id)}
            >
              <Button
                type="link"
                size="small"
                style={{ minHeight: 40 }}
                loading={
                  retryMut.isPending &&
                  retryMut.variables === row.settlement_id
                }
              >
                重试
              </Button>
            </Popconfirm>
          </Can>
        ) : (
          <span>-</span>
        ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="受益人用户 ID"
            style={{ width: 170 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                beneficiary_user_id: toPositiveInt(value),
              }))
            }
          />
          <Input.Search
            allowClear
            placeholder="客户用户 ID"
            style={{ width: 160 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                customer_user_id: toPositiveInt(value),
              }))
            }
          />
          <Input.Search
            allowClear
            placeholder="支付订单 ID"
            style={{ width: 160 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                payment_order_id: toPositiveInt(value),
              }))
            }
          />
          <Select
            allowClear
            placeholder="结算状态"
            style={{ width: 170 }}
            options={[
              { value: "settled", label: "已结算" },
              { value: "blocked", label: "配置异常" },
              { value: "disabled", label: "总开关关闭" },
              { value: "no_profit", label: "无可返利润" },
              { value: "no_referrer", label: "无邀请关系" },
            ]}
            onChange={(value: DistributionSettlementStatus | undefined) =>
              setFilters((current) => ({
                ...current,
                status: value,
              }))
            }
          />
        </Space>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          title="佣金流水加载失败"
          description={error.message}
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<DistributionCommission>
          rowKey={(row) =>
            row.id > 0
              ? `entry-${row.id}`
              : `settlement-${row.settlement_id}`
          }
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 1550 }}
        />
      </Card>
    </Space>
  );
}
