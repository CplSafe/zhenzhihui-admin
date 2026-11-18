import { http } from "@/api/client";

export type BillSource = "volcengine" | "aliyun";
export interface BillingConfig {
  source: BillSource;
  account_label: string;
  products: string[];
  local_providers: string[];
  exclusive: boolean;
  configured: boolean;
}
export interface BillingConfigInput {
  account_label: string;
  products: string[];
  local_providers: string[];
  exclusive: boolean;
  access_key?: string;
  secret_key?: string;
}
export interface BillProduct {
  code: string;
  name: string;
  currency: string;
  gross: string;
  payable: string;
  rows: number;
}
export interface ProviderBill {
  source: BillSource;
  month: string;
  status: string;
  error?: string;
  synced_at: string | null;
  config_changed: boolean;
  provisional: boolean;
  snapshot: null | {
    config: BillingConfig;
    products: BillProduct[];
    gross: string;
    payable: string;
    difference: string;
    local_estimate: string;
    task_count: number;
    unknown_cost_count: number;
    pending_count: number;
    failed_count: number;
    comparable: boolean;
  };
}
export const listProviderBills = (month: string) =>
  http.get<ProviderBill[]>("/admin/billing/provider-bills", {
    params: { month },
  });
export const listBillingConfigs = () =>
  http.get<BillingConfig[]>("/admin/settings/billing");
export const saveBillingConfig = (
  source: BillSource,
  body: BillingConfigInput,
) => http.put<BillingConfig>(`/admin/settings/billing/${source}`, body);
export const syncProviderBill = (source: BillSource, month: string) =>
  http.post<ProviderBill[]>(
    `/admin/billing/provider-bills/${source}/sync`,
    { month },
    { timeout: 110_000 },
  );
export const rawBillUrl = (source: BillSource, month: string) =>
  `${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/admin/billing/provider-bills/${source}/raw?month=${encodeURIComponent(month)}`;
