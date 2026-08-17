import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { useQuery } from "@tanstack/react-query";
import { ListPageShell } from "@/components/ListPageShell";
import { Count, Mono, StatusTag } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import { getAgentSession, getAgentStats, listAgentSessions } from "@/api/agent";
import type { ApiError } from "@/types/api";
import type {
  AgentMessage,
  AgentSession,
  AgentSessionDetail,
  AgentStats,
} from "@/types/domain";
import {
  AGENT_EXEC_MODES,
  AGENT_KINDS,
  AGENT_STATUSES,
} from "@/types/domain";
import { fmtTime } from "@/utils/format";

interface Filters {
  workspace_id?: number;
  user_id?: number;
  kind?: string;
  status?: string;
}

const label = (map: Record<string, string>, key?: string) =>
  (key && map[key]) || key || "-";

// 会话消息按角色着色,便于快速扫出"模型调了什么工具"。
const ROLE_META: Record<string, { color: string; text: string }> = {
  system: { color: "default", text: "系统" },
  user: { color: "blue", text: "用户" },
  assistant: { color: "purple", text: "助手" },
  tool: { color: "green", text: "工具" },
};

function MessageList({ messages }: { messages: AgentMessage[] }) {
  if (messages.length === 0) {
    return <Typography.Text type="secondary">暂无消息</Typography.Text>;
  }
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {messages.map((m) => {
        const meta = ROLE_META[m.role] ?? { color: "default", text: m.role };
        return (
          <Card key={m.id} size="small">
            <Space size={8} wrap style={{ marginBottom: 8 }}>
              <Tag color={meta.color}>{meta.text}</Tag>
              {m.tool_name && <Mono>{m.tool_name}</Mono>}
              {m.tokens_used > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {m.tokens_used.toLocaleString()} tokens
                </Typography.Text>
              )}
            </Space>
            <pre
              style={{
                margin: 0,
                maxHeight: 240,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
              }}
            >
              {m.content || "(无文本内容)"}
            </pre>
            {m.tool_calls != null && (
              <pre
                style={{
                  margin: "8px 0 0",
                  maxHeight: 180,
                  overflow: "auto",
                  fontSize: 11,
                  opacity: 0.75,
                }}
              >
                {JSON.stringify(m.tool_calls, null, 2)}
              </pre>
            )}
          </Card>
        );
      })}
    </Space>
  );
}

export function AgentSessionsPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [activeId, setActiveId] = useState<number | null>(null);

  const stats = useQuery<AgentStats, ApiError>({
    queryKey: ["admin", "agent", "stats"],
    queryFn: getAgentStats,
  });

  const { items, loading, error, pagination } = usePagedList<
    AgentSession,
    Filters
  >({
    queryKey: "admin-agent-sessions",
    filters,
    fetcher: listAgentSessions,
  });

  const detail = useQuery<AgentSessionDetail, ApiError>({
    queryKey: ["admin", "agent", "session", activeId],
    queryFn: () => getAgentSession(activeId as number),
    enabled: activeId !== null,
  });

  const columns: TableColumnsType<AgentSession> = [
    { title: "ID", dataIndex: "id", width: 80, render: (v) => <Mono>{v}</Mono> },
    {
      title: "类型",
      dataIndex: "kind",
      width: 110,
      render: (v) => label(AGENT_KINDS, v),
    },
    { title: "标题", dataIndex: "title", ellipsis: true },
    {
      title: "空间",
      dataIndex: "workspace_id",
      width: 90,
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: "用户",
      dataIndex: "user_id",
      width: 90,
      render: (v) => <Mono>{v}</Mono>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: "模式",
      dataIndex: "exec_mode",
      width: 100,
      render: (v: string) => (
        <Tag color={v === "auto" ? "orange" : "default"}>
          {label(AGENT_EXEC_MODES, v)}
        </Tag>
      ),
    },
    {
      title: "tokens",
      dataIndex: "total_tokens",
      width: 110,
      render: (v) => <Count value={v} />,
    },
    {
      title: "已耗积分",
      dataIndex: "spent_credits",
      width: 100,
      render: (v) => <Count value={v} />,
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 170,
      render: (v) => fmtTime(v),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setActiveId(r.id)}>
          详情
        </Button>
      ),
    },
  ];

  const session = detail.data?.session;

  return (
    <>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="会话总数"
                value={stats.data?.total_sessions ?? 0}
                loading={stats.isFetching}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="进行中"
                value={stats.data?.active_sessions ?? 0}
                loading={stats.isFetching}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="累计 tokens"
                value={stats.data?.total_tokens ?? 0}
                loading={stats.isFetching}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="累计消耗积分"
                value={stats.data?.total_credits ?? 0}
                loading={stats.isFetching}
              />
            </Card>
          </Col>
        </Row>

        <ListPageShell<AgentSession>
          title="智能体会话"
          filters={
            <Space wrap>
              <Input
                allowClear
                placeholder="空间 ID"
                style={{ width: 130 }}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    workspace_id: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
              />
              <Input
                allowClear
                placeholder="用户 ID"
                style={{ width: 130 }}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    user_id: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
              <Select
                allowClear
                placeholder="会话类型"
                style={{ width: 150 }}
                options={Object.entries(AGENT_KINDS).map(([value, text]) => ({
                  value,
                  label: text,
                }))}
                onChange={(v) => setFilters((f) => ({ ...f, kind: v }))}
              />
              <Select
                allowClear
                placeholder="状态"
                style={{ width: 150 }}
                options={Object.entries(AGENT_STATUSES).map(
                  ([value, text]) => ({ value, label: text }),
                )}
                onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              />
            </Space>
          }
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          error={error}
          pagination={pagination}
        />
      </Space>

      <Drawer
        title={session ? `会话 #${session.id}` : "会话详情"}
        width={860}
        open={activeId !== null}
        onClose={() => setActiveId(null)}
        loading={detail.isFetching}
      >
        {detail.error && (
          <Alert type="error" showIcon message={detail.error.message} />
        )}
        {session && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="标题" span={2}>
                {session.title || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                {label(AGENT_KINDS, session.kind)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={session.status} />
              </Descriptions.Item>
              <Descriptions.Item label="执行模式">
                <Tag color={session.exec_mode === "auto" ? "orange" : "default"}>
                  {label(AGENT_EXEC_MODES, session.exec_mode)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="积分上限">
                {session.credit_cap > 0 ? session.credit_cap : "不限"}
              </Descriptions.Item>
              <Descriptions.Item label="已耗积分">
                <Count value={session.spent_credits} />
              </Descriptions.Item>
              <Descriptions.Item label="累计 tokens">
                <Count value={session.total_tokens} />
              </Descriptions.Item>
              <Descriptions.Item label="空间 / 用户">
                <Mono>
                  {session.workspace_id} / {session.user_id}
                </Mono>
              </Descriptions.Item>
              <Descriptions.Item label="模型版本">
                <Mono>{session.model_version_id}</Mono>
              </Descriptions.Item>
              {session.last_error && (
                <Descriptions.Item label="最近错误" span={2}>
                  <Typography.Text type="danger">
                    {session.last_error}
                  </Typography.Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            {detail.data && detail.data.artifacts.length > 0 && (
              <Card size="small" title="产出物">
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {detail.data.artifacts.map((a) => (
                    <Space key={a.id} size={8} wrap>
                      <Tag>{a.kind}</Tag>
                      <span>{a.title || "-"}</span>
                      {a.ai_task_id ? (
                        <Typography.Text type="secondary">
                          任务 #{a.ai_task_id}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  ))}
                </Space>
              </Card>
            )}

            <Card size="small" title={`对话记录(${detail.data?.messages.length ?? 0} 条)`}>
              <MessageList messages={detail.data?.messages ?? []} />
            </Card>
          </Space>
        )}
      </Drawer>
    </>
  );
}
