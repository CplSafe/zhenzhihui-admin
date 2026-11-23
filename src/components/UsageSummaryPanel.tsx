import { Alert, Button, Card, Descriptions, Skeleton, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { getUserUsageSummary, getWorkspaceUsageSummary } from "@/api/queries";
import { Credits } from "@/components/cells";
import type { ApiError } from "@/types/api";
import type { UsageSummary } from "@/types/domain";
import { fmtDuration, fmtNumber } from "@/utils/format";

type UsageSummaryPanelProps =
  | { scope: "user"; id: number; workspaceId?: number }
  | { scope: "workspace"; id: number; workspaceId?: never };

export function UsageSummaryPanel({ scope, id, workspaceId }: UsageSummaryPanelProps) {
  const query = useQuery<UsageSummary, ApiError>({
    queryKey: ["admin", "usage-summary", scope, id, workspaceId],
    queryFn: () => scope === "user" ? getUserUsageSummary(id, workspaceId) : getWorkspaceUsageSummary(id),
    retry: false,
  });
  const summary = query.data;
  const completeDuration = summary?.video_duration_seconds;
  const tasks = summary?.task_counts;
  const description = workspaceId
    ? "统计该用户在当前空间的用量，本月以北京时间自然月计算。"
    : scope === "user"
      ? "使用积分和生成素材按本人跨所有空间累计；剩余积分仅为个人空间可用余额，不含团队共享积分。"
      : "使用积分和生成素材按整个空间累计；剩余积分为空间可用余额。";

  return (
    <Card
      title={workspaceId ? "该用户在此空间的使用统计" : "使用统计"}
      size="small"
      extra={
        <Button
          size="small"
          style={{ minHeight: 40 }}
          icon={<ReloadOutlined />}
          loading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isError ? "重试" : "刷新"}
        </Button>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        {query.error && (
          <Alert
            type="error"
            showIcon
            title={summary ? "刷新失败，以下为上次查询结果" : "使用统计加载失败，请重试"}
            description={query.error.message}
          />
        )}
        {query.isPending && (
          <div role="status" aria-label="正在加载使用统计">
            <Skeleton active title={false} paragraph={{ rows: 5 }} />
          </div>
        )}
        {summary && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="累计使用积分总数">
              <Credits value={summary.used_credits} showEquivalent />
            </Descriptions.Item>
            <Descriptions.Item label="累计视频数量">
              <span className="tnum">{fmtNumber(summary.video_count)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="累计图片数量">
              <span className="tnum">{fmtNumber(summary.image_count)}</span>
            </Descriptions.Item>
            {(!workspaceId || summary.remaining_credits != null) && (
              <Descriptions.Item label={workspaceId ? "个人空间可用积分" : "剩余积分总数"}>
                {summary.remaining_credits === null ? "暂无钱包" : <Credits value={summary.remaining_credits} showEquivalent />}
              </Descriptions.Item>
            )}
            {workspaceId && summary.month_used_credits != null && (
              <Descriptions.Item label="本月已结算积分">
                <Credits value={summary.month_used_credits} showEquivalent />
              </Descriptions.Item>
            )}
            {workspaceId && tasks && (
              <>
                <Descriptions.Item label="累计生成任务">
                  {formatTaskCounts(tasks.total, tasks.succeeded, tasks.failed, tasks.other)}
                </Descriptions.Item>
                <Descriptions.Item label="本月生成任务">
                  {formatTaskCounts(tasks.month_total, tasks.month_succeeded, tasks.month_failed, tasks.month_other)}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="视频总时长">
              <Space orientation="vertical" size={4}>
                {completeDuration == null ? (
                  <>
                    <Typography.Text strong>待补全</Typography.Text>
                    <Typography.Text type="secondary">
                      仍有 {fmtNumber(summary.missing_video_duration_count)} 个视频缺少时长；已统计部分为{" "}
                      <span className="tnum">{fmtDuration(summary.known_video_duration_seconds)}</span>。
                    </Typography.Text>
                  </>
                ) : (
                  <>
                    <span className="tnum">{fmtDuration(completeDuration)}</span>
                    <Typography.Text type="secondary" className="tnum">
                      共 {fmtNumber(completeDuration)} 秒
                    </Typography.Text>
                  </>
                )}
                {summary.estimated_video_count > 0 && (
                  <Typography.Text type="secondary">
                    含 {fmtNumber(summary.estimated_video_count)} 个视频的请求时长估算。
                  </Typography.Text>
                )}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        )}
        <Typography.Text type="secondary">
          {description}
          图片、视频仅统计有效且未删除的 AI 生成素材，不含上传素材；使用积分按已结算流水累计。
        </Typography.Text>
      </Space>
    </Card>
  );
}

function formatTaskCounts(total: number, succeeded: number, failed: number, other: number): string {
  return `共 ${fmtNumber(total)} · 成功 ${fmtNumber(succeeded)} · 失败 ${fmtNumber(failed)} · 其他 ${fmtNumber(other)}`;
}
