import { http } from "@/api/client";

export interface ProductionNotifyConfig {
  enabled: boolean;
  version: number;
  enabled_since: string;
  admin_origin: string;
  webhook_configured: boolean;
  signing_configured: boolean;
}
export interface ProductionNotifyInput {
  enabled: boolean;
  version: number;
  admin_origin: string;
  webhook_url?: string;
  signing_secret?: string;
  clear_signing_secret?: boolean;
}
const path = "/admin/settings/production-notifications";
export const getProductionNotifyConfig = () =>
  http.get<ProductionNotifyConfig>(path);
export const saveProductionNotifyConfig = (input: ProductionNotifyInput) =>
  http.put<ProductionNotifyConfig>(path, input);
export const testProductionNotify = () => http.post(`${path}/test`);
