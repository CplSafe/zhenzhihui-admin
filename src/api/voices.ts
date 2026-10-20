import { http } from "@/api/client";
import { listGet, qs } from "@/api/queries";

export interface PublicVoiceBody {
  provider?: string;
  name: string;
  description: string;
  language: string;
  gender: string;
  tags: string[];
  speaker_id: string;
  preview_url: string;
  enabled: boolean;
}

export interface PublicVoice extends Omit<PublicVoiceBody, "enabled"> {
  id: number;
  status: "ready" | "disabled";
}

export interface VoiceSlot {
  id: number;
  workspace_id: number;
  speaker_id: string;
  voice_id?: number;
}

export interface PublicVoiceFilters {
  provider?: string;
  q?: string;
  status?: string;
}
export const listPublicVoices = listGet<
  PublicVoice,
  PublicVoiceFilters & { limit?: number; offset?: number }
>("/admin/voices/public");
export const savePublicVoice = (body: PublicVoiceBody) =>
  http.put("/admin/voices/public", body);
export interface VoiceCatalogSyncResult {
  total: number;
  added: number;
  previews_filled: number;
  missing_preview: number;
}
export const syncPublicVoices = (provider: string) =>
  http.post<VoiceCatalogSyncResult>(`/admin/voices/public/sync${qs({ provider })}`, undefined, {
    timeout: 120_000,
  });
export const listVoiceSlots = (workspaceID: number) =>
  http.get<VoiceSlot[] | null>(
    `/admin/voices/slots${qs({ workspace_id: workspaceID })}`,
  );
export const addVoiceSlot = (body: {
  workspace_id: number;
  speaker_id: string;
  prepaid_confirmed: boolean;
}) => http.post<VoiceSlot>("/admin/voices/slots", body);
export const rebindVoiceSlot = (id: number) =>
  http.post<VoiceSlot>(`/admin/voices/slots/${id}/rebind`);
