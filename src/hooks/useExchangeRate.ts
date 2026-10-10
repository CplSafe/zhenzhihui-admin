import { useQuery } from '@tanstack/react-query';
import { getExchangeRate } from '@/api/exchangeRate';
export const exchangeRateQueryKey = ['admin', 'exchange-rate'];
export function useExchangeRate() {
  return useQuery({ queryKey: exchangeRateQueryKey, queryFn: getExchangeRate, refetchInterval: 60_000 });
}
