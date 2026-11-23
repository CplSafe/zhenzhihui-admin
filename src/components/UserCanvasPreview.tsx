import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Empty, Modal, Select, Skeleton, Space, Table, Tag, Typography } from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { getUserCanvasAsset, getUserCanvasElements, listUserCanvases } from "@/api/userCanvases";
import type { CanvasPreviewScope, UserCanvas, UserCanvasScope } from "@/api/userCanvases";
import { canvasPreviewGraph, type CanvasPreviewNode } from "@/utils/canvasPreview";
import { fmtTime } from "@/utils/format";
import styles from "./UserCanvasPreview.module.css";

const PAGE_SIZE = 20;

export function UserCanvasPreview({ userId, workspace, onClose }: {
  userId: number;
  workspace: { id: number; name: string };
  onClose: () => void;
}) {
  const [canvas, setCanvas] = useState<UserCanvas | null>(null);
  const [page, setPage] = useState(1);
  const scope = { userId, workspaceId: workspace.id };

  return (
    <Modal
      open
      title={<span className={styles.wrapTitle}>{`画布预览 · ${workspace.name || `空间 #${workspace.id}`}`}</span>}
      width={1200}
      footer={null}
      onCancel={onClose}
    >
      {canvas ? (
        <>
          <Space wrap className={styles.canvasHeader}>
            <Button icon={<ArrowLeftOutlined aria-hidden />} onClick={() => setCanvas(null)}>返回画布列表</Button>
            <Typography.Text strong className={styles.wrapTitle}>{canvas.title || `画布 #${canvas.id}`}</Typography.Text>
            <Tag>只读</Tag>
          </Space>
          <CanvasContent scope={{ ...scope, canvasId: canvas.id }} />
        </>
      ) : <CanvasList scope={scope} page={page} onPageChange={setPage} onSelect={setCanvas} />}
    </Modal>
  );
}

function CanvasList({ scope, page, onPageChange, onSelect }: {
  scope: UserCanvasScope;
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (canvas: UserCanvas) => void;
}) {
  const query = useQuery({
    queryKey: ["admin", "user-canvases", scope, page],
    queryFn: ({ signal }) => listUserCanvases(scope, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, signal),
    gcTime: 0,
    retry: false,
  });

  if (query.error) return <PreviewError title="画布列表加载失败" error={query.error} retry={() => void query.refetch()} />;
  return (
    <Table<UserCanvas>
      aria-label="用户画布"
      rowKey="id"
      size="small"
      columns={[
        { title: "画布", dataIndex: "title", render: (_, canvas) => (
          <Button type="link" className={styles.canvasTitle} onClick={() => onSelect(canvas)}>
            {canvas.title || `未命名画布 #${canvas.id}`}
          </Button>
        ) },
        { title: "状态", dataIndex: "status", width: 86, render: (status) => status === "archived" ? "已归档" : "正常" },
        { title: "最近更新", dataIndex: "updated_at", width: 170, render: fmtTime },
      ]}
      dataSource={query.data?.items ?? []}
      loading={query.isPending}
      locale={{ emptyText: "这个用户在当前空间没有可查看的画布" }}
      pagination={{ current: page, pageSize: PAGE_SIZE, total: query.data?.total, onChange: onPageChange, showSizeChanger: false }}
      scroll={{ x: 440 }}
    />
  );
}

function CanvasContent({ scope }: { scope: CanvasPreviewScope }) {
  const query = useQuery({
    queryKey: ["admin", "user-canvas-elements", scope],
    queryFn: ({ signal }) => getUserCanvasElements(scope, signal),
    gcTime: 0,
    retry: false,
  });
  const graph = useMemo(() => canvasPreviewGraph(query.data ?? []), [query.data]);

  if (query.isPending) return <div role="status" aria-label="正在加载画布"><Skeleton active /></div>;
  if (query.error) return <PreviewError title="画布内容加载失败" error={query.error} retry={() => void query.refetch()} />;
  if (graph.nodes.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这张画布还没有节点" />;
  return <CanvasBoard scope={scope} graph={graph} />;
}

function CanvasBoard({ scope, graph }: { scope: CanvasPreviewScope; graph: ReturnType<typeof canvasPreviewGraph> }) {
  const { nodes, edges } = graph;
  const [selectedId, setSelectedId] = useState<string>();
  const [originalSize, setOriginalSize] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 640, height: 420 });
  const viewport = useRef<HTMLDivElement>(null);
  const selected = nodes.find((node) => node.id === selectedId);
  const bounds = useMemo(() => nodes.reduce((rect, node) => ({
    left: Math.min(rect.left, node.x),
    top: Math.min(rect.top, node.y),
    right: Math.max(rect.right, node.x + node.width),
    bottom: Math.max(rect.bottom, node.y + node.height),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }), [nodes]);

  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(view);
    return () => observer.disconnect();
  }, []);

  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const fit = Math.min(1, Math.max(1, viewportSize.width - 32) / width, Math.max(1, viewportSize.height - 32) / height);
  const scale = originalSize ? 1 : fit;

  return (
    <div className={styles.previewGrid}>
      <div className={styles.graphColumn}>
        <div className={styles.toolbar}>
          <Select
            value={selectedId}
            onChange={setSelectedId}
            aria-label="查找画布节点"
            placeholder="查找画布节点"
            showSearch={{ optionFilterProp: "label" }}
            className={styles.nodeSelect}
            options={nodes.map((node) => ({ value: node.id, label: `${node.label} · ${node.title}` }))}
          />
          <Space size={4} wrap>
            <Button size="small" aria-pressed={!originalSize} onClick={() => setOriginalSize(false)}>适合窗口</Button>
            <Button size="small" aria-pressed={originalSize} onClick={() => setOriginalSize(true)}>实际大小</Button>
          </Space>
        </div>
        <div ref={viewport} className={styles.viewport} role="region" tabIndex={0} aria-label="画布布局">
          <div className={styles.stageArea}>
            <div className={styles.stage} style={{ width: width * scale, height: height * scale }}>
              <svg aria-hidden="true" className={styles.edges} viewBox={`${bounds.left} ${bounds.top} ${width} ${height}`}>
                {edges.map(({ id, source, target }) => (
                  <line key={id}
                    x1={source.x + source.width / 2} y1={source.y + source.height / 2}
                    x2={target.x + target.width / 2} y2={target.y + target.height / 2}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              {nodes.map((node) => (
                <button
                  type="button"
                  key={node.id}
                  aria-label={`查看${node.label} ${node.title}`}
                  aria-pressed={node.id === selectedId}
                  title={`${node.label} · ${node.title}`}
                  className={styles.node}
                  data-kind={node.kind}
                  style={{
                    left: (node.x - bounds.left) * scale,
                    top: (node.y - bounds.top) * scale,
                    width: node.width * scale,
                    height: node.height * scale,
                  }}
                  onClick={() => setSelectedId(node.id)}
                >
                  <span className={styles.kind}>{node.label}</span>
                  <strong className={styles.nodeTitle}>{node.title}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <aside className={styles.inspector} aria-label="节点预览">
        {selected ? <NodeContent key={selected.id} scope={scope} node={selected} /> : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择画布节点查看内容" />
        )}
      </aside>
    </div>
  );
}

function NodeContent({ scope, node }: { scope: CanvasPreviewScope; node: CanvasPreviewNode }) {
  const [assetId, setAssetId] = useState(node.assets[0]?.id);
  const asset = node.assets.find((candidate) => candidate.id === assetId);

  return (
    <div className={styles.nodeContent}>
      <Typography.Title level={5} className={styles.inspectorTitle}>{node.title}</Typography.Title>
      {node.assets.length > 1 && (
        <Select
          aria-label="选择节点素材"
          value={assetId}
          onChange={setAssetId}
          options={node.assets.map(({ id, label }) => ({ value: id, label }))}
        />
      )}
      {asset && <CanvasMedia key={asset.id} scope={scope} assetId={asset.id} title={node.title} />}
      {node.text && <div className={styles.userText}>{node.text}</div>}
      {node.prompt && node.prompt !== node.text && (
        <>
          <Typography.Text type="secondary">提示词</Typography.Text>
          <div className={styles.userText}>{node.prompt}</div>
        </>
      )}
      {!asset && !node.text && !node.prompt && <Typography.Text type="secondary">暂无可预览内容</Typography.Text>}
    </div>
  );
}

function CanvasMedia({ scope, assetId, title }: { scope: CanvasPreviewScope; assetId: number; title: string }) {
  const query = useQuery({
    queryKey: ["admin", "user-canvas-asset", scope, assetId],
    queryFn: ({ signal }) => getUserCanvasAsset(scope, assetId, signal),
    gcTime: 0,
    retry: false,
    refetchOnReconnect: false,
  });
  const [failedAt, setFailedAt] = useState<number>();

  if (query.isPending) return <div role="status" aria-label="正在加载素材"><Skeleton active paragraph={false} /></div>;
  const src = safeMediaUrl(query.data?.url);
  if (query.error || !src || failedAt === query.dataUpdatedAt) {
    return <PreviewError title="素材预览不可用" error={query.error} retry={() => void query.refetch()} />;
  }

  const kind = query.data?.mime_type?.toLowerCase().split("/")[0];
  const onError = () => setFailedAt(query.dataUpdatedAt);
  if (kind === "image") return <img className={styles.media} key={query.dataUpdatedAt} src={src} alt={title} referrerPolicy="no-referrer" onError={onError} />;
  if (kind === "video") return <video className={styles.media} key={query.dataUpdatedAt} src={src} controls playsInline preload="metadata" aria-label={title} onError={onError} />;
  if (kind === "audio") return <audio className={styles.media} key={query.dataUpdatedAt} src={src} controls preload="metadata" aria-label={title} onError={onError} />;
  return <Typography.Text type="secondary">该素材类型暂不支持预览</Typography.Text>;
}

function safeMediaUrl(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    return;
  }
}

function PreviewError({ title, error, retry }: { title: string; error?: Error | null; retry: () => void }) {
  return <Alert type="error" showIcon title={title} description={error?.message}
    action={<Button size="small" icon={<ReloadOutlined aria-hidden />} onClick={retry}>重试</Button>} />;
}
