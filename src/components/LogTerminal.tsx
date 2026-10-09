import { useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Input, Select, Space, Switch, Typography } from 'antd'
import { CopyOutlined, DownloadOutlined, PauseOutlined, PlayCircleOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons'
import { listOperationalLogs, type LogFilters, type OperationalLog } from '@/api/operationalLogs'
import './LogTerminal.css'

const MAX_LINES = 2000
function lineText(row: OperationalLog) { return `${new Date(row.created_at).toLocaleString()} [${row.level.toUpperCase()}] ${row.message}` }

export function LogTerminal({ filters, canLive, onSelect }: { filters: LogFilters; canLive: boolean; onSelect: (row: OperationalLog) => void }) {
  const { message } = App.useApp()
  const [rows, setRows] = useState<OperationalLog[]>([])
  const [running, setRunning] = useState(canLive)
  const [follow, setFollow] = useState(true)
  const [wrap, setWrap] = useState(true)
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<string>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState('')
  const [retry, setRetry] = useState(0)
  const cursor = useRef(0)
  const viewport = useRef<HTMLDivElement>(null)
  const text = search.toLocaleLowerCase()
  const visible = rows.filter(row => (!level || row.level === level) && (!text || lineText(row).toLocaleLowerCase().includes(text)))
  const output = visible.map(lineText).join('\n')

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function read() {
      try {
        const page = await listOperationalLogs('application', { ...filters, after_id: cursor.current || undefined, limit: 100, offset: 0, live: running && canLive })
        if (cancelled) return
        const ordered = [...page.items].sort((a, b) => a.id - b.id)
        if (ordered.length) {
          cursor.current = Math.max(cursor.current, ...ordered.map(row => row.id))
          setRows(previous => {
            const merged = new Map(previous.map(row => [row.id, row]))
            ordered.forEach(row => merged.set(row.id, row))
            return [...merged.values()].sort((a, b) => a.id - b.id).slice(-MAX_LINES)
          })
        }
        setError('')
        setUpdated(new Date().toLocaleTimeString())
        if (running && canLive) timer = setTimeout(() => void read(), page.items.length === 100 ? 250 : 2000)
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : '日志加载失败'); setRunning(false) }
      } finally { if (!cancelled) setLoading(false) }
    }
    // Pausing does not consume a new page; an explicit refresh still works.
    if (running || cursor.current === 0 || retry > 0) void read()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [filters, running, canLive, retry])

  useEffect(() => {
    if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
  }, [rows, follow, search, level])

  const download = () => {
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `application-logs-${cursor.current}.log`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="log-terminal" aria-label="实时应用日志">
    <div className="log-terminal__toolbar">
      <Space wrap><span className={`log-terminal__status ${running && !error ? 'is-live' : ''}`} />
        <strong>{error ? '连接中断' : running ? '实时日志' : '已暂停'}</strong>
        <span className="log-terminal__muted">{updated ? `更新于 ${updated}` : '正在连接'} · {rows.length} / {MAX_LINES} 行</span>
      </Space>
      <Space wrap>
        {canLive && <Button size="small" icon={running ? <PauseOutlined /> : <PlayCircleOutlined />} onClick={() => setRunning(v => !v)}>{running ? '暂停接收' : '继续接收'}</Button>}
        <Button size="small" onClick={() => setRetry(v => v + 1)}>刷新</Button>
        <Button size="small" icon={<CopyOutlined />} disabled={!output} onClick={() => { void navigator.clipboard.writeText(output).then(() => message.success('已复制当前筛选日志'), () => message.error('复制失败，请手动选择日志')) }}>复制</Button>
        <Button size="small" icon={<DownloadOutlined />} disabled={!output} onClick={download}>下载</Button>
      </Space>
    </div>
    <div className="log-terminal__filters"><Space wrap>
      <Input.Search aria-label="搜索当前日志" placeholder="搜索已加载日志" allowClear value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
      <Select aria-label="筛选当前日志级别" placeholder="全部级别" allowClear value={level} onChange={setLevel} style={{ width: 125 }} options={['info', 'warn', 'error'].map(value => ({ value, label: value.toUpperCase() }))} />
      <Switch size="small" checked={follow} onChange={setFollow} aria-label="跟随最新日志" /><span>跟随最新</span>
      <Switch size="small" checked={wrap} onChange={setWrap} aria-label="自动换行" /><span>自动换行</span>
    </Space></div>
    {error && <Alert type="error" showIcon title="日志连接失败，已保留当前内容" description={error} action={<Button onClick={() => setRetry(v => v + 1)}>重试</Button>} />}
    <div ref={viewport} className={`log-terminal__viewport ${wrap ? 'is-wrapped' : ''}`} role="log" aria-label="应用日志内容" aria-live="off" tabIndex={0} onScroll={() => {
      const el = viewport.current
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 50 && follow) setFollow(false)
    }}>
      {!visible.length && <div className="log-terminal__empty">{loading ? '正在读取日志…' : rows.length ? '当前筛选没有匹配日志' : '暂无日志，等待应用输出…'}</div>}
      {visible.map(row => <div className={`log-terminal__line level-${row.level}`} key={row.id}>
        <button type="button" className="log-terminal__line-id" onClick={() => onSelect(row)} aria-label={`查看日志 ${row.id} 详情`}>{row.id}</button>
        <span>{lineText(row)}</span>
      </div>)}
    </div>
    <div className="log-terminal__footer"><Typography.Text>显示最近 {MAX_LINES} 行以内的应用日志 · 每 2 秒增量读取 · 历史记录保留 30 天</Typography.Text>
      {!follow && <Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={() => setFollow(true)}>回到最新</Button>}
    </div>
  </section>
}
