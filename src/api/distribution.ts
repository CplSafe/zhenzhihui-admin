import { http } from "@/api/client";
import { qs } from "@/api/queries";
import type { ListPage, PageParams } from "@/types/domain";
import type {
  DistributionAccount,
  DistributionAccountStatus,
  DistributionCommission,
  DistributionConfig,
  DistributionSalesType,
  DistributionSettlementStatus,
} from "@/types/distribution";

export interface DistributionAccountListParams extends PageParams {
  user_id?: number;
  status?: DistributionAccountStatus;
  sales_type?: DistributionSalesType;
  keyword?: string;
}

export interface DistributionAccountCreateBody {
  user_id: number;
  sales_type: DistributionSalesType;
  customer_discount_bps: number;
  direct_rate_bps: number;
  indirect_rate_bps: number;
  remark?: string;
}

export type DistributionAccountUpdateBody = Omit<
  DistributionAccountCreateBody,
  "user_id"
>;

export interface DistributionCommissionListParams extends PageParams {
  beneficiary_user_id?: number;
  customer_user_id?: number;
  payment_order_id?: number;
  status?: DistributionSettlementStatus;
}

export const getDistributionConfig = () =>
  http.get<DistributionConfig>("/admin/distribution/config");

export const updateDistributionConfig = (body: DistributionConfig) =>
  http.put<DistributionConfig>("/admin/distribution/config", body);

export const listDistributionAccounts = (
  params: DistributionAccountListParams = {},
) =>
  http.get<ListPage<DistributionAccount>>(
    `/admin/distribution/accounts${qs(params)}`,
  );

export const createDistributionAccount = (
  body: DistributionAccountCreateBody,
) => http.post<DistributionAccount>("/admin/distribution/accounts", body);

export const updateDistributionAccount = (
  id: number,
  body: DistributionAccountUpdateBody,
) =>
  http.patch<DistributionAccount>(`/admin/distribution/accounts/${id}`, body);

export const enableDistributionAccount = (id: number) =>
  http.post<DistributionAccount>(
    `/admin/distribution/accounts/${id}/enable`,
  );

export const disableDistributionAccount = (id: number) =>
  http.post<DistributionAccount>(
    `/admin/distribution/accounts/${id}/disable`,
  );

export const listDistributionCommissions = (
  params: DistributionCommissionListParams = {},
) =>
  http.get<ListPage<DistributionCommission>>(
    `/admin/distribution/commissions${qs(params)}`,
  );

export const retryDistributionSettlement = (settlementId: number) =>
  http.post<unknown>(
    `/admin/distribution/settlements/${settlementId}/retry`,
  );
