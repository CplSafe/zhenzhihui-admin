import { useRef, useState } from "react";
import { Alert, App, Button, Modal, Space, Spin } from "antd";
import { HolderOutlined } from "@ant-design/icons";
import { listAllModels, reorderModels } from "@/api/models";
import type { ModelVersion } from "@/types/domain";
import { ApiError } from "@/types/api";

export function ModelOrderButton({ onSaved }: { onSaved: () => void }) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [snapshot, setSnapshot] = useState<ModelVersion[]>([]);
  const dragged = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listAllModels();
      setModels(rows);
      setSnapshot(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };
  const move = (from: number, to: number) => {
    setModels((rows) => {
      const next = [...rows];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  };
  const save = async () => {
    setSaving(true);
    try {
      await reorderModels(models, snapshot);
      message.success("已保存模型顺序");
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };
  return <>
    <Button onClick={() => { setOpen(true); void load(); }}>调整顺序</Button>
    <Modal title="调整模型顺序" open={open} width={720}
      onCancel={() => setOpen(false)} closable={!loading && !saving}
      maskClosable={!loading && !saving} keyboard={!loading && !saving}
      cancelButtonProps={{ disabled: loading || saving }}
      okText="保存顺序" onOk={() => void save()} confirmLoading={saving}
      okButtonProps={{ disabled: loading || !!error || models.length === 0 }}>
      <p>拖动模型行或点击上下移调整全量模型顺序。保存后序号按 1、2、3… 更新，前台模型列表同步使用此顺序。</p>
      {error && <Alert type="error" showIcon title={error} action={<Button size="small" disabled={loading || saving} onClick={() => void load()}>重新加载</Button>} />}
      {loading ? <Spin /> : <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
        {models.map((model, index) => <div key={model.id} draggable={!saving && !error}
          onDragStart={(e) => { dragged.current = index; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(model.id)); }}
          onDragEnd={() => { dragged.current = null; }}
          onDragOver={(e) => { if (!saving && !error) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (!saving && !error && dragged.current !== null) move(dragged.current, index); dragged.current = null; }}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: "1px solid #eee", cursor: "grab" }}>
          <HolderOutlined /><span>{index + 1}</span>
          <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            <strong>{model.display_name}</strong>
            <div style={{ color: "#888", fontSize: 12 }}>{model.provider} · {model.version} · {model.enabled ? "已启用" : "已停用"}</div>
          </div>
          <Space size={0}>
            <Button size="small" type="text" disabled={saving || !!error || index === 0} onClick={() => move(index, index - 1)}>上移</Button>
            <Button size="small" type="text" disabled={saving || !!error || index === models.length - 1} onClick={() => move(index, index + 1)}>下移</Button>
          </Space>
        </div>)}
        {!error && models.length === 0 && <p>暂无模型</p>}
      </div>}
    </Modal>
  </>;
}
