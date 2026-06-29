import { http } from "@/api/client";
import type { Plan, PlanPeriod } from "@/types/domain";

export interface PlanWriteBody {
  code?: string;
  name?: string;
  period?: PlanPeriod;
  price_cents?: number;
  base_credits?: number;
  discount_enabled?: boolean;
  discount_percent?: number; // 80=八折
  entitlements?: unknown;
  status?: string;
}

export type PlanCreateBody = PlanWriteBody &
  Required<
    Pick<
      PlanWriteBody,
      "code" | "name" | "period" | "price_cents" | "base_credits"
    >
  >;

export type PlanUpdateBody = Omit<PlanWriteBody, "code">;

export const listPlans = () => http.get<Plan[]>("/admin/plans");

export const createPlan = (body: PlanCreateBody) =>
  http.post<Plan>("/admin/plans", body);

export const updatePlan = (id: number, body: PlanUpdateBody) =>
  http.patch<Plan>(`/admin/plans/${id}`, body);

export const enablePlan = (id: number) =>
  http.post<Plan>(`/admin/plans/${id}/enable`);

export const disablePlan = (id: number) =>
  http.post<Plan>(`/admin/plans/${id}/disable`);
