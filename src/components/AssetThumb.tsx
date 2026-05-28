import { useQuery } from '@tanstack/react-query'
import { Image } from 'antd'
import {
  FileOutlined,
  SoundOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { getAssetDownloadURL } from '@/api/queries'
import type { ApiError } from '@/types/api'
import type { Asset } from '@/types/domain'

// 列表缩略图:仅对图片类型自动签发 URL 并显示;其余类型显示类型图标。
// 视频首帧浏览器无法离线生成,这里用 <video preload=metadata> 让浏览器抓首帧。
export function AssetThumb({ asset }: { asset: Asset }) {
  const isImage = asset.type === 'image'
  const isVideo = asset.type === 'video'
  const isAudio = asset.type === 'audio'

  // 仅图片/视频需要 URL;active 状态才有对象可签。
  const needUrl = (isImage || isVideo) && asset.status === 'active'

  const { data } = useQuery<{ download_url: string }, ApiError>({
    queryKey: ['admin', 'asset-url', asset.id],
    queryFn: () => getAssetDownloadURL(asset.id),
    enabled: needUrl,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  const box: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-canvas-soft)',
    color: 'var(--color-ink-mute)',
  }

  if (isImage) {
    return data?.download_url ? (
      <Image
        src={data.download_url}
        width={48}
        height={48}
        style={{ objectFit: 'cover', borderRadius: 6 }}
      />
    ) : (
      <div style={box}>
        <FileOutlined />
      </div>
    )
  }

  if (isVideo) {
    return data?.download_url ? (
      <video
        src={data.download_url}
        width={48}
        height={48}
        preload="metadata"
        muted
        style={{ objectFit: 'cover', borderRadius: 6, background: '#000' }}
      />
    ) : (
      <div style={box}>
        <VideoCameraOutlined />
      </div>
    )
  }

  return (
    <div style={box}>
      {isAudio ? <SoundOutlined /> : <FileOutlined />}
    </div>
  )
}
