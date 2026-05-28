import { http } from "@/api/client";
import type { GrantPlanResult, Wallet } from "@/types/domain";

export interface GrantPlanBody {
  plan_id: number;
  // true 时按套餐 base_credits 累加积分。
  grant_credits: boolean;
}
export const grantPlan = (workspaceId: number, body: GrantPlanBody) =>
  http.post<GrantPlanResult>(
    `/admin/workspaces/${workspaceId}/grant-plan`,
    body,
  );

export interface AdjustCreditsBody {
  // 累加值,必须 > 0(不覆盖现有余额)。
  amount: number;
  reason?: string;
}
export const adjustCredits = (workspaceId: number, body: AdjustCreditsBody) =>
  http.post<Wallet>(`/admin/workspaces/${workspaceId}/adjust-credits`, body);
