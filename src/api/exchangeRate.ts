import { http } from './client';

export interface ExchangeRate {
  pair: string;
  rate_ppm: number;
  rate_date: string;
  source: string;
  last_attempt_at: string;
  last_success_at: string | null;
  last_error: string;
  status: 'pending' | 'ready' | 'degraded' | 'expired' | 'unavailable';
  usable: boolean;
  refresh_interval_seconds: number;
}
export const getExchangeRate = () => http.get<ExchangeRate>('/admin/models/exchange-rate');
export const syncExchangeRate = () => http.post<ExchangeRate>('/admin/models/exchange-rate/sync');
