import { useQuery } from "@tanstack/react-query";
import { fetchAdminSession } from "@/api/admin";
import type { ApiError } from "@/types/api";
import type { AdminSession } from "@/types/admin";

export const ADMIN_SESSION_KEY = ["admin", "session"] as const;

// 拉取并缓存当前后台会话。403(非 admin / 已禁用)不重试,交给守卫处理。
export function useAdminSession() {
  return useQuery<AdminSession, ApiError>({
    queryKey: ADMIN_SESSION_KEY,
    queryFn: fetchAdminSession,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) =>
      error.httpStatus !== 403 && failureCount < 1,
  });
}
