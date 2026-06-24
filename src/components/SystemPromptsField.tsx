import { Button, Input, Select, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

interface SystemPromptsFieldProps {
  value?: Record<string, string>;
  onChange?: (value: Record<string, string>) => void;
  // 该模型已声明的操作码,供下拉选择;提示词只能配给这些 op(与后端白名单一致)。
  operationCodes?: string[];
}

// 一条提示词配置 = { op, prompt }。用数组承载编辑态(对象 key 不便于"空 op 待选"的中间态)。
interface Row {
  op: string;
  prompt: string;
}

function toRows(value?: Record<string, string>): Row[] {
  return Object.entries(value ?? {}).map(([op, prompt]) => ({ op, prompt }));
}

// 回写成 Record:跳过 op 为空的未完成行,避免污染。op 重复时后者覆盖前者(UI 上会提示)。
function toRecord(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const op = r.op.trim();
    if (op) out[op] = r.prompt;
  }
  return out;
}

export function SystemPromptsField({
  value,
  onChange,
  operationCodes = [],
}: SystemPromptsFieldProps) {
  const rows = toRows(value);

  const emit = (next: Row[]) => onChange?.(toRecord(next));

  const update = (idx: number, patch: Partial<Row>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    emit(next);
  };
  const add = () => emit([...rows, { op: "", prompt: "" }]);
  const remove = (idx: number) => emit(rows.filter((_, i) => i !== idx));

  // 下拉选项:模型已填的 operation_codes;chat 模型一般是 responses.* 系列。
  const opOptions = operationCodes.map((c) => ({ value: c, label: c }));

  return (
    <div>
      {rows.length === 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          暂无提示词。点下方「添加提示词」为某个操作码配置后端系统提示词(前端不可覆盖)。
        </Typography.Text>
      )}
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {rows.map((r, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Space
              style={{
                width: "100%",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Select
                style={{ width: 280 }}
                placeholder="选择操作码(如 responses.chat)"
                value={r.op || undefined}
                options={opOptions}
                showSearch
                onChange={(v) => update(idx, { op: v })}
                notFoundContent="先在上方「操作码」里填写,再来这里选"
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(idx)}
              >
                删除
              </Button>
            </Space>
            <Input.TextArea
              rows={4}
              placeholder="该操作码下的系统提示词,例如:你是帧智汇的专业助手……"
              value={r.prompt}
              onChange={(e) => update(idx, { prompt: e.target.value })}
            />
          </div>
        ))}
      </Space>
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={add}
        style={{ marginTop: rows.length ? 12 : 8 }}
        block
      >
        添加提示词
      </Button>
    </div>
  );
}
