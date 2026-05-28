// 后端统一响应信封,对应 internal/pkg/response/response.go。成功时 code === 0 且 code_string === 'OK'。
export interface ApiEnvelope<T = unknown> {
  code: number;
  code_string?: string;
  message: string;
  data?: T;
}

// 后端常见错误字符串码(internal/httpapi 与 response 包)。NOT_ADMIN/ADMIN_* 为 admin 专属。
export const ApiCode = {
  OK: "OK",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_ADMIN: "NOT_ADMIN",
  ADMIN_DISABLED: "ADMIN_DISABLED",
  ADMIN_PERMISSION_DENIED: "ADMIN_PERMISSION_DENIED",
} as const;

export type ApiCodeString = (typeof ApiCode)[keyof typeof ApiCode];

export interface ApiErrorParams {
  code: number;
  message: string;
  codeString?: string;
  httpStatus?: number;
  data?: unknown;
}

// 业务错误:request 层把非 0 信封抛成这个,组件可按 codeString 精准处理。
export class ApiError extends Error {
  readonly code: number;
  readonly codeString?: string;
  readonly httpStatus?: number;
  readonly data?: unknown;

  constructor(params: ApiErrorParams) {
    super(params.message);
    this.name = "ApiError";
    this.code = params.code;
    this.codeString = params.codeString;
    this.httpStatus = params.httpStatus;
    this.data = params.data;
  }
}
