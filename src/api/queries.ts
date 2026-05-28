import { http } from "@/api/client";
import type {
  AITask,
  Asset,
  AdminAuditLog,
  CreditLedger,
  ListPage,
  Overview,
  PaymentOrder,
  Subscription,
  User,
  Wallet,
  Workspace,
} from "@/types/domain";

// 用 object 而非 Record<string, unknown>,这样 interface 入参也满足约束
// (TS interface 无隐式索引签名)。
export type QueryParams = object;

// 把筛选对象转成 query string,丢弃 undefined / null / 空字符串。
export function qs(params: QueryParams): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function listGet<T, P extends QueryParams>(path: string) {
  return (params: P = {} as P) => http.get<ListPage<T>>(`${path}${qs(params)}`);
}

interface Paginated {
  limit?: number;
  offset?: number;
}

export interface UserListParams extends Paginated {
  keyword?: string;
  created_from?: string;
  created_to?: string;
}
export const listUsers = listGet<User, UserListParams>("/admin/users");
export const getUser = (id: number) => http.get<unknown>(`/admin/users/${id}`);

export interface WorkspaceListParams extends Paginated {
  type?: string;
  status?: string;
  keyword?: string;
}
export const listWorkspaces = listGet<Workspace, WorkspaceListParams>(
  "/admin/workspaces",
);
export const getWorkspace = (id: number) =>
  http.get<unknown>(`/admin/workspaces/${id}`);
export const listWorkspaceMembers = (id: number) =>
  http.get<unknown[]>(`/admin/workspaces/${id}/members`);

export interface AITaskListParams extends Paginated {
  workspace_id?: number;
  user_id?: number;
  provider?: string;
  model_version_id?: number;
  operation_code?: string;
  status?: string;
  provider_task_id?: string;
  created_from?: string;
  created_to?: string;
}
export const listAITasks = listGet<AITask, AITaskListParams>("/admin/ai/tasks");
export const getAITask = (id: number) =>
  http.get<AITask>(`/admin/ai/tasks/${id}`);

export interface AssetListParams extends Paginated {
  workspace_id?: number;
  user_id?: number;
  type?: string;
  status?: string;
}
export const listAssets = listGet<Asset, AssetListParams>("/admin/assets");
export const getAsset = (id: number) => http.get<Asset>(`/admin/assets/${id}`);

export interface PaymentOrderListParams extends Paginated {
  workspace_id?: number;
  status?: string;
  type?: string;
}
export const listPaymentOrders = listGet<PaymentOrder, PaymentOrderListParams>(
  "/admin/billing/payment-orders",
);

export interface CreditLedgerListParams extends Paginated {
  workspace_id?: number;
  kind?: string;
}
export const listCreditLedgers = listGet<CreditLedger, CreditLedgerListParams>(
  "/admin/billing/credit-ledgers",
);

export interface WalletListParams extends Paginated {
  keyword?: string;
}
export const listWallets = listGet<Wallet, WalletListParams>(
  "/admin/billing/wallets",
);

export interface SubscriptionListParams extends Paginated {
  workspace_id?: number;
  status?: string;
}
export const listSubscriptions = listGet<Subscription, SubscriptionListParams>(
  "/admin/subscriptions",
);

export interface AuditLogListParams extends Paginated {
  actor_admin_user_id?: number;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  from?: string;
  to?: string;
}
export const listAuditLogs = listGet<AdminAuditLog, AuditLogListParams>(
  "/admin/audit-logs",
);

export interface OverviewParams {
  from?: string;
  to?: string;
}
export const getOverview = (p: OverviewParams) =>
  http.get<Overview>(`/admin/overview${qs(p)}`);
