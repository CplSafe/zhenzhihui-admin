import { http, redirectToLogin } from "@/api/client";
import { listGet, qs } from "@/api/queries";
import axios from "axios";
export interface PromoOrder {
  id: number;
  task_id: number;
  workspace_id: number;
  user_id: number;
  company: string;
  contact: string;
  phone: string;
  scenario: string;
  duration_seconds: number;
  ratio: string;
  resolution: string;
  narration: string;
  brief: string;
  reference_url?: string;
  status: string;
  billing_status: string;
  material_status: string;
  low_resolution: boolean;
  material_ready_at: string;
  original_due_at: string;
  due_at: string;
  first_delivered_at?: string;
  delivered_at?: string;
  rework_deadline?: string;
  base_cost: number;
  service_cost: number;
  total_cost: number;
  assigned_note: string;
  delivery_note: string;
  candidate_delivery_note?: string;
  candidate_material_id?: number;
  delivered_material_id?: number;
  rework_status: string;
  rework_text?: string;
  rework_reply?: string;
  rework_requested_at?: string;
  notice_status: string;
  created_at: string;
}
export interface PromoMaterial {
  id: number;
  role: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  status: string;
  metadata_status: string;
}
export interface PromoEvent {
  id: number;
  kind: string;
  actor_user_id: number;
  actor_admin_id: number;
  content: string;
  created_at: string;
}
export interface PromoDetail {
  order: PromoOrder;
  materials: PromoMaterial[];
  events?: PromoEvent[];
}
export interface PromoFilter {
  status?: string;
  billing_status?: string;
  from?: string;
  to?: string;
  overdue?: boolean;
  limit?: number;
  offset?: number;
}
export interface PromoAction {
  action:
    | "start"
    | "note"
    | "reschedule"
    | "stage"
    | "reject_review"
    | "deliver"
    | "refund"
    | "accept_rework"
    | "reject_rework"
    | "quality"
    | "retry_notice";
  text?: string;
  date?: string;
  material_id?: number;
  low_resolution?: boolean;
}
export interface PromoNotice {
  id: number;
  order_id: number;
  kind: string;
  created_at: string;
}
export interface PromoTicket {
  material: PromoMaterial;
  url: string;
  form_fields: Record<string, string>;
  expires_at: string;
}
export const listPromo = listGet<PromoOrder, PromoFilter>(
  "/admin/promo/orders",
);
export const getPromo = (id: number) =>
  http.get<PromoDetail>(`/admin/promo/orders/${id}`);
export const actPromo = (id: number, body: PromoAction) =>
  http.post(`/admin/promo/orders/${id}/actions`, body);
export const getPromoDownload = (id: number) =>
  http.get<{ download_url: string }>(`/admin/promo/materials/${id}/download`);
export const getPromoStats = () =>
  http.get<Record<string, number>>("/admin/promo/stats");
export const getPromoNotices = () =>
  http.get<PromoNotice[]>("/admin/promo/notices");
export const readPromoNotice = (id: number) =>
  http.post(`/admin/promo/notices/${id}/read`);
export const createPromoUpload = (
  id: number,
  file: File,
  mime: string,
  signal: AbortSignal,
) =>
  http.post<PromoTicket>(
    "/admin/promo/uploads",
    {
      order_id: id,
      role: "deliverable",
      name: file.name,
      mime_type: mime,
      size_bytes: file.size,
    },
    { signal },
  );
export const retryPromoUpload = (id: number, signal: AbortSignal) =>
  http.post<PromoTicket>(`/admin/promo/materials/${id}/retry`, undefined, {
    signal,
  });
export const completePromoUpload = (id: number, signal: AbortSignal) =>
  http.post<PromoMaterial>(`/admin/promo/materials/${id}/complete`, undefined, {
    signal,
  });
export async function sendPromoFile(
  ticket: PromoTicket,
  file: File,
  onProgress: (p: number) => void,
  signal: AbortSignal,
) {
  const form = new FormData();
  Object.entries(ticket.form_fields).forEach(([k, v]) => form.append(k, v));
  form.append("file", file);
  // Independent storage request: never attach business cookies or authorization headers.
  await axios.post(ticket.url, form, {
    withCredentials: false,
    signal,
    timeout: 30 * 60 * 1000,
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
}
export async function exportPromo(filters: PromoFilter) {
  const url = `${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/admin/promo/orders/export${qs(filters)}`;
  let data: Blob;
  try {
    const response = await axios.get<Blob>(url, {
      withCredentials: true,
      responseType: "blob",
      timeout: 30000,
    });
    data = response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) redirectToLogin();
      const body = error.response?.data;
      if (body instanceof Blob) {
        let message = "导出失败，请缩小时间范围或稍后重试";
        try {
          const parsed = JSON.parse(await body.text());
          if (typeof parsed.message === "string") message = parsed.message;
        } catch {
          /* Non-JSON gateway response. */
        }
        throw new Error(message, { cause: error });
      }
    }
    throw error;
  }
  const blobURL = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = blobURL;
  a.download = "宣传片T+5订单.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobURL), 1000);
}

export interface PromoConfig {
  entry_name: string;
  enabled: boolean;
  tag_enabled: boolean;
  price_show: boolean;
  offline_fallback: boolean;
  sla_days: number;
  rework_window_days: number;
  rework_days: number;
  base_rate: number;
  multiplier_bps: number;
  max_file_bytes: number;
  max_total_bytes: number;
  max_files: number;
  wip_alert: number;
  service_tel: string;
  duration_options_seconds: number[];
  ratio_options: string[];
  resolution_options: string[];
  allowed_mime: string[];
  notify_to_admin_ids: number[];
}
export const getPromoConfig = () => http.get<PromoConfig>("/admin/promo/config");
export const savePromoConfig = (config: PromoConfig) =>
  http.put<PromoConfig>("/admin/promo/config", config);
