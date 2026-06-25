import { http } from "@/api/client";
import { listGet } from "@/api/queries";
import type { Feedback, FeedbackType } from "@/types/domain";

// ---------- 反馈类型 CRUD ----------

export interface FeedbackTypeListParams {
  enabled?: string;
  limit?: number;
  offset?: number;
}

export interface FeedbackTypeWriteBody {
  name?: string;
  position?: number;
  enabled?: boolean;
}

export const listFeedbackTypes = listGet<FeedbackType, FeedbackTypeListParams>(
  "/admin/feedback-types",
);

export const getFeedbackType = (id: number) =>
  http.get<FeedbackType>(`/admin/feedback-types/${id}`);

export const createFeedbackType = (body: FeedbackTypeWriteBody) =>
  http.post<FeedbackType>("/admin/feedback-types", body);

export const updateFeedbackType = (id: number, body: FeedbackTypeWriteBody) =>
  http.patch<FeedbackType>(`/admin/feedback-types/${id}`, body);

export const enableFeedbackType = (id: number) =>
  http.post<FeedbackType>(`/admin/feedback-types/${id}/enable`);

export const disableFeedbackType = (id: number) =>
  http.post<FeedbackType>(`/admin/feedback-types/${id}/disable`);

export const deleteFeedbackType = (id: number) =>
  http.delete<{ deleted: boolean }>(`/admin/feedback-types/${id}`);

// ---------- 反馈管理 ----------

export interface FeedbackListParams {
  status?: string;
  feedback_type?: number;
  limit?: number;
  offset?: number;
}

export const listFeedbacks = listGet<Feedback, FeedbackListParams>(
  "/admin/feedbacks",
);

export const getFeedback = (id: number) =>
  http.get<Feedback>(`/admin/feedbacks/${id}`);

export const setFeedbackStatus = (
  id: number,
  body: { status: "pending" | "resolved"; admin_note?: string },
) => http.post<Feedback>(`/admin/feedbacks/${id}/status`, body);
