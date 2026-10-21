import { http } from "@/api/client";
import type { BusinessAbility } from "@/types/domain";

export interface AbilityCreateBody {
  code: string;
  display_name: string;
  description: string;
  enabled: boolean;
  operation_code: string;
  execution_operation_code: string;
  tool_code: string;
  tool_version: number;
  default_model_version_id: number;
}

// Only the stable ability identity is immutable after creation.
export type AbilityPatchBody = Partial<
  Pick<
    AbilityCreateBody,
    | "display_name"
    | "description"
    | "enabled"
    | "default_model_version_id"
    | "operation_code"
    | "execution_operation_code"
    | "tool_code"
    | "tool_version"
  >
>;

export const listAbilities = () =>
  http.get<BusinessAbility[]>("/admin/abilities");
export const createAbility = (body: AbilityCreateBody) =>
  http.post<BusinessAbility>("/admin/abilities", body);
export const updateAbility = (code: string, body: AbilityPatchBody) =>
  http.patch<BusinessAbility>(
    `/admin/abilities/${encodeURIComponent(code)}`,
    body,
  );
