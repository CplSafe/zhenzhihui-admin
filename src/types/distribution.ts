import type { PaymentOrderType } from "@/types/domain";

export interface DistributionConfig {
  enabled: boolean;
  cost_cents_per_1000_credits: number;
}

export type DistributionAccountStatus = "enabled" | "disabled";
export type DistributionSalesType = "company" | "bytedance" | "partner";

export type DistributionSettlementStatus =
  | "disabled"
  | "no_profit"
  | "no_referrer"
  | "settled"
  | "blocked";

export type DistributionEntryStatus =
  | "credited"
  | "ineligible"
  | "zero"
  | "blocked";

export type DistributionWithdrawalStatus = "pending" | "paid" | "rejected";
export type DistributionWithdrawalMethodType =
  | "alipay"
  | "wechat"
  | "bank_card";

export interface DistributionAccount {
  id: number;
  user_id: number;
  mobile?: string;
  nickname?: string;
  status: DistributionAccountStatus;
  sales_type: DistributionSalesType;
  customer_discount_bps: number;
  direct_rate_bps: number;
  indirect_rate_bps: number;
  balance_cents: number;
  total_earned_cents: number;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface DistributionCommission {
  id: number;
  settlement_id: number;
  payment_order_id: number;
  customer_user_id: number;
  customer_mobile?: string;
  beneficiary_user_id?: number;
  beneficiary_mobile?: string;
  relation_level?: number;
  rate_bps?: number;
  amount_cents?: number;
  entry_status?: DistributionEntryStatus;
  skip_reason?: string;
  block_reason?: string;
  revenue_cents: number;
  credits: number;
  cost_cents_per_1000_credits: number;
  cost_cents: number;
  profit_cents: number;
  settlement_status: DistributionSettlementStatus;
  order_type: PaymentOrderType;
  created_at: string;
}

export interface DistributionWithdrawal {
  id: number;
  distributor_account_id: number;
  user_id: number;
  withdrawal_method_id: number;
  method_type: DistributionWithdrawalMethodType;
  account_name: string;
  account_number: string;
  bank_name?: string;
  amount_cents: number;
  status: DistributionWithdrawalStatus;
  reviewed_at?: string;
  reviewed_by_admin_user_id?: number;
  review_remark?: string;
  mobile?: string;
  nickname?: string;
  email?: string;
  deepauth_user_id: string;
  created_at: string;
  updated_at: string;
}
