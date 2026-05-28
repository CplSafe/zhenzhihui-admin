import { useState } from 'react'
import { Input, Typography } from 'antd'

interface JsonFieldProps {
  // 受控值:任意 JSON 对象/数组。
  value?: unknown
  onChange?: (v: unknown) => void
  // 校验状态变化回调:父组件据此禁用保存按钮,避免把非法 JSON 静默存成旧值。
  onValidityChange?: (valid: boolean) => void
  rows?: number
  placeholder?: string
}

function serialize(value: unknown): string {
  if (value === undefined || value === null) return ''
  return JSON.stringify(value, null, 2)
}

// JSON 编辑字段:把对象序列化成文本编辑,实时解析并回写。
// 用于模型配置 / 套餐 entitlements 这类结构灵活的字段(后端本就设计为"运维直接改 JSON")。
//
// 关键:每次输入都解析并 onChange(而非仅失焦),解析失败时上报 onValidityChange(false)
// 让父组件禁用保存——杜绝"输入非法 JSON 后点确定,静默保存旧值"的数据丢失。
export function JsonField({
  value,
  onChange,
  onValidityChange,
  rows = 8,
  placeholder,
}: JsonFieldProps) {
  const [text, setText] = useState(() => serialize(value))
  const [error, setError] = useState<string | null>(null)

  // 外部值变化(编辑回填)时同步文本 —— 渲染期比对上次序列化结果,避免在 effect 里 setState。
  const serialized = serialize(value)
  const [prevSerialized, setPrevSerialized] = useState(serialized)
  if (prevSerialized !== serialized) {
    setPrevSerialized(serialized)
    setText(serialized)
    setError(null)
    onValidityChange?.(true)
  }

  const handleChange = (raw: string) => {
    setText(raw)
    const trimmed = raw.trim()
    if (trimmed === '') {
      setError(null)
      onValidityChange?.(true)
      onChange?.(undefined)
      return
    }
    try {
      const parsed = JSON.parse(trimmed)
      setError(null)
      onValidityChange?.(true)
      onChange?.(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 格式错误')
      onValidityChange?.(false)
      // 解析失败时不回写 onChange:父组件已被禁用保存,旧值保留但保存按钮不可点。
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
        onChange={(e) => handleChange(e.target.value)}
      />
      {error && (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>
          JSON 解析失败:{error}
        </Typography.Text>
      )}
    </div>
  )
}
