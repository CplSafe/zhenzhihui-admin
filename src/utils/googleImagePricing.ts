import type { Pricing } from "@/types/domain";

// Keep in sync with backend internal/catalog/google_images.go (Standard rates).
const SPECS = {
  "gemini-2.5-flash-image": {
    rates: { input: 30, text_output: 250, image_output: 3000 },
    imageTokens: { "1K": 1290 },
  },
  "gemini-3.1-flash-image": {
    rates: { input: 50, text_output: 300, image_output: 6000 },
    imageTokens: { "512": 747, "1K": 1120, "2K": 1680, "4K": 2520 },
  },
  "gemini-3-pro-image": {
    rates: { input: 200, text_output: 1200, image_output: 12000 },
    imageTokens: { "1K": 1120, "2K": 1120, "4K": 2000 },
  },
} as const;

export function googleImageSpec(provider?: string, version?: string, capability?: string) {
  if (provider !== "google" || capability !== "image") return undefined;
  if (version === "gemini-2.5-flash-image" || version === "gemini-3.1-flash-image" || version === "gemini-3-pro-image") {
    return SPECS[version];
  }
  return undefined;
}

export type GoogleImageSpec = NonNullable<ReturnType<typeof googleImageSpec>>;

export function validGoogleImagePricing(spec: GoogleImageSpec, pricing: Pricing | null = {}) {
  if (!pricing) return false;
  return pricing.unit === "provider_cost" &&
    pricing.provider_cost_currency === "USD" &&
    Number.isSafeInteger(pricing.provider_cost_to_cny_ppm) &&
    (pricing.provider_cost_to_cny_ppm ?? 0) > 0 &&
    pricing.revenue_cents_per_thousand_credits === 2000 &&
    (pricing.input_credit_rate ?? 0) === 0 &&
    (pricing.output_credit_rate ?? 0) === 0 &&
    Object.entries(spec.rates).every(([key, rate]) =>
      pricing.provider_cost_cents_per_million_tokens_by_usage?.[key] === rate);
}

export function applyGoogleImagePricing(spec: GoogleImageSpec, pricing: Pricing = {}): Pricing {
  const fx = pricing.provider_cost_to_cny_ppm;
  return {
    ...pricing,
    unit: "provider_cost",
    input_credit_rate: 0,
    output_credit_rate: 0,
    provider_cost_currency: "USD",
    provider_cost_to_cny_ppm: Number.isSafeInteger(fx) && (fx ?? 0) > 0 ? fx : 7_300_000,
    revenue_cents_per_thousand_credits: 2000,
    provider_cost_cents_per_million_tokens_by_usage: { ...spec.rates },
  };
}

// Image output only, not a task quote. Match backend integer rounding.
export function googleImageOutputCosts(spec: GoogleImageSpec, pricing: Pricing) {
  if (!validGoogleImagePricing(spec, pricing)) return [];
  const fx = BigInt(pricing.provider_cost_to_cny_ppm!);
  return Object.entries(spec.imageTokens).map(([resolution, tokens]) => {
    const usdNano = BigInt(tokens) * BigInt(spec.rates.image_output) * 10n;
    const cnyNano = (usdNano * fx + 999_999n) / 1_000_000n;
    return {
      resolution,
      cny: Number(cnyNano) / 1_000_000_000,
      credits: Number((cnyNano + 19_999_999n) / 20_000_000n),
    };
  });
}
