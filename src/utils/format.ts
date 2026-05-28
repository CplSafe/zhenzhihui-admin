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
