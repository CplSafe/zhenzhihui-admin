// Read-only rate equivalent, not a second configurable billing price. One credit
// is CNY 0.02; the backend rounds only the complete measured bill.
export function mediaCreditsPerThousandTokens(centsPerMillion: number, fxPPM: number | undefined): number | null {
  if (!Number.isFinite(centsPerMillion) || centsPerMillion < 0 ||
      fxPPM === undefined || !Number.isFinite(fxPPM) || fxPPM <= 0) return null;
  return centsPerMillion * fxPPM / 2_000_000_000;
}
