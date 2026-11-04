import dayjs from "dayjs";

const DASH = "-";
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

const hasValue = <T>(v: T | null | undefined): v is T =>
  v !== null && v !== undefined;

const fmtDayjs = (t: string | null | undefined, pattern: string): string => {
  const d = t ? dayjs(t) : null;
  return d?.isValid() ? d.format(pattern) : DASH;
};

// 后端金额一律以分(cents)存储。
export const centsToYuan = (cents?: number | null): string =>
  hasValue(cents) ? (cents / 100).toFixed(2) : DASH;

export const yuan = (cents?: number | null): string =>
  hasValue(cents) ? `¥${(cents / 100).toFixed(2)}` : DASH;

export const humanBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return "0 B";
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exp;
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${BYTE_UNITS[exp]}`;
};

export const fmtTime = (t?: string | null): string =>
  fmtDayjs(t, "YYYY-MM-DD HH:mm:ss");

export const fmtDate = (t?: string | null): string => fmtDayjs(t, "YYYY-MM-DD");

// 千分位整数(用于积分等计数)。
export const fmtNumber = (n?: number | null): string =>
  hasValue(n) ? n.toLocaleString("en-US") : DASH;

// 时长不使用日期格式，避免超过 24 小时后回绕；保留百分之一秒。
export const fmtDuration = (seconds?: number | null): string => {
  if (!hasValue(seconds) || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const centiseconds = Math.round(seconds * 100);
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6_000);
  const remainingSeconds = (centiseconds % 6_000) / 100;
  return `${hours ? `${hours} 小时 ` : ""}${hours || minutes ? `${minutes} 分 ` : ""}${remainingSeconds} 秒`;
};

// 积分:后端精度 0.001,千分位 + 最多 3 位小数(去尾零),供对账。
const CREDITS_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

export const fmtCredits = (n?: number | null): string =>
  hasValue(n) ? CREDITS_FMT.format(n) : DASH;

// 带符号积分(流水变动):+1,234.5 / -0.044。
export const fmtSignedCredits = (n?: number | null): string =>
  hasValue(n) ? `${n > 0 ? "+" : ""}${CREDITS_FMT.format(n)}` : DASH;
