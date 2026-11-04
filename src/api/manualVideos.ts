import { http } from '@/api/client';
import { listGet } from '@/api/queries';
import type { AITask, Asset } from '@/types/domain';
import { manualVideoMime } from '@/utils/manualVideo';

export interface ManualVideoOrder {
  task_id: number;
  workspace_id: number;
  parent_task_id?: number;
  root_task_id: number;
  operator_admin_id?: number;
}
export interface ManualVideoDetail { order: ManualVideoOrder; task: AITask }
export interface ManualVideoFilter { status?: string; limit?: number; offset?: number }
export interface ManualVideoDelivery {
  status: 'manual_processing' | 'succeeded' | 'failed' | 'cancelled';
  asset_id?: number;
  message?: string;
}
export interface ManualMedia { asset_id: number; name: string; type: string; mime_type: string; download_url: string }
export const listManualVideos = listGet<AITask, ManualVideoFilter>('/admin/manual-video/tasks');
export const getManualVideo = (id: number) => http.get<ManualVideoDetail>(`/admin/manual-video/tasks/${id}`);
export const deliverManualVideo = (id: number, body: ManualVideoDelivery) => http.post(`/admin/manual-video/tasks/${id}/delivery`, body);
export const getManualMedia = (taskID: number, assetID: number) => http.get<ManualMedia>(`/admin/manual-video/tasks/${taskID}/assets/${assetID}/download`);

export async function uploadManualVideo(taskID: number, file: File, onProgress: (progress: number) => void, signal: AbortSignal): Promise<number> {
  const mime = manualVideoMime(file.name, file.type);
  if (!mime || file.size <= 0) throw new Error('请选择有效的 MP4、MOV 或 WebM 视频');
  const signed = await http.post<{ asset: Asset; upload: { url: string; form_fields: Record<string, string> } }>(
    `/admin/manual-video/tasks/${taskID}/uploads`, { name: file.name, mime_type: mime, size_bytes: file.size }, { signal },
  );
  const form = new FormData();
  Object.entries(signed.upload.form_fields).forEach(([key, value]) => form.append(key, value));
  form.append('file', file);
  // Do not attach business headers; cross-origin storage requests omit credentials.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open('POST', signed.upload.url);
    xhr.withCredentials = false;
    xhr.timeout = 30 * 60 * 1000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('视频上传失败，请重试；若持续失败，请检查存储跨域配置'));
    xhr.onerror = () => reject(new Error('上传连接中断，请检查网络后重试'));
    xhr.ontimeout = () => reject(new Error('视频上传超时，请重试'));
    xhr.onabort = () => reject(new Error('已停止上传'));
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { signal.removeEventListener('abort', abort); reject(new Error('已停止上传')); return; }
    xhr.send(form);
  });
  return signed.asset.id;
}
