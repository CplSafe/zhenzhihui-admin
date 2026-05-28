import { http } from '@/api/client'
import type { ProviderConfigView } from '@/types/domain'

export const listProviderConfigs = () =>
  http.get<ProviderConfigView[]>('/admin/settings/providers')

export interface ProviderUpdateBody {
  base_url: string
  timeout_seconds: number
  // 不传 = 保留原 key;空串 = 清空;非空 = 覆盖。
  api_key?: string
}
export const updateProviderConfig = (provider: string, body: ProviderUpdateBody) =>
  http.put<ProviderConfigView>(`/admin/settings/providers/${provider}`, body)
