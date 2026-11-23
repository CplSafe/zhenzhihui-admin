import type { CanvasPreviewElement } from "../api/userCanvases.ts";

const NODE_TYPES = new Map([
  ["text", { label: "文本", width: 300, height: 200 }],
  ["image", { label: "图片", width: 260, height: 240 }],
  ["video", { label: "视频", width: 360, height: 220 }],
  ["audio", { label: "音频", width: 300, height: 130 }],
  ["timeline", { label: "视频剪辑", width: 360, height: 210 }],
]);

interface Point { x: number; y: number }
export interface CanvasPreviewNode extends Point {
  id: string;
  parentId?: string;
  kind: string;
  label: string;
  title: string;
  text: string;
  prompt: string;
  width: number;
  height: number;
  assets: { id: number; label: string }[];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function coordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(-1_000_000, Math.min(1_000_000, value)) : 0;
}

function dimension(value: unknown) {
  const candidate = typeof value === "string" && /^\d+(?:\.\d+)?px$/.test(value) ? Number.parseFloat(value) : value;
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0 ? Math.min(10_000, candidate) : undefined;
}

function decodeNode(element: CanvasPreviewElement): CanvasPreviewNode {
  const payload = object(element.payload);
  const data = object(payload.data);
  const position = object(payload.position);
  const style = object(payload.style);
  const kind = str(data.kind) || str(payload.type) || "text";
  const type = NODE_TYPES.get(kind) ?? { label: "节点", width: 260, height: 180 };
  const assets = new Map<number, string>();
  const addAsset = (value: unknown, label: string) => {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0 && !assets.has(value)) assets.set(value, label);
  };
  const media = element.preview_media;
  addAsset(media?.asset_id, "当前素材");
  media?.image_asset_ids?.forEach((id, index) => addAsset(id, `图片结果 ${index + 1}`));
  addAsset(media?.poster_asset_id, "封面");
  const text = str(data.text ?? (kind === "text" ? data.body : undefined));
  const prompt = str(data.prompt ?? (kind !== "text" ? data.body : undefined));
  return {
    id: element.element_id,
    parentId: str(payload.parentId) || str(payload.parentNode) || undefined,
    kind,
    label: type.label,
    title: str(data.title).trim() || (text || prompt).trim().replace(/\s+/g, " ").slice(0, 40) || type.label,
    text,
    prompt,
    x: coordinate(position.x),
    y: coordinate(position.y),
    width: dimension(style.width) ?? dimension(payload.width) ?? type.width,
    height: dimension(style.height) ?? dimension(payload.height) ?? type.height,
    assets: Array.from(assets, ([id, label]) => ({ id, label })),
  };
}

export function canvasPreviewGraph(elements: CanvasPreviewElement[]) {
  const nodes = elements.filter((e) => e.kind === "node" && !e.deleted).map(decodeNode);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const positions = new Map<string, Point>();
  for (const node of nodes) {
    const pending: CanvasPreviewNode[] = [];
    const seen = new Set<string>();
    let current: CanvasPreviewNode | undefined = node;
    while (current && !positions.has(current.id) && !seen.has(current.id)) {
      pending.push(current);
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    let origin = (current && positions.get(current.id)) || { x: 0, y: 0 };
    while (pending.length > 0) {
      const child = pending.pop()!;
      origin = { x: origin.x + child.x, y: origin.y + child.y };
      positions.set(child.id, origin);
    }
  }
  const positioned = nodes.map((node) => ({ ...node, ...positions.get(node.id) }));
  const placed = new Map(positioned.map((node) => [node.id, node]));
  const edges = elements.flatMap((element) => {
    if (element.kind !== "edge" || element.deleted) return [];
    const payload = object(element.payload);
    const source = placed.get(str(payload.source));
    const target = placed.get(str(payload.target));
    return source && target ? [{ id: element.element_id, source, target }] : [];
  });

  return { nodes: positioned, edges };
}
