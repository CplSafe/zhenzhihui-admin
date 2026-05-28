import { useState } from 'react'
import { Input, Typography } from 'antd'

interface JsonFieldProps {
  // 受控值:任意 JSON 对象/数组。
  value?: unknown
  onChange?: (v: unknown) => void
  rows?: number
  placeholder?: string
}

function serialize(value: unknown): string {
  if (value === undefined || value === null) return ''
  return JSON.stringify(value, null, 2)
}

// JSON 编辑字段:把对象序列化成文本编辑,失焦时校验并回写。
// 用于模型配置里 pricing / params_schema / result_schema 这类结构因 provider 而异的字段
// —— 后端本就设计为"运维直接改 JSON",所以前端用原始 JSON 编辑器最贴合。
export function JsonField({ value, onChange, rows = 8, placeholder }: JsonFieldProps) {
  const [text, setText] = useState(() => serialize(value))
  const [error, setError] = useState<string | null>(null)

  // 外部值变化(如编辑回填)时同步文本 —— 在渲染期比对上一次序列化结果,
  // 避免在 effect 里 setState 触发级联渲染(react-hooks/set-state-in-effect)。
  const serialized = serialize(value)
  const [prevSerialized, setPrevSerialized] = useState(serialized)
  if (prevSerialized !== serialized) {
    setPrevSerialized(serialized)
    setText(serialized)
    setError(null)
  }

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setError(null)
      onChange?.(undefined)
      return
    }
    try {
      const parsed = JSON.parse(trimmed)
      setError(null)
      onChange?.(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 格式错误')
    }
  }

  return (
    <div>
      <Input.TextArea
        value={text}
        rows={rows}
        placeholder={placeholder ?? '{ }'}
        status={error ? 'error' : undefined}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
      />
      {error && (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>
          JSON 解析失败:{error}
        </Typography.Text>
      )}
    </div>
  )
}
