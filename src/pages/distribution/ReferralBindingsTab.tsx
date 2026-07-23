import { Alert, Card, Input, Space, Table, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useState } from "react";
import { listReferralBindings } from "@/api/queries";
import { Mono } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import type { ReferralBindingItem } from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface ReferralFilters {
  referrer_user_id?: number;
  referrer_mobile?: string;
  referee_user_id?: number;
  referee_mobile?: string;
}

function toPositiveInt(value: string): number | undefined {
  const normalized = value.trim();
  const parsed = Number(normalized);
  return normalized && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}

function toOptionalString(value: string): string | undefined {
  return value.trim() || undefined;
}

function mobileCell(value?: string) {
  return value ? (
    <Mono>{value}</Mono>
  ) : (
    <Typography.Text type="secondary">手机号未回传</Typography.Text>
  );
}

export function ReferralBindingsTab() {
  const [filters, setFilters] = useState<ReferralFilters>({});
  const { items, loading, error, pagination } = usePagedList<
    ReferralBindingItem,
    ReferralFilters
  >({
    queryKey: "admin-referral-bindings",
    filters,
    fetcher: listReferralBindings,
  });

  const columns: TableColumnsType<ReferralBindingItem> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 70,
      render: (value: number) => <Mono>{value}</Mono>,
    },
    {
      title: "邀请人",
      key: "referrer",
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <span>
            <Mono>#{row.referrer_user_id}</Mono> {row.referrer_nickname || "-"}
          </span>
          {mobileCell(row.referrer_mobile)}
        </Space>
      ),
    },
    {
      title: "被邀请用户",
      key: "referee",
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <span>
            <Mono>#{row.referee_user_id}</Mono> {row.referee_nickname || "-"}
          </span>
          {mobileCell(row.referee_mobile)}
        </Space>
      ),
    },
    {
      title: "邀请码",
      dataIndex: "code",
      render: (value: string) => <Mono>{value}</Mono>,
    },
    {
      title: "绑定时间",
      dataIndex: "created_at",
      width: 180,
      render: (value: string) => fmtTime(value),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="邀请人 ID"
            style={{ width: 140 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                referrer_user_id: toPositiveInt(value),
              }))
            }
          />
          <Input.Search
            allowClear
            placeholder="邀请人手机号"
            style={{ width: 180 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                referrer_mobile: toOptionalString(value),
              }))
            }
          />
          <Input.Search
            allowClear
            placeholder="被邀请用户 ID"
            style={{ width: 160 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                referee_user_id: toPositiveInt(value),
              }))
            }
          />
          <Input.Search
            allowClear
            placeholder="被邀请用户手机号"
            style={{ width: 190 }}
            onSearch={(value) =>
              setFilters((current) => ({
                ...current,
                referee_mobile: toOptionalString(value),
              }))
            }
          />
          <Tooltip title="手机号依赖 DeepAuth 回传，历史用户可能为空。">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              邀请链本身不限制层级
            </Typography.Text>
          </Tooltip>
        </Space>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          title="邀请关系加载失败"
          description={error.message}
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ReferralBindingItem>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 900 }}
        />
      </Card>
    </Space>
  );
}
