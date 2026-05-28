import axios, { type AxiosRequestConfig } from "axios";
import { ApiError, type ApiEnvelope } from "@/types/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

// 跳转到内部登录页(极简手机号+密码),并发 401 只触发一次。
// 登录页在本地经 /deepauth 代理完成 OAuth 闭环;已在登录页时不重复跳。
let redirecting = false;
export function redirectToLogin(): void {
  if (redirecting) return;
  if (window.location.pathname === "/login") return;
  redirecting = true;
  const current = window.location.pathname + window.location.search;
  window.location.assign(`/login?redirect_to=${encodeURIComponent(current)}`);
}

const instance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  // access_token 走 HttpOnly cookie,必须带上凭据。
  withCredentials: true,
});

instance.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401) redirectToLogin();
    return Promise.reject(error);
  },
);

function toApiError(
  body: ApiEnvelope | undefined,
  httpStatus?: number,
  fallbackMessage?: string,
): ApiError {
  return new ApiError({
    code: body?.code ?? -1,
    message: body?.message || fallbackMessage || "网络请求失败",
    codeString: body?.code_string,
    httpStatus,
    data: body?.data,
  });
}

// request 解开统一信封:成功返回 data,失败抛 ApiError。
export async function request<T = unknown>(
  config: AxiosRequestConfig,
): Promise<T> {
  try {
    const resp = await instance.request<ApiEnvelope<T>>(config);
    if (resp.data.code === 0) return resp.data.data as T;
    throw toApiError(resp.data, resp.status);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (axios.isAxiosError(err)) {
      throw toApiError(
        err.response?.data as ApiEnvelope | undefined,
        err.response?.status,
        err.message,
      );
    }
    throw new ApiError({ code: -1, message: "未知错误" });
  }
}

const withBody =
  (method: "POST" | "PATCH" | "PUT") =>
  <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method, url, data });

const withoutBody =
  (method: "GET" | "DELETE") =>
  <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method, url });

export const http = {
  get: withoutBody("GET"),
  delete: withoutBody("DELETE"),
  post: withBody("POST"),
  patch: withBody("PATCH"),
  put: withBody("PUT"),
};
