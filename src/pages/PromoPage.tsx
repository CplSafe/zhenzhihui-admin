import { useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  actPromo,
  completePromoUpload,
  createPromoUpload,
  exportPromo,
  getPromo,
  getPromoDownload,
  getPromoNotices,
  getPromoStats,
  listPromo,
  readPromoNotice,
  retryPromoUpload,
  sendPromoFile,
} from "@/api/promo";
import type {
  PromoAction,
  PromoFilter,
  PromoMaterial,
  PromoOrder,
  PromoTicket,
} from "@/api/promo";
import { ListPageShell } from "@/components/ListPageShell";
import { Credits } from "@/components/cells";
import { usePagedList } from "@/hooks/usePagedList";
import { usePermission } from "@/hooks/usePermission";
import { Permission } from "@/types/admin";
import { fmtCredits, fmtTime, humanBytes } from "@/utils/format";
import { manualVideoMime } from "@/utils/manualVideo";
import {
  billingLabels,
  promisedDate,
  promoCapabilities,
  promoEventContent,
  promoEventLabels,
  promoIsOverdue,
  promoStates,
} from "@/utils/promo";
import "./promo.css";
const stateLabel = (s: string) =>
  promoStates.find((v) => v.value === s)?.label ?? s;
function ProductionTag({ order }: { order: PromoOrder }) {
  return (
    <Tag
      color={
        promoIsOverdue(order)
          ? "error"
          : order.status === "review"
            ? "gold"
            : order.status === "delivered" || order.status === "completed"
              ? "success"
              : undefined
      }
    >
      {stateLabel(order.status)}
    </Tag>
  );
}
export function PromoPage() {
  const [filters, setFilters] = useState<PromoFilter>({});
  const [id, setID] = useState<number | null>(null);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const { message } = App.useApp();
  const { has } = usePermission();
  const canWrite = has(Permission.PROMO_WRITE);
  const qc = useQueryClient();
  const list = usePagedList<PromoOrder, PromoFilter>({
    queryKey: "promo-list",
    filters,
    initialPageSize: 50,
    fetcher: listPromo,
  });
  const stats = useQuery({
    queryKey: ["promo-stats"],
    queryFn: getPromoStats,
    refetchInterval: 60000,
  });
  const notices = useQuery({
    queryKey: ["promo-notices"],
    queryFn: getPromoNotices,
    refetchInterval: 60000,
  });
  const exporting = useMutation({
    mutationFn: () => exportPromo(filters),
    onError: (e: Error) => void message.error(e.message || "导出失败，请重试"),
  });
  const markRead = useMutation({
    mutationFn: readPromoNotice,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["promo-notices"] }),
    onError: (e: Error) => void message.error(e.message),
  });
  const columns: TableColumnsType<PromoOrder> = [
    {
      title: "订单号",
      dataIndex: "id",
      width: 105,
      fixed: "left",
      render: (v) => (
        <Button type="link" onClick={() => setID(v)}>
          #{v}
        </Button>
      ),
    },
    { title: "单位名", dataIndex: "company", width: 180 },
    {
      title: "承诺交付",
      dataIndex: "due_at",
      width: 125,
      render: promisedDate,
    },
    {
      title: "制作状态",
      width: 110,
      render: (_, o) => <ProductionTag order={o} />,
    },
    {
      title: "计费状态",
      dataIndex: "billing_status",
      width: 105,
      render: (v) => billingLabels[v] ?? v,
    },
    {
      title: "是否逾期",
      width: 100,
      render: (_, o) =>
        promoIsOverdue(o) ? <Tag color="error">已逾期</Tag> : "否",
    },
    {
      title: "修改申请",
      dataIndex: "rework_status",
      width: 110,
      render: (v) =>
        v === "requested" ? (
          <Tag color="gold">待处理</Tag>
        ) : (
          ((
            {
              unused: "未申请",
              accepted: "返工中",
              rejected: "已婉拒",
              fulfilled: "已交付",
            } as Record<string, string>
          )[v] ?? v)
        ),
    },
    {
      title: "提醒",
      dataIndex: "notice_status",
      width: 105,
      render: (v) =>
        v === "failed" ? (
          <Tag color="error">未提醒</Tag>
        ) : v === "delivered" ? (
          "已提醒"
        ) : (
          "待提醒"
        ),
    },
    { title: "类型", width: 110, render: () => "宣传片 T+5" },
    { title: "联系人", dataIndex: "contact", width: 110 },
    { title: "联系方式", dataIndex: "phone", width: 150 },
    {
      title: "时长",
      dataIndex: "duration_seconds",
      width: 85,
      render: (v) => `${v / 60} 分钟`,
    },
    { title: "比例", dataIndex: "ratio", width: 80 },
    { title: "分辨率", dataIndex: "resolution", width: 90 },
    {
      title: "素材完成度",
      dataIndex: "material_status",
      width: 130,
      render: (v, o) => (
        <Space orientation="vertical" size={0}>
          <span>
            {v === "offline_registered"
              ? "线下已交接"
              : v === "ready"
                ? "素材齐备"
                : v}
          </span>
          {o.low_resolution && <Tag color="warning">含低于1080P</Tag>}
        </Space>
      ),
    },
    {
      title: "实际交付",
      dataIndex: "delivered_at",
      width: 180,
      render: fmtTime,
    },
    { title: "提交时间", dataIndex: "created_at", width: 180, render: fmtTime },
    {
      title: "操作",
      width: 100,
      fixed: "right",
      render: (_, o) => (
        <Button type="link" onClick={() => setID(o.id)}>
          查看订单
        </Button>
      ),
    },
  ];
  return (
    <div className="promo-page">
      <ListPageShell
        title="定制宣传片 T+5"
        titleLevel={1}
        filters={
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Space wrap size={24} aria-label="制作统计">
              {(["submitted", "working", "rework", "overdue"] as const).map(
                (k, i) => (
                  <span key={k}>
                    {["累计发起", "在制订单", "申请返工", "当前逾期"][i]}{" "}
                    <strong>{stats.data?.[k] ?? "—"}</strong>
                  </span>
                ),
              )}
              <Button onClick={() => setNoticesOpen(true)}>
                站内提醒
                {notices.data?.length ? `（${notices.data.length}）` : ""}
              </Button>
            </Space>
            {stats.error && (
              <Alert
                type="warning"
                title="统计加载失败"
                action={
                  <Button onClick={() => void stats.refetch()}>重试</Button>
                }
              />
            )}
            {!!stats.data?.capacity_alert && (
              <Alert
                type="warning"
                showIcon
                title="在制订单已达到提醒阈值，请关注制作排期"
              />
            )}
            <Space wrap>
              <Select
                aria-label="订单类型"
                value="promo_t5"
                style={{ width: 150 }}
                options={[{ value: "promo_t5", label: "宣传片 T+5" }]}
              />
              <Select
                aria-label="制作状态"
                placeholder="全部制作状态"
                allowClear
                style={{ width: 160 }}
                options={promoStates}
                onChange={(status) => setFilters((f) => ({ ...f, status }))}
              />
              <Select
                aria-label="计费状态"
                placeholder="全部计费状态"
                allowClear
                style={{ width: 145 }}
                options={Object.entries(billingLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
                onChange={(billing_status) =>
                  setFilters((f) => ({ ...f, billing_status }))
                }
              />
              <Select
                aria-label="逾期筛选"
                placeholder="全部期限"
                allowClear
                style={{ width: 125 }}
                options={[
                  { value: "yes", label: "仅逾期" },
                  { value: "no", label: "未逾期" },
                ]}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    overdue: v === undefined ? undefined : v === "yes",
                  }))
                }
              />
              <DatePicker.RangePicker
                aria-label="提交日期范围"
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    from: v?.[0]
                      ? `${v[0].format("YYYY-MM-DD")}T00:00:00+08:00`
                      : undefined,
                    to: v?.[1]
                      ? `${v[1].add(1, "day").format("YYYY-MM-DD")}T00:00:00+08:00`
                      : undefined,
                  }))
                }
              />
              <Button
                loading={list.loading}
                onClick={() => {
                  void list.refetch();
                  void stats.refetch();
                }}
              >
                刷新订单
              </Button>
              <Button
                loading={exporting.isPending}
                onClick={() => exporting.mutate()}
              >
                导出筛选结果
              </Button>
            </Space>
            <Typography.Text type="secondary">
              逾期订单置顶。共用制作账号，使用「谁在做」备注记录派工；复核通过后才向客户交付。
            </Typography.Text>
          </Space>
        }
        columns={columns}
        dataSource={list.items}
        rowKey="id"
        loading={list.loading}
        error={list.error}
        pagination={{ ...list.pagination, pageSizeOptions: [20, 50, 100] }}
      />
      {id !== null && (
        <PromoDrawer key={id} id={id} close={() => setID(null)} />
      )}
      <Drawer
        title="T+5 站内提醒"
        open={noticesOpen}
        onClose={() => setNoticesOpen(false)}
        size="min(480px,100vw)"
      >
        {notices.isPending ? (
          <Spin />
        ) : notices.error ? (
          <Alert
            type="error"
            title="提醒加载失败"
            description={notices.error.message}
            action={
              <Button onClick={() => void notices.refetch()}>重试</Button>
            }
          />
        ) : !notices.data?.length ? (
          <Empty description="暂无未读提醒" />
        ) : (
          notices.data.map((n) => (
            <div className="promo-notice" key={n.id}>
              <Space wrap>
                <Button
                  type="link"
                  onClick={() => {
                    setID(n.order_id);
                    setNoticesOpen(false);
                  }}
                >
                  订单 #{n.order_id}
                </Button>
                <span>
                  {(
                    {
                      new_order: "新订单",
                      rework: "修改申请",
                      overdue: "订单逾期",
                      reminder: "制作提醒",
                    } as Record<string, string>
                  )[n.kind] ?? n.kind}
                </span>
                {canWrite && (
                  <Button
                    size="small"
                    disabled={markRead.isPending}
                    onClick={() => markRead.mutate(n.id)}
                  >
                    标记已读
                  </Button>
                )}
              </Space>
              <div>{fmtTime(n.created_at)}</div>
            </div>
          ))
        )}
      </Drawer>
    </div>
  );
}
function PromoDrawer({ id, close }: { id: number; close: () => void }) {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const { has } = usePermission();
  const canWrite = has(Permission.PROMO_WRITE);
  const detail = useQuery({
    queryKey: ["promo-detail", id],
    queryFn: () => getPromo(id),
    refetchInterval: 30000,
  });
  const [dialog, setDialog] = useState<PromoAction["action"] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const ticket = useRef<PromoTicket | null>(null);
  const completed = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadedID, setUploadedID] = useState<number | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["promo-detail", id] });
    void qc.invalidateQueries({ queryKey: ["promo-list"] });
    void qc.invalidateQueries({ queryKey: ["promo-stats"] });
    void qc.invalidateQueries({ queryKey: ["promo-notices"] });
  };
  const action = useMutation({
    mutationFn: (body: PromoAction) => actPromo(id, body),
    onSuccess: () => {
      void message.success("订单已更新");
      setDialog(null);
      invalidate();
    },
    onError: (e: Error) => {
      void message.error(e.message);
      invalidate();
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("请先选择成片");
      const mime = manualVideoMime(file.name, file.type);
      if (!mime) throw new Error("请选择 MP4、MOV 或 WebM");
      controller.current = new AbortController();
      const signal = controller.current.signal;
      if (!ticket.current)
        ticket.current = await createPromoUpload(id, file, mime, signal);
      else if (!completed.current)
        ticket.current = await retryPromoUpload(
          ticket.current.material.id,
          signal,
        );
      if (!completed.current) {
        await sendPromoFile(ticket.current, file, setProgress, signal);
        completed.current = true;
      }
      return completePromoUpload(ticket.current.material.id, signal);
    },
    onSuccess: (m) => {
      setUploadedID(m.id);
      void message.success("视频已上传，请填写说明并提交复核");
      invalidate();
    },
    onError: (e: Error) => {
      void message.error(`上传未完成：${e.message}。可保留当前文件重试。`);
      invalidate();
    },
  });
  const o = detail.data?.order;
  const caps = o ? promoCapabilities(o) : null;
  const busy = action.isPending || upload.isPending;
  const openDialog = (kind: PromoAction["action"]) => {
    setDialog(kind);
  };
  const confirmDelivery = () => {
    if (!o) return;
    modal.confirm({
      title: "复核通过并交付给客户？",
      content:
        o.billing_status === "frozen"
          ? `客户将收到当前候选成片和交付说明，本次结算 ${fmtCredits(o.total_cost)} 积分。请先检查内容与 AIGC 标识。`
          : "本次为免费返工交付，不重复扣积分，也不重置修改权益。",
      okText: "复核通过并交付",
      cancelText: "继续检查",
      onOk: () =>
        action.mutateAsync({
          action: "deliver",
          material_id: o.candidate_material_id,
        }),
    });
  };
  const materials = detail.data?.materials ?? [];
  const outputs = materials.filter(
    (m) => m.role === "deliverable" && m.status === "active",
  );
  const dialogTitles: Partial<Record<PromoAction["action"], string>> = {
    note: "更新谁在做",
    reschedule: "调整承诺交付日",
    stage: "提交成片复核",
    reject_review: "复核退回制作",
    refund: "终止制作并全额退积分",
    accept_rework: "受理免费返工",
    reject_rework: "婉拒修改申请",
  };
  return (
    <>
      <Drawer
        title={`宣传片订单 #${id}`}
        size="min(920px,100vw)"
        open
        destroyOnHidden
        onClose={() => {
          if (!busy) close();
          else void message.info("请等待当前上传或订单处理完成");
        }}
        extra={
          <Button
            disabled={busy}
            loading={detail.isFetching}
            onClick={() => void detail.refetch()}
          >
            刷新详情
          </Button>
        }
      >
        {detail.isPending && <Spin />}
        {detail.error && (
          <Alert
            type="error"
            title="订单加载失败"
            description={detail.error.message}
            action={<Button onClick={() => void detail.refetch()}>重试</Button>}
          />
        )}
        {o && caps && (
          <Space orientation="vertical" size={20} style={{ width: "100%" }}>
            <Space wrap>
              <ProductionTag order={o} />
              <Tag>{billingLabels[o.billing_status]}</Tag>
              {promoIsOverdue(o) && <Tag color="error">承诺日已过</Tag>}
              {o.low_resolution && <Tag color="warning">含低于1080P</Tag>}
              {o.notice_status === "failed" && <Tag color="error">未提醒</Tag>}
            </Space>
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                { key: "company", label: "单位名", children: o.company },
                {
                  key: "contact",
                  label: "联系人 / 电话",
                  children: `${o.contact} / ${o.phone}`,
                },
                {
                  key: "spec",
                  label: "出片规格",
                  children: `${o.duration_seconds / 60}分钟 · ${o.ratio} · ${o.resolution}`,
                },
                {
                  key: "due",
                  label: "承诺交付日",
                  children: promisedDate(o.due_at),
                },
                {
                  key: "original",
                  label: "原承诺交付日",
                  children: promisedDate(o.original_due_at),
                },
                {
                  key: "delivered",
                  label: "实际交付",
                  children: fmtTime(o.delivered_at),
                },
                {
                  key: "cost",
                  label: "订单积分",
                  children: <Credits value={o.total_cost} />,
                },
                {
                  key: "ready",
                  label: "素材齐备时间",
                  children: fmtTime(o.material_ready_at),
                },
                {
                  key: "task",
                  label: "任务 / 工作空间 / 客户",
                  children: `${o.task_id} / ${o.workspace_id} / ${o.user_id}`,
                },
                {
                  key: "created",
                  label: "提交时间",
                  children: fmtTime(o.created_at),
                },
              ]}
            />
            {!canWrite && (
              <Alert type="info" title="当前账号仅可查看和下载，不能修改订单" />
            )}
            <Tabs
              items={[
                {
                  key: "request",
                  label: "需求与素材",
                  children: (
                    <Space
                      orientation="vertical"
                      size={20}
                      style={{ width: "100%" }}
                    >
                      <Descriptions
                        column={1}
                        size="small"
                        items={[
                          {
                            key: "scenario",
                            label: "用途",
                            children:
                              (
                                {
                                  government_corporate: "政企宣传",
                                  product_launch: "产品发布",
                                  investment_financing: "招商融资",
                                } as Record<string, string>
                              )[o.scenario] ?? o.scenario,
                          },
                          {
                            key: "voice",
                            label: "旁白 / 字幕",
                            children:
                              (
                                {
                                  both: "旁白＋字幕",
                                  subtitles: "仅字幕",
                                  narration: "仅旁白",
                                  none: "均不需要",
                                } as Record<string, string>
                              )[o.narration] ?? o.narration,
                          },
                          {
                            key: "brief",
                            label: "需求全文",
                            children: (
                              <div className="promo-text">{o.brief}</div>
                            ),
                          },
                          {
                            key: "ref",
                            label: "参考链接",
                            children:
                              o.reference_url &&
                              /^https?:\/\//.test(o.reference_url) ? (
                                <a
                                  href={o.reference_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {o.reference_url}
                                </a>
                              ) : (
                                "—"
                              ),
                          },
                        ]}
                      />
                      <section>
                        <Typography.Title level={5}>客户素材</Typography.Title>
                        {o.material_status === "offline_registered" && (
                          <Alert type="info" title="素材已登记线下交接" />
                        )}
                        <MediaList
                          materials={materials.filter(
                            (m) => m.role !== "deliverable",
                          )}
                        />
                        <Typography.Text type="secondary">
                          素材仅用于内部制作，不对外传播。保留期限与删除口径待法务确认。
                        </Typography.Text>
                      </section>
                      {canWrite && caps.note && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            action.mutate({
                              action: "quality",
                              low_resolution: !o.low_resolution,
                            })
                          }
                        >
                          {o.low_resolution
                            ? "清除低清标记"
                            : "标记含低于1080P素材"}
                        </Button>
                      )}
                    </Space>
                  ),
                },
                {
                  key: "production",
                  label: "制作与交付",
                  children: (
                    <Space
                      orientation="vertical"
                      size={20}
                      style={{ width: "100%" }}
                    >
                      <section>
                        <Typography.Title level={5}>谁在做</Typography.Title>
                        <div className="promo-text">
                          {o.assigned_note || "尚未填写派工备注"}
                        </div>
                        {canWrite && caps.note && (
                          <Button
                            disabled={busy}
                            onClick={() => openDialog("note")}
                          >
                            编辑派工备注
                          </Button>
                        )}
                      </section>
                      {canWrite && (
                        <Space wrap>
                          {caps.start && (
                            <Button
                              disabled={busy}
                              onClick={() => action.mutate({ action: "start" })}
                            >
                              开始制作
                            </Button>
                          )}
                          {caps.active && (
                            <Button
                              disabled={busy}
                              onClick={() => openDialog("reschedule")}
                            >
                              调整承诺日
                            </Button>
                          )}
                          {o.notice_status === "failed" && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                action.mutate({ action: "retry_notice" })
                              }
                            >
                              重试站内提醒
                            </Button>
                          )}
                        </Space>
                      )}
                      {canWrite && caps.upload && (
                        <section>
                          <Typography.Title level={5}>
                            上传候选成片
                          </Typography.Title>
                          <Space
                            orientation="vertical"
                            style={{ width: "100%" }}
                          >
                            <Typography.Text type="secondary">
                              上传后填写交付说明并提交复核；此时客户看不到新视频。
                            </Typography.Text>
                            <Space wrap>
                              <Upload
                                accept=".mp4,.mov,.webm"
                                showUploadList={false}
                                disabled={busy}
                                beforeUpload={(f) => {
                                  if (
                                    !manualVideoMime(f.name, f.type) ||
                                    f.size <= 0
                                  ) {
                                    void message.error(
                                      "请选择有效的 MP4、MOV 或 WebM 视频",
                                    );
                                    return false;
                                  }
                                  setFile(f);
                                  ticket.current = null;
                                  completed.current = false;
                                  setUploadedID(null);
                                  setProgress(0);
                                  return false;
                                }}
                              >
                                <Button disabled={busy}>选择成片</Button>
                              </Upload>
                              {file && (
                                <span className="promo-text">
                                  {file.name} · {humanBytes(file.size)}
                                </span>
                              )}
                              <Button
                                disabled={!file || busy || !!uploadedID}
                                loading={upload.isPending}
                                onClick={() => upload.mutate()}
                              >
                                {upload.isError ? "重试上传" : "上传视频"}
                              </Button>
                            </Space>
                            {upload.isPending && (
                              <Progress
                                percent={progress}
                                aria-label="成片上传进度"
                              />
                            )}
                            {uploadedID && (
                              <Alert
                                type="success"
                                title="成片已上传，尚未提交复核"
                              />
                            )}
                          </Space>
                        </section>
                      )}
                      <section>
                        <Typography.Title level={5}>
                          候选成片与内部复核
                        </Typography.Title>
                        {o.candidate_material_id ? (
                          <>
                            <MediaList
                              materials={outputs.filter(
                                (m) => m.id === o.candidate_material_id,
                              )}
                            />
                            <div className="promo-text">
                              交付说明：{o.candidate_delivery_note}
                            </div>
                          </>
                        ) : (
                          <Typography.Text type="secondary">
                            尚无待复核成片
                          </Typography.Text>
                        )}
                        {canWrite && (
                          <Space wrap style={{ marginTop: 12 }}>
                            {caps.stage && outputs.length > 0 && (
                              <Button
                                disabled={busy}
                                onClick={() => openDialog("stage")}
                              >
                                选择成片并提交复核
                              </Button>
                            )}
                            {caps.review && (
                              <>
                                <Button
                                  type="primary"
                                  disabled={busy}
                                  loading={action.isPending}
                                  onClick={confirmDelivery}
                                >
                                  复核通过并交付
                                </Button>
                                <Button
                                  disabled={busy}
                                  onClick={() => openDialog("reject_review")}
                                >
                                  复核退回
                                </Button>
                              </>
                            )}
                          </Space>
                        )}
                      </section>
                      <section>
                        <Typography.Title level={5}>
                          已交付视频
                        </Typography.Title>
                        <MediaList
                          materials={outputs.filter(
                            (m) => m.id === o.delivered_material_id,
                          )}
                        />
                        {o.delivery_note && (
                          <div className="promo-text">{o.delivery_note}</div>
                        )}
                      </section>
                      {canWrite && caps.refund && (
                        <Button
                          danger
                          disabled={busy}
                          onClick={() => openDialog("refund")}
                        >
                          终止制作并退积分
                        </Button>
                      )}
                    </Space>
                  ),
                },
                {
                  key: "rework",
                  label:
                    o.rework_status === "requested"
                      ? "修改申请 · 待处理"
                      : "修改申请",
                  children: (
                    <Space
                      orientation="vertical"
                      size={16}
                      style={{ width: "100%" }}
                    >
                      <Alert
                        type="info"
                        title="首次交付后3个自然日内可申请1次免费修改"
                        description="受理后的返工承诺日严格按首次交付日＋2个自然日计算，晚受理可能立即逾期。"
                      />
                      <Descriptions
                        column={1}
                        items={[
                          {
                            key: "first",
                            label: "首次交付",
                            children: fmtTime(o.first_delivered_at),
                          },
                          {
                            key: "window",
                            label: "申请截止日",
                            children: promisedDate(o.rework_deadline),
                          },
                          {
                            key: "status",
                            label: "修改状态",
                            children:
                              (
                                {
                                  unused: "尚未申请",
                                  requested: "待受理",
                                  accepted: "已受理",
                                  rejected: "已婉拒",
                                  fulfilled: "返工已交付",
                                } as Record<string, string>
                              )[o.rework_status] ?? o.rework_status,
                          },
                          {
                            key: "text",
                            label: "客户意见原文",
                            children: (
                              <div className="promo-text">
                                {o.rework_text || "尚无修改申请"}
                              </div>
                            ),
                          },
                          {
                            key: "reply",
                            label: "处理回复",
                            children: (
                              <div className="promo-text">
                                {o.rework_reply || "—"}
                              </div>
                            ),
                          },
                        ]}
                      />
                      {canWrite && caps.rework && (
                        <Space wrap>
                          <Button
                            type="primary"
                            disabled={busy}
                            onClick={() => openDialog("accept_rework")}
                          >
                            受理免费返工
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => openDialog("reject_rework")}
                          >
                            婉拒修改申请
                          </Button>
                        </Space>
                      )}
                    </Space>
                  ),
                },
                {
                  key: "history",
                  label: "操作历史",
                  children: detail.data?.events?.length ? (
                    <Table
                      size="small"
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      dataSource={[...detail.data.events].reverse()}
                      scroll={{ x: 650 }}
                      columns={[
                        {
                          title: "时间",
                          dataIndex: "created_at",
                          width: 170,
                          render: fmtTime,
                        },
                        {
                          title: "操作人",
                          width: 100,
                          render: (_, e) =>
                            e.actor_admin_id
                              ? `后台 #${e.actor_admin_id}`
                              : e.actor_user_id
                                ? `客户 #${e.actor_user_id}`
                                : "系统",
                        },
                        {
                          title: "操作",
                          dataIndex: "kind",
                          width: 140,
                          render: (k) => promoEventLabels[k] ?? k,
                        },
                        {
                          title: "内容",
                          dataIndex: "content",
                          render: (c) => (
                            <div className="promo-text">
                              {promoEventContent(c)}
                            </div>
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <Empty description="暂无操作历史" />
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Drawer>
      <Modal
        title={dialog ? dialogTitles[dialog] : ""}
        open={dialog !== null}
        destroyOnHidden
        confirmLoading={action.isPending}
        okText={
          dialog === "refund"
            ? "确认终止并退回积分"
            : dialog === "stage"
              ? "提交复核"
              : "确认"
        }
        okButtonProps={{
          form: "promo-action-form",
          htmlType: "submit",
          danger: dialog === "refund",
          disabled: !canWrite || busy,
        }}
        onCancel={() => {
          if (!action.isPending) setDialog(null);
        }}
      >
        {dialog === "refund" && (
          <Alert
            type="warning"
            showIcon
            title={`全额退回 ${fmtCredits(o?.total_cost)} 积分，终止制作且不可撤销。`}
            style={{ marginBottom: 16 }}
          />
        )}
        {dialog === "accept_rework" && (
          <Alert
            type="warning"
            title="不重复扣费，承诺日按首次交付日＋2个自然日，不从受理日顺延。"
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          id="promo-action-form"
          key={dialog}
          initialValues={{
            text:
              dialog === "note"
                ? o?.assigned_note
                : dialog === "stage"
                  ? o?.candidate_delivery_note
                  : undefined,
            material_id: uploadedID ?? o?.candidate_material_id,
          }}
          layout="vertical"
          onFinish={(values) => {
            if (dialog && !busy && canWrite)
              action.mutate({
                action: dialog,
                ...values,
                text: values.text?.trim(),
              });
          }}
        >
          {dialog === "reschedule" && (
            <Form.Item
              label="新的承诺交付日（北京时间）"
              name="date"
              rules={[{ required: true, message: "请选择日期" }]}
            >
              <Input type="date" disabled={busy} />
            </Form.Item>
          )}
          {dialog === "stage" && (
            <Form.Item
              label="候选成片"
              name="material_id"
              rules={[{ required: true, message: "请选择已上传成片" }]}
            >
              <Select
                options={outputs.map((m) => ({
                  value: m.id,
                  label: `#${m.id} ${m.name}`,
                }))}
                disabled={busy}
              />
            </Form.Item>
          )}
          <Form.Item
            name="text"
            label={
              dialog === "note"
                ? "谁在做（内部备注）"
                : dialog === "stage"
                  ? "交付说明（交付后客户可见）"
                  : dialog === "accept_rework"
                    ? "受理说明"
                    : "处理原因"
            }
            rules={[
              {
                required: dialog !== "note" && dialog !== "accept_rework",
                whitespace: true,
                message: "请填写说明或原因",
              },
              { max: dialog === "stage" || dialog === "note" ? 3000 : 300 },
            ]}
          >
            <Input.TextArea
              rows={4}
              showCount
              maxLength={dialog === "stage" || dialog === "note" ? 3000 : 300}
              disabled={busy}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
function MediaList({ materials }: { materials: PromoMaterial[] }) {
  return !materials.length ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无站内素材" />
  ) : (
    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
      {materials.map((m) => (
        <MediaItem key={m.id} material={m} />
      ))}
    </Space>
  );
}
function MediaItem({ material: m }: { material: PromoMaterial }) {
  const [open, setOpen] = useState(false);
  const media = useQuery({
    queryKey: ["promo-media", m.id],
    queryFn: () => getPromoDownload(m.id),
    enabled: open && m.status === "active",
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  return (
    <div className="promo-material">
      <Space wrap>
        <span className="promo-text">{m.name}</span>
        <Typography.Text type="secondary">
          {humanBytes(m.size_bytes)} ·{" "}
          {(
            {
              footage: "实拍素材",
              logo: "LOGO",
              supplement: "补充素材",
              deliverable: "成片",
            } as Record<string, string>
          )[m.role] ?? m.role}
        </Typography.Text>
        {m.status === "active" ? (
          <Button
            size="small"
            loading={media.isFetching}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "收起" : "预览 / 下载"}
          </Button>
        ) : (
          <Tag>{m.status === "pending" ? "上传未完成" : m.status}</Tag>
        )}
      </Space>
      {open && media.error && (
        <Alert
          type="error"
          title="获取素材失败"
          description={media.error.message}
          action={<Button onClick={() => void media.refetch()}>重试</Button>}
        />
      )}
      {open && media.data && (
        <Space orientation="vertical" style={{ width: "100%", marginTop: 8 }}>
          {m.mime_type.startsWith("video/") ? (
            <video
              controls
              preload="metadata"
              src={media.data.download_url}
              style={{ width: "100%", maxHeight: 360, background: "#111" }}
            />
          ) : m.mime_type.startsWith("image/") ? (
            <img
              alt={m.name}
              src={media.data.download_url}
              style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }}
            />
          ) : m.mime_type.startsWith("audio/") ? (
            <audio controls src={media.data.download_url} />
          ) : null}
          <a
            href={media.data.download_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            下载 {m.name}
          </a>
          <Button type="link" size="small" onClick={() => void media.refetch()}>
            刷新下载链接
          </Button>
        </Space>
      )}
    </div>
  );
}
