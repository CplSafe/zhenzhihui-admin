import { useState } from 'react'
import { Button, Descriptions, Drawer, Image, Input, Select, Space, Tag, Tooltip } from 'antd'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ListPageShell } from '@/components/ListPageShell'
import { AssetThumb } from '@/components/AssetThumb'
import { Mono, StatusTag } from '@/components/cells'
import { usePagedList } from '@/hooks/usePagedList'
import { getAssetDownloadURL, listAssets } from '@/api/queries'
import type { ApiError } from '@/types/api'
import type { Asset } from '@/types/domain'
import { fmtTime, humanBytes } from '@/utils/format'

interface Filters {
  workspace_id?: number
  user_id?: number
  type?: string
  status?: string
  seedance_status?: string
}

const reviewStates: Record<string, { label: string; color: string }> = {
  submitting: { label: '送审中', color: 'processing' },
  processing: { label: '审核中', color: 'processing' },
  active: { label: '审核通过', color: 'success' },
  failed: { label: '审核失败', color: 'error' },
}

function SeedanceReviewTag({ asset }: { asset: Asset }) {
  const review = asset.seedance_moderation
  if (review === undefined) return <Tag>状态未提供</Tag>
  if (review === null) return <Tag>未送审</Tag>
  const state = reviewStates[review.status]
  return (
    <Tooltip title={review.last_error || `最近同步：${fmtTime(review.updated_at)}`}>
      <Tag color={state?.color}>{state?.label || '未知审核状态'}</Tag>
    </Tooltip>
  )
}

// 预览区:按需签发 URL,按类型渲染图片/视频/音频。
function AssetPreview({ asset }: { asset: Asset }) {
  const canPreview =
    (asset.type === 'image' ||
      asset.type === 'video' ||
      asset.type === 'audio') &&
    asset.status === 'active'

  const { data, isFetching, error } = useQuery<
    { download_url: string },
    ApiError
  >({
    queryKey: ['admin', 'asset-url', asset.id],
    queryFn: () => getAssetDownloadURL(asset.id),
    enabled: canPreview,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  if (!canPreview) return <span>该类型 / 状态不支持预览</span>
  if (isFetching) return <span>加载预览中…</span>
  if (error || !data?.download_url) return <span>预览地址签发失败</span>

  if (asset.type === 'image') {
    return <Image src={data.download_url} style={{ maxWidth: '100%' }} />
  }
  if (asset.type === 'video') {
    return (
      <video
        src={data.download_url}
        controls
        style={{ maxWidth: '100%', borderRadius: 8, background: '#000' }}
      />
    )
  }
  return <audio src={data.download_url} controls style={{ width: '100%' }} />
}

export function AssetsPage() {
  const [filters, setFilters] = useState<Filters>({})
  const [active, setActive] = useState<Asset | null>(null)

  const { items, loading, error, pagination, refetch } = usePagedList<Asset, Filters>({
    queryKey: 'admin-assets-list',
    filters,
    fetcher: listAssets,
  })

  const columns: TableColumnsType<Asset> = [
    {
      title: '预览',
      key: 'thumb',
      width: 72,
      render: (_, r) => <AssetThumb asset={r} />,
    },
    { title: 'ID', dataIndex: 'id', width: 80, render: (v) => <Mono>{v}</Mono> },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    { title: '类型', dataIndex: 'type', width: 90 },
    { title: '来源', dataIndex: 'source', width: 100 },
    {
      title: 'workspace',
      dataIndex: 'workspace_id',
      width: 110,
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: '大小',
      dataIndex: 'size_bytes',
      width: 110,
      render: (v) => <span className="tnum">{humanBytes(v)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: 'Seedance 审核',
      key: 'seedance_moderation',
      width: 140,
      render: (_, r) => <SeedanceReviewTag asset={r} />,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (v) => fmtTime(v),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setActive(r)}>
          预览
        </Button>
      ),
    },
  ]

  return (
    <>
      <ListPageShell<Asset>
        title="素材管理"
        filters={
          <Space wrap>
            <Input
              allowClear
              placeholder="workspace ID"
              style={{ width: 140 }}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  workspace_id: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
            <Select
              allowClear
              placeholder="类型"
              style={{ width: 130 }}
              options={[
                { value: 'image', label: '图片' },
                { value: 'video', label: '视频' },
                { value: 'audio', label: '音频' },
                { value: 'prompt', label: '提示词' },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
            />
            <Select
              allowClear
              placeholder="素材状态"
              style={{ width: 130 }}
              options={[
                { value: 'active', label: 'active' },
                { value: 'pending', label: 'pending' },
                { value: 'rejected', label: 'rejected' },
                { value: 'deleted', label: 'deleted' },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            />
            <Select
              aria-label="Seedance 审核状态"
              allowClear
              placeholder="Seedance 审核"
              style={{ width: 170 }}
              options={[
                { value: 'submitted', label: '已送审（全部状态）' },
                { value: 'unsubmitted', label: '未送审' },
                ...Object.entries(reviewStates).map(([value, state]) => ({ value, label: state.label })),
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, seedance_status: v }))}
            />
            <Button loading={loading} onClick={() => { void refetch() }}>刷新列表</Button>

          </Space>
        }
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        error={error}
        pagination={pagination}
      />

      <Drawer
        title={`素材详情 #${active?.id ?? ''}`}
        width={560}
        open={active !== null}
        onClose={() => setActive(null)}
        destroyOnHidden
      >
        {active && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <AssetPreview asset={active} />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="名称">{active.name}</Descriptions.Item>
              <Descriptions.Item label="类型">{active.type}</Descriptions.Item>
              <Descriptions.Item label="来源">{active.source}</Descriptions.Item>
              <Descriptions.Item label="MIME">
                {active.mime_type || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="大小">
                {humanBytes(active.size_bytes)}
              </Descriptions.Item>
              <Descriptions.Item label="workspace / user">
                <Mono>{active.workspace_id}</Mono> / <Mono>{active.user_id}</Mono>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={active.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Seedance 审核">
                <SeedanceReviewTag asset={active} />
              </Descriptions.Item>
              {active.seedance_moderation && <>
                <Descriptions.Item label="送审时间">{fmtTime(active.seedance_moderation.created_at)}</Descriptions.Item>
                <Descriptions.Item label="最近同步">{fmtTime(active.seedance_moderation.updated_at)}</Descriptions.Item>
                {active.seedance_moderation.last_error && <Descriptions.Item label="审核提示">{active.seedance_moderation.last_error}</Descriptions.Item>}
              </>}
              <Descriptions.Item label="对象键">
                <Mono>{active.object_key}</Mono>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {fmtTime(active.created_at)}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Drawer>
    </>
  )
}
