import { http } from "@/api/client";
import { listGet } from "@/api/queries";
import type { ModelVersion } from "@/types/domain";

export interface ModelListParams {
  provider?: string;
  enabled?: string;
  limit?: number;
  offset?: number;
}

export interface ModelWriteBody {
  provider?: string;
  model?: string;
  version?: string;
  display_name?: string;
  capability?: string;
  enabled?: boolean;
  task_mode?: string;
  allowed_plans?: string[];
  operation_codes?: string[];
  params_schema?: unknown;
  pricing?: unknown;
  result_schema?: unknown;
  system_prompts?: Record<string, string>;
}

export const listModels = listGet<ModelVersion, ModelListParams>(
  "/admin/models",
);

export const getModel = (id: number) =>
  http.get<ModelVersion>(`/admin/models/${id}`);

export const createModel = (body: ModelWriteBody) =>
  http.post<ModelVersion>("/admin/models", body);

export const updateModel = (id: number, body: ModelWriteBody) =>
  http.patch<ModelVersion>(`/admin/models/${id}`, body);

export const enableModel = (id: number) =>
  http.post<ModelVersion>(`/admin/models/${id}/enable`);

export const disableModel = (id: number) =>
  http.post<ModelVersion>(`/admin/models/${id}/disable`);

export interface TestConnectionBody {
  operation_code?: string;
  prompt?: string;
}

export interface TestConnectionResult {
  reply: string;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_credits: number;
}

// 测连通:用模型当前配置真实发一条 chat,返回回复 + token + 扣费预览(后端不计费、不入库)。
export const testModelConnection = (id: number, body: TestConnectionBody) =>
  http.post<TestConnectionResult>(`/admin/models/${id}/test-connection`, body);
