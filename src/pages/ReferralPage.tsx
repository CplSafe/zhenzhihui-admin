import { Space, Tabs, Typography } from "antd";
import { DistributionAccountsTab } from "@/pages/distribution/DistributionAccountsTab";
import { DistributionCommissionsTab } from "@/pages/distribution/DistributionCommissionsTab";
import { DistributionConfigTab } from "@/pages/distribution/DistributionConfigTab";
import { ReferralBindingsTab } from "@/pages/distribution/ReferralBindingsTab";
import { DistributionWithdrawalsTab } from "@/pages/distribution/DistributionWithdrawalsTab";

export function ReferralPage() {
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 300 }}>
          分销管理
        </Typography.Title>
        <Typography.Text type="secondary">
          邀请关系可无限延伸，每笔实付订单只结算真实直推与间推两级；普通或停用账号占据原层级，不向上补位。
        </Typography.Text>
      </div>

      <Tabs
        defaultActiveKey="accounts"
        items={[
          {
            key: "accounts",
            label: "分销账号",
            children: <DistributionAccountsTab />,
          },
          {
            key: "commissions",
            label: "佣金流水",
            children: <DistributionCommissionsTab />,
          },
          {
            key: "withdrawals",
            label: "提现审批",
            children: <DistributionWithdrawalsTab />,
          },
          {
            key: "bindings",
            label: "邀请关系",
            children: <ReferralBindingsTab />,
          },
          {
            key: "config",
            label: "全局配置",
            children: <DistributionConfigTab />,
          },
        ]}
      />
    </Space>
  );
}
