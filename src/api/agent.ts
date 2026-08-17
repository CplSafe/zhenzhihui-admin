import { http } from "@/api/client";
import type {
  AgentConfigView,
  AgentSession,
  AgentSessionDetail,
  AgentStats,
  ListPage,
} from "@/types/domain";

// ---------------------------------------------------------------- 配置

export const getAgentConfig = () =>
  http.get<AgentConfigView>("/admin/settings/agent");

export interface AgentConfigUpdateBody {
  // 不传 = 保留原 key;空串 = 清空;非空 = 覆盖。与 provider 凭证同一语义。
  search_api_key?: string;
  chat_operation_code?: string;
  video_operation_code?: string;
}

export const updateAgentConfig = (body: AgentConfigUpdateBody) =>
  http.put<AgentConfigView>("/admin/settings/agent", body);

// ---------------------------------------------------------------- 会话

export interface AgentSessionQuery {
  workspace_id?: number;
  user_id?: number;
  kind?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const listAgentSessions = (params: AgentSessionQuery) =>
  http.get<ListPage<AgentSession>>("/admin/agent/sessions", { params });

export const getAgentSession = (id: number) =>
  http.get<AgentSessionDetail>(`/admin/agent/sessions/${id}`);

export const getAgentStats = () => http.get<AgentStats>("/admin/agent/stats");
