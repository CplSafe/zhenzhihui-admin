import { http } from "@/api/client";
import { listGet } from "@/api/queries";
import type { Banner, BannerCategory } from "@/types/domain";

export interface BannerListParams {
  enabled?: string;
  limit?: number;
  offset?: number;
}

export interface BannerWriteBody {
  title?: string;
  image_url?: string;
  media_type?: "image" | "video";
  category_id?: number;
  link_url?: string;
  description?: string;
  position?: number;
  enabled?: boolean;
}

export const listBanners = listGet<Banner, BannerListParams>("/admin/banners");

export const getBanner = (id: number) =>
  http.get<Banner>(`/admin/banners/${id}`);

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
  media_type: "image" | "video";
}

// 上传图片或视频到公开桶,返回长期 URL + media_type(直接填入表单)。也可不上传、手填外部 URL。
export const uploadBannerImage = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return http.post<BannerUploadResult>("/admin/banners/upload", form);
};

// ---------- 轮播分类(投放位置)CRUD ----------

export interface BannerCategoryListParams {
  enabled?: string;
  limit?: number;
  offset?: number;
}

export interface BannerCategoryWriteBody {
  name?: string;
  slug?: string;
  position?: number;
  enabled?: boolean;
}

export const listBannerCategories = listGet<
  BannerCategory,
  BannerCategoryListParams
>("/admin/banner-categories");

export const getBannerCategory = (id: number) =>
  http.get<BannerCategory>(`/admin/banner-categories/${id}`);

export const createBannerCategory = (body: BannerCategoryWriteBody) =>
  http.post<BannerCategory>("/admin/banner-categories", body);

export const updateBannerCategory = (
  id: number,
  body: BannerCategoryWriteBody,
) => http.patch<BannerCategory>(`/admin/banner-categories/${id}`, body);

export const enableBannerCategory = (id: number) =>
  http.post<BannerCategory>(`/admin/banner-categories/${id}/enable`);

export const disableBannerCategory = (id: number) =>
  http.post<BannerCategory>(`/admin/banner-categories/${id}/disable`);

export const deleteBannerCategory = (id: number) =>
  http.delete<{ deleted: boolean }>(`/admin/banner-categories/${id}`);
