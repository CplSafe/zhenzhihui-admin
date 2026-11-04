export const manualVideoStates = [
  { value: 'awaiting_manual', label: '待制作', color: 'gold' },
  { value: 'manual_processing', label: '制作中', color: 'processing' },
  { value: 'succeeded', label: '已交付', color: 'success' },
  { value: 'failed', label: '制作失败', color: 'error' },
  { value: 'cancelled', label: '已取消', color: 'default' },
];
export const isManualVideoActive = (status: string) => status === 'awaiting_manual' || status === 'manual_processing';
export function manualVideoMime(name: string, mime: string): string | undefined {
  if (['video/mp4', 'video/quicktime', 'video/webm'].includes(mime)) return mime;
  if (mime && mime !== 'application/octet-stream') return undefined;
  const extension = name.split('.').at(-1)?.toLowerCase();
  return extension === 'mp4' ? 'video/mp4' : extension === 'mov' ? 'video/quicktime' : extension === 'webm' ? 'video/webm' : undefined;
}
export function manualRequest(value: unknown): { duration?: number; resolution?: string; ratio?: string; input_assets: { asset_id: number; role?: string }[] } {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const refs = Array.isArray(raw.input_assets) ? raw.input_assets : [];
  return {
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    resolution: typeof raw.resolution === 'string' ? raw.resolution : undefined,
    ratio: typeof raw.ratio === 'string' ? raw.ratio : undefined,
    input_assets: refs.filter((ref): ref is { asset_id: number; role?: string } => !!ref && typeof ref === 'object' && Number.isSafeInteger(ref.asset_id) && ref.asset_id > 0).map(ref => ({ asset_id: ref.asset_id, role: typeof ref.role === 'string' ? ref.role : undefined })),
  };
}
export function manualResult(value: unknown): { assetID?: number; url?: string } {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  return { assetID: typeof raw.manual_asset_id === 'number' && raw.manual_asset_id > 0 ? raw.manual_asset_id : undefined, url: typeof raw.video_url === 'string' && raw.video_url.startsWith('https://') ? raw.video_url : undefined };
}
