// 登录流程依赖 vite.config.ts 的 /api、/auth、/deepauth 代理把跨域请求闭环到本地。
//   1. startOAuth()           → 业务后端拿 authStart(含 login_api_url / client_id / return_to)
//   2. loginWithPassword()    → 经 /deepauth 代理调 DeepAuth JSON 登录 API
//   3. getAuthNavigationUrl() → 把 redirect_to 改写成本地地址,后端 /auth/callback 种 Cookie 后回到本地根

const DEEPAUTH_BASE = normalizeBase(
  import.meta.env.VITE_DEEPAUTH_API_BASE_URL || "/deepauth",
);
const ZZH_REMOTE = normalizeBase(import.meta.env.VITE_ZZH_REMOTE_ORIGIN || "");
const DEEPAUTH_REMOTE = normalizeBase(
  import.meta.env.VITE_DEEPAUTH_REMOTE_ORIGIN || "",
);

export interface AuthStart {
  client_id: string;
  authorize_url: string;
  return_to: string;
  login_api_url: string;
  register_api_url?: string;
  forgot_password_api_url?: string;
  sms_send_api_url?: string;
}

export interface LoginResult {
  redirect_to?: string;
  [k: string]: unknown;
}

export class LoginError extends Error {
  status: number;
  code: string | number | null;
  constructor(
    message: string,
    opts: { status?: number; code?: string | number | null } = {},
  ) {
    super(message);
    this.name = "LoginError";
    this.status = opts.status ?? 0;
    this.code = opts.code ?? null;
  }
}

export async function startOAuth(): Promise<AuthStart> {
  const query = new URLSearchParams({
    redirect_to: `${window.location.origin}/`,
  });
  return requestJson<AuthStart>(`/api/v1/auth/oauth-start?${query}`);
}

export async function loginWithPassword(params: {
  authStart: AuthStart;
  mobile: string;
  password: string;
  captchaId?: string;
  captchaAnswer?: string;
}): Promise<LoginResult> {
  const { authStart, mobile, password, captchaId, captchaAnswer } = params;
  const url = rewriteUrl(
    authStart.login_api_url || "/api/v1/public/auth/login",
    { passthrough: true },
  );
  return requestJson<LoginResult>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      stripEmpty({
        client_id: authStart.client_id,
        return_to: authStart.return_to,
        mobile,
        password,
        method: "password",
        captcha_id: captchaId,
        captcha_answer: captchaAnswer,
      }),
    ),
  });
}

export function getAuthNavigationUrl(
  authStart: AuthStart,
  result: LoginResult,
): string {
  const redirectTo = result?.redirect_to;
  const target =
    redirectTo && redirectTo !== "/"
      ? redirectTo
      : authStart.authorize_url || authStart.return_to || "/";
  return rewriteUrl(target, { allowZzh: true, oauth2ToDeepauth: true });
}

// DeepAuth 用 20007/20008 表示图形验证码挑战。
export function isCaptchaChallenge(error: unknown): boolean {
  return (
    error instanceof LoginError &&
    (error.code === 20007 || error.code === 20008)
  );
}

// ---------- 内部工具 ----------

interface BusinessPayload {
  code?: number | string;
  code_string?: string;
  message?: string;
  data?: unknown;
}

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(url, { credentials: "include", ...options });
  } catch {
    throw new LoginError("网络请求失败,请检查接口服务或本地代理配置");
  }
  const text = await resp.text();
  let payload: BusinessPayload | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as BusinessPayload;
    } catch {
      payload = null;
    }
  }

  if (!resp.ok || isBusinessError(payload)) {
    throw new LoginError(payload?.message || `请求失败 (${resp.status})`, {
      status: resp.status,
      code: payload?.code ?? payload?.code_string ?? null,
    });
  }
  return (payload?.data ?? payload) as T;
}

function isBusinessError(payload: BusinessPayload | null): boolean {
  if (!payload) return false;
  if (typeof payload.code === "number" && payload.code !== 0) return true;
  return (
    typeof payload.code_string === "string" && payload.code_string !== "OK"
  );
}

// 把 DeepAuth/业务后端的绝对地址改写到本地代理;拒绝未知 origin 防开放重定向。
//   - oauth2ToDeepauth: /oauth2/* 相对路径走 DeepAuth 代理
//   - allowZzh: 业务后端 origin 保留 path+query 作为本地相对地址
//   - passthrough: 未知 origin 原样返回(用于登录 API),否则回落到 '/'
function rewriteUrl(
  url: string,
  opts: {
    allowZzh?: boolean;
    oauth2ToDeepauth?: boolean;
    passthrough?: boolean;
  } = {},
): string {
  if (!url) return opts.passthrough ? DEEPAUTH_BASE : "/";

  if (url.startsWith("/")) {
    if (opts.oauth2ToDeepauth && url.startsWith("/oauth2/")) {
      return `${DEEPAUTH_BASE}${url}`;
    }
    return `${DEEPAUTH_BASE}${url}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return opts.passthrough ? `${DEEPAUTH_BASE}/${url}` : "/";
  }

  const origin = normalizeBase(parsed.origin);
  const pathAndQuery = `${parsed.pathname}${parsed.search}`;

  if (origin === DEEPAUTH_REMOTE) return `${DEEPAUTH_BASE}${pathAndQuery}`;
  if (opts.allowZzh && origin === ZZH_REMOTE) return pathAndQuery;
  return opts.passthrough ? url : "/";
}

function normalizeBase(url: string): string {
  return String(url || "").replace(/\/+$/, "");
}

function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );
}
