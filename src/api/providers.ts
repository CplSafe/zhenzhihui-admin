import { http } from "@/api/client";
import type { ProviderConfigView } from "@/types/domain";

export const listProviderConfigs = () =>
  http.get<ProviderConfigView[]>("/admin/settings/providers");

export interface ProviderUpdateBody {
  base_url: string;
  timeout_seconds: number;
  // 不传 = 保留原 key;空串 = 清空;非空 = 覆盖。
  api_key?: string;
  access_key?: string;
  secret_key?: string;
  project_name?: string;
  region?: string;
}
export const updateProviderConfig = (
  provider: string,
  body: ProviderUpdateBody,
) =>
  http.put<ProviderConfigView>(`/admin/settings/providers/${provider}`, body);

export interface ProviderTestResult {
  ok: boolean;
  http_status?: number;
  message: string;
}
export interface ProviderTestBody {
  base_url: string;
  timeout_seconds: number;
  // 不传 = 用已保存的 key 测;传值 = 用该明文测(测未保存的配置)。
  api_key?: string;
}
export const testProviderConnection = (
  provider: string,
  body: ProviderTestBody,
) =>
  http.post<ProviderTestResult>(
    `/admin/settings/providers/${provider}/test`,
    body,
  );
