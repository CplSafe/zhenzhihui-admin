import { http } from "@/api/client";
import { listGet } from "@/api/queries";
import type { Banner } from "@/types/domain";

export interface BannerListParams {
  enabled?: string;
  limit?: number;
  offset?: number;
}

export interface BannerWriteBody {
  title?: string;
  image_url?: string;
  link_url?: string;
  description?: string;
  position?: number;
  enabled?: boolean;
}

export const listBanners = listGet<Banner, BannerListParams>("/admin/banners");

export const getBanner = (id: number) => http.get<Banner>(`/admin/banners/${id}`);

export const createBanner = (body: BannerWriteBody) =>
  http.post<Banner>("/admin/banners", body);

export const updateBanner = (id: number, body: BannerWriteBody) =>
  http.patch<Banner>(`/admin/banners/${id}`, body);

export const enableBanner = (id: number) =>
  http.post<Banner>(`/admin/banners/${id}/enable`);

export const disableBanner = (id: number) =>
  http.post<Banner>(`/admin/banners/${id}/disable`);

export const deleteBanner = (id: number) =>
  http.delete<{ deleted: boolean }>(`/admin/banners/${id}`);

export interface BannerUploadResult {
  image_url: string;
}

// 上传图片到公开桶,返回长期 URL(直接填入 image_url)。也可不上传、手填外部 URL。
export const uploadBannerImage = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return http.post<BannerUploadResult>("/admin/banners/upload", form);
};
