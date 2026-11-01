import { http } from './client';
export interface TemplateCategory { id: number; name: string; position: number }
export interface LibraryTemplate { id: number; title: string; description: string; category_id: number; media_url: string; cover_url: string; media_type: 'video' | 'image'; enabled: boolean }
export type TemplateBody = Omit<LibraryTemplate, 'id'>;
export interface TemplatePage { items: LibraryTemplate[]; next_cursor: string; has_more: boolean }
export interface OSSConfig { endpoint: string; bucket: string; public_base_url: string; credentials_set: boolean }
export type OSSBody = Omit<OSSConfig, 'credentials_set'> & { access_key_id?: string; access_key_secret?: string };
export const listTemplates = (category?: number, enabled?: string, cursor?: string) => http.get<TemplatePage>('/admin/templates', { params: { category_id: category, enabled, cursor, limit: 20 } });
export const saveTemplate = (body: TemplateBody, id?: number) => id ? http.put<LibraryTemplate>(`/admin/templates/${id}`, body) : http.post<LibraryTemplate>('/admin/templates', body);
export const deleteTemplate = (id: number) => http.delete(`/admin/templates/${id}`);
export const listTemplateCategories = () => http.get<TemplateCategory[]>('/admin/template-categories');
export const saveTemplateCategory = (body: { name: string; position: number }, id?: number) => id ? http.put(`/admin/template-categories/${id}`, body) : http.post('/admin/template-categories', body);
export const deleteTemplateCategory = (id: number) => http.delete(`/admin/template-categories/${id}`);
export const getTemplateOSS = () => http.get<OSSConfig>('/admin/templates/oss');
export const saveTemplateOSS = (body: OSSBody) => http.put<OSSConfig>('/admin/templates/oss', body);
export async function uploadTemplateFile(file: File): Promise<string> {
  const signed = await http.post<{ host: string; url: string; fields: Record<string, string> }>('/admin/templates/upload-policy', { content_type: file.type, size: file.size });
  const form = new FormData();
  Object.entries(signed.fields).forEach(([key, value]) => form.append(key, value));
  form.append('file', file);
  // Direct OSS request deliberately omits business cookies and authorization headers.
  const response = await fetch(signed.host, { method: 'POST', body: form, credentials: 'omit' });
  if (!response.ok) throw new Error('OSS 上传失败，请检查桶权限及跨域配置');
  return signed.url;
}
