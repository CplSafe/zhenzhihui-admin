import { http } from "@/api/client";
import { qs } from "@/api/queries";
import type { ListPage } from "@/types/domain";

export interface UserCanvasScope {
  userId: number;
  workspaceId: number;
}

export interface UserCanvas {
  id: number;
  title: string;
  status: string;
  updated_at: string;
}

export interface CanvasPreviewElement {
  element_id: string;
  kind: string;
  payload: Record<string, unknown>;
  updated_revision: number;
  deleted?: boolean;
  preview_media?: { asset_id?: number; poster_asset_id?: number; image_asset_ids?: number[] };
}

interface CanvasElementsPage {
  items: CanvasPreviewElement[];
  sync_revision: number;
  next_cursor?: string;
  has_more: boolean;
}

export type CanvasPreviewScope = UserCanvasScope & { canvasId: number };
const MAX_ELEMENT_PAGES = 200;

export function listUserCanvases(scope: UserCanvasScope, page: { limit: number; offset: number }, signal: AbortSignal) {
  return http.get<ListPage<UserCanvas>>(
    `/admin/users/${scope.userId}/canvases${qs({ workspace_id: scope.workspaceId, ...page })}`,
    { signal },
  );
}

export async function getUserCanvasElements(scope: CanvasPreviewScope, signal: AbortSignal) {
  const byId = new Map<string, CanvasPreviewElement>();

  async function readPages(afterRevision?: number) {
    let cursor: string | undefined;
    let initialRevision: number | undefined;
    const seenCursors = new Set<string>();

    for (let pageNumber = 0; pageNumber < MAX_ELEMENT_PAGES; pageNumber += 1) {
      const params = qs({ workspace_id: scope.workspaceId, limit: 200, cursor, after_revision: afterRevision });
      const page = await http.get<CanvasElementsPage>(
        `/admin/users/${scope.userId}/canvases/${scope.canvasId}/elements${params}`,
        { signal },
      );
      initialRevision ??= page.sync_revision;
      for (const element of page.items ?? []) {
        const previous = byId.get(element.element_id);
        if (!previous || previous.updated_revision <= element.updated_revision) {
          byId.set(element.element_id, element);
        }
      }
      if (!page.has_more) return { initialRevision, paged: seenCursors.size > 0 };
      if (!page.next_cursor || seenCursors.has(page.next_cursor)) throw new Error("画布分页游标无效");
      seenCursors.add(page.next_cursor);
      cursor = page.next_cursor;
    }
    throw new Error("画布内容过多，请进入用户端查看完整画布");
  }

  const initial = await readPages();
  // Reconcile changes made while the initial cursor pass was in progress.
  if (initial.paged && initial.initialRevision > 0) await readPages(initial.initialRevision);
  return [...byId.values()].filter((element) => !element.deleted);
}

export function getUserCanvasAsset(scope: CanvasPreviewScope, assetId: number, signal: AbortSignal) {
  return http.get<{ url: string; mime_type: string; expires_in: number }>(
    `/admin/users/${scope.userId}/canvases/${scope.canvasId}/assets/${assetId}/preview${qs({ workspace_id: scope.workspaceId })}`,
    { signal },
  );
}
