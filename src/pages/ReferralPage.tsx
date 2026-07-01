import { useState } from "react";
import { Input, Space, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { ListPageShell } from "@/components/ListPageShell";
import { Mono } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import { listReferralBindings } from "@/api/queries";
import type { ReferralBindingItem } from "@/types/domain";
import { fmtTime } from "@/utils/format";

// 手机号可能为空(依赖 DeepAuth 回传);空时显示占位。
function mobileCell(v?: string) {
  return v ? (
    <Mono>{v}</Mono>
  ) : (
    <Typography.Text type="secondary">—</Typography.Text>
  );
}

const columns: TableColumnsType<ReferralBindingItem> = [
  { title: "ID", dataIndex: "id", width: 70, render: (v) => <Mono>{v}</Mono> },
  {
    title: "邀请人",
    key: "referrer",
    render: (_, r) => (
      <Space direction="vertical" size={0}>
        <span>
          <Mono>#{r.referrer_user_id}</Mono> {r.referrer_nickname || "-"}
        </span>
        {mobileCell(r.referrer_mobile)}
      </Space>
    ),
  },
  {
    title: "被邀请客户",
    key: "referee",
    render: (_, r) => (
      <Space direction="vertical" size={0}>
        <span>
          <Mono>#{r.referee_user_id}</Mono> {r.referee_nickname || "-"}
        </span>
        {mobileCell(r.referee_mobile)}
      </Space>
    ),
  },
  { title: "邀请码", dataIndex: "code", render: (v) => <Mono>{v}</Mono> },
  {
    title: "绑定时间",
    dataIndex: "created_at",
    width: 170,
    render: (v) => fmtTime(v),
  },
];

interface ReferralFilters {
  referrer_user_id?: number;
  referrer_mobile?: string;
  referee_user_id?: number;
  referee_mobile?: string;
}

// 把输入框空串规整成 undefined,避免给后端传空参数。
function toNum(v: string): number | undefined {
  const n = Number(v.trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
}
function toStr(v: string): string | undefined {
  return v.trim() || undefined;
}

export function ReferralPage() {
  const [filters, setFilters] = useState<ReferralFilters>({});

  const { items, loading, error, pagination } = usePagedList<
    ReferralBindingItem,
    ReferralFilters
  >({
    queryKey: "admin-referral-bindings",
    filters,
    fetcher: listReferralBindings,
  });

  return (
    <ListPageShell<ReferralBindingItem>
      title="销售数据"
      filters={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="邀请人 ID"
            style={{ width: 140 }}
            onSearch={(v) =>
              setFilters((f) => ({ ...f, referrer_user_id: toNum(v) }))
            }
          />
          <Input.Search
            allowClear
            placeholder="邀请人手机号"
            style={{ width: 180 }}
            onSearch={(v) =>
              setFilters((f) => ({ ...f, referrer_mobile: toStr(v) }))
            }
          />
          <Input.Search
            allowClear
            placeholder="被邀请客户 ID"
            style={{ width: 140 }}
            onSearch={(v) =>
              setFilters((f) => ({ ...f, referee_user_id: toNum(v) }))
            }
          />
          <Input.Search
            allowClear
            placeholder="被邀请客户手机号"
            style={{ width: 180 }}
            onSearch={(v) =>
              setFilters((f) => ({ ...f, referee_mobile: toStr(v) }))
            }
          />
          <Tooltip title="手机号依赖 DeepAuth 回传,历史用户可能为空,显示 —">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              手机号回传后可查
            </Typography.Text>
          </Tooltip>
        </Space>
      }
      columns={columns}
      dataSource={items}
      rowKey="id"
      loading={loading}
      error={error}
      pagination={pagination}
    />
  );
}
