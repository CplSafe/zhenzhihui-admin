import { http } from '@/api/client'
import { qs } from '@/api/queries'
import type { ListPage } from '@/types/domain'
export type LogKind = 'request' | 'application'
export interface OperationalLog {
  id: number; created_at: string; kind: LogKind; request_id: string; level: string; method: string; route: string;
  status: number; completed: boolean; duration_ms: number; user_id: number; workspace_id: number; model_version_id: number; task_id: number; error_code: string; message: string;
}
export interface LogFilters { after_id?: number; request_id?: string; route?: string; user_id?: number; errors_only?: boolean; level?: string; from?: string; to?: string }
export const listOperationalLogs = (kind: LogKind, params: LogFilters & { limit: number; offset: number; live: boolean }) =>
  http.get<ListPage<OperationalLog>>(`/admin/${kind === 'request' ? 'request-logs' : 'server-logs'}${qs(params)}`)
