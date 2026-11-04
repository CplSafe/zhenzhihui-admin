import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Descriptions, Drawer, Empty, Form, Input, Modal, Progress, Select, Space, Spin, Tag, Typography, Upload } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliverManualVideo, getManualMedia, getManualVideo, listManualVideos, uploadManualVideo } from '@/api/manualVideos';
import type { ManualVideoDelivery, ManualVideoFilter } from '@/api/manualVideos';
import { ListPageShell } from '@/components/ListPageShell';
import { Credits } from '@/components/cells';
import { usePagedList } from '@/hooks/usePagedList';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/types/admin';
import type { AITask } from '@/types/domain';
import type { ApiError } from '@/types/api';
import { fmtCredits, fmtTime, humanBytes } from '@/utils/format';
import { isManualVideoActive, manualRequest, manualResult, manualVideoMime, manualVideoStates } from '@/utils/manualVideo';

function ProductionStatus({ status }: { status: string }) {
  const state = manualVideoStates.find(s => s.value === status);
  return <Tag color={state?.color}>{state?.label ?? status}</Tag>;
}

export function ManualVideosPage() {
  const [filters, setFilters] = useState<ManualVideoFilter>({ status: 'awaiting_manual' });
  const [activeID, setActiveID] = useState<number | null>(null);
  const list = usePagedList<AITask, ManualVideoFilter>({ queryKey: 'manual-video-list', filters, fetcher: listManualVideos });
  const columns: TableColumnsType<AITask> = [
    { title: '任务', dataIndex: 'id', width: 95, render: id => `#${id}` },
    { title: '制作需求', dataIndex: 'prompt', ellipsis: true, render: prompt => prompt || '查看详情了解需求' },
    { title: '工作空间', dataIndex: 'workspace_id', width: 110 },
    { title: '状态', dataIndex: 'status', width: 115, render: status => <ProductionStatus status={status} /> },
    { title: '预扣积分', dataIndex: 'estimated_cost', width: 115, align: 'right', render: value => <Credits value={value} /> },
    { title: '实扣积分', dataIndex: 'actual_cost', width: 115, align: 'right', render: value => <Credits value={value} /> },
    { title: '提交时间', dataIndex: 'created_at', width: 175, render: fmtTime },
    { title: '操作', width: 100, fixed: 'right', render: (_, task) => <Button type="link" onClick={() => setActiveID(task.id)}>查看任务</Button> },
  ];
  return <>
    <ListPageShell<AITask> title="人工视频制作" titleLevel={1} filters={<Space wrap>
      <Select aria-label="制作状态" value={filters.status} placeholder="全部状态" allowClear style={{ width: 160 }} options={manualVideoStates} onChange={status => setFilters({ status })} />
      <Button loading={list.loading} onClick={() => void list.refetch()}>刷新任务</Button>
      <Typography.Text type="secondary">失败或取消会全额退还本次积分，已结束任务不能覆盖结果。</Typography.Text>
    </Space>} columns={columns} dataSource={list.items} rowKey="id" loading={list.loading} error={list.error} pagination={list.pagination} />
    {activeID !== null && <ManualVideoDrawer key={activeID} taskID={activeID} onClose={() => setActiveID(null)} onNavigate={setActiveID} />}
  </>;
}

function ManualVideoDrawer({ taskID, onClose, onNavigate }: { taskID: number; onClose: () => void; onNavigate: (id: number) => void }) {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const { has } = usePermission();
  const canWrite = has(Permission.MANUAL_VIDEO_WRITE);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedID, setUploadedID] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [closingState, setClosingState] = useState<'failed' | 'cancelled' | null>(null);
  const [form] = Form.useForm<{ reason: string }>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const detail = useQuery({ queryKey: ['manual-video-detail', taskID], queryFn: () => getManualVideo(taskID), refetchInterval: query => isManualVideoActive(query.state.data?.task.status ?? '') ? 15000 : false });
  const task = detail.data?.task;
  const order = detail.data?.order;
  const active = task && isManualVideoActive(task.status);
  const failure = (error: Error) => { void message.error(error.message); };
  const deliver = useMutation({
    mutationFn: (body: ManualVideoDelivery) => deliverManualVideo(taskID, body),
    onSuccess: (_, body) => {
      void message.success(body.status === 'succeeded' ? '视频已交付' : body.status === 'manual_processing' ? '已开始制作' : '任务已结束，本次积分已全额退还');
      setClosingState(null);
      setFile(null);
      setUploadedID(null);
      void qc.invalidateQueries({ queryKey: ['manual-video-detail', taskID] });
      void qc.invalidateQueries({ queryKey: ['manual-video-list'] });
    },
    onError: (error: ApiError) => { failure(error); void detail.refetch(); },
  });
  const upload = useMutation({
    mutationFn: async (selected: File) => {
      controller.current = new AbortController();
      setProgress(0);
      return uploadManualVideo(taskID, selected, setProgress, controller.current.signal);
    },
    onSuccess: id => { setUploadedID(id); void message.success('上传完成，请确认交付'); },
    onError: failure,
  });
  const busy = upload.isPending || deliver.isPending;
  const request = manualRequest(task?.request_json);
  const result = manualResult(task?.result_json);
  const close = () => { if (busy) { void message.info('请等待当前上传或处理完成'); return; } onClose(); };
  const navigate = (id: number) => { if (!busy) onNavigate(id); };
  const confirmDelivery = () => {
    if (!uploadedID || !active || !canWrite || busy) return;
    modal.confirm({ title: '确认交付这份视频？', content: `成片将提供给客户，本次按原报价结算 ${fmtCredits(task.estimated_cost)} 积分。交付后不能覆盖结果。`, okText: '确认交付', cancelText: '再检查一下', onOk: () => deliver.mutateAsync({ status: 'succeeded', asset_id: uploadedID }) });
  };
  return <>
    <Drawer title={`人工视频任务 #${taskID}`} open onClose={close} width="min(760px, 100vw)" destroyOnHidden extra={<Button disabled={busy} loading={detail.isFetching} onClick={() => void detail.refetch()}>刷新详情</Button>}>
      {detail.isPending && <Spin aria-label="加载任务" />}
      {detail.error && <Alert type="error" showIcon title="任务加载失败" description={detail.error.message} action={<Button onClick={() => void detail.refetch()}>重试</Button>} />}
      {task && order && <Space orientation="vertical" size={24} style={{ width: '100%' }}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small" items={[
          { key: 'status', label: '制作状态', children: <ProductionStatus status={task.status} /> },
          { key: 'workspace', label: '工作空间 / 客户', children: `${task.workspace_id} / ${task.user_id}` },
          { key: 'cost', label: '预扣 / 实扣积分', children: <><Credits value={task.estimated_cost} /> / <Credits value={task.actual_cost} /></> },
          { key: 'time', label: '提交时间', children: fmtTime(task.created_at) },
          { key: 'duration', label: '视频规格', children: [request.duration ? `${request.duration} 秒` : null, request.resolution, request.ratio].filter(Boolean).join(' · ') || '未指定' },
          { key: 'operator', label: '最近操作账号', children: order.operator_admin_id ? `#${order.operator_admin_id}` : '尚未处理' },
        ]} />
        {!!order.parent_task_id && <Alert type="info" showIcon title="这是一次付费修改" description={<Space wrap><Button type="link" disabled={busy} onClick={() => navigate(order.root_task_id)}>查看原始任务 #{order.root_task_id}</Button>{order.parent_task_id !== order.root_task_id && <Button type="link" disabled={busy} onClick={() => navigate(order.parent_task_id!)}>查看上一版 #{order.parent_task_id}</Button>}</Space>} />}
        <section aria-label="制作需求"><Typography.Title level={5}>制作需求</Typography.Title><Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 0 }}>{task.prompt || '未填写需求'}</Typography.Paragraph></section>
        <section aria-label="客户参考素材"><Typography.Title level={5}>客户参考素材</Typography.Title>
          {request.input_assets.length ? <Space orientation="vertical" style={{ width: '100%' }}>{request.input_assets.map((ref, index) => <ManualMediaPreview key={`${ref.asset_id}-${index}`} taskID={taskID} assetID={ref.asset_id} label={`${({ image: '参考图片', video: '参考视频', audio: '参考音频' } as Record<string, string>)[ref.role ?? ''] ?? '参考素材'} #${ref.asset_id}`} />)}</Space> : <Typography.Text type="secondary">客户未提交参考素材</Typography.Text>}
        </section>
        {task.status === 'succeeded' && <section aria-label="已交付视频"><Typography.Title level={5}>已交付视频</Typography.Title>{result.assetID ? <ManualMediaPreview taskID={taskID} assetID={result.assetID} label="查看交付成片" /> : result.url ? <video controls preload="metadata" src={result.url} style={{ width: '100%', maxHeight: 320, background: '#111' }} /> : <Empty description="暂无可预览视频" />}</section>}
        {(task.status === 'failed' || task.status === 'cancelled') && <Alert type="warning" showIcon title={`${task.status === 'failed' ? '制作失败' : '任务已取消'} · 本次积分已全额退还`} description={task.error_message || '未填写说明'} />}
        {canWrite && active && <section aria-label="处理任务">
          <Typography.Title level={5}>处理任务</Typography.Title>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {task.status === 'awaiting_manual' && <Button disabled={busy} loading={deliver.isPending} onClick={() => deliver.mutate({ status: 'manual_processing' })}>开始制作</Button>}
            <Typography.Text type="secondary">选择 MP4、MOV 或 WebM 成片，上传后确认交付给客户。</Typography.Text>
            <Space wrap>
              <Upload accept=".mp4,.mov,.webm" showUploadList={false} disabled={busy} beforeUpload={selected => { if (!manualVideoMime(selected.name, selected.type) || selected.size <= 0) { void message.error('请选择有效的 MP4、MOV 或 WebM 视频'); return false; } setFile(selected); setUploadedID(null); setProgress(0); return false; }}><Button disabled={busy}>{file ? '重新选择' : '选择视频'}</Button></Upload>
              {file && <Typography.Text style={{ overflowWrap: 'anywhere', maxWidth: '100%' }}>{file.name} · {humanBytes(file.size)}</Typography.Text>}
            </Space>
            {upload.isPending && <Progress percent={progress} status="active" aria-label="视频上传进度" />}
            {uploadedID && <Alert type="success" showIcon title="视频已上传，尚未交付" description="确认交付后客户才能看到结果。若提交失败，可直接重试，无需重新上传。" />}
            <Space wrap><Button disabled={!file || busy || !!uploadedID} loading={upload.isPending} onClick={() => { if (file) upload.mutate(file); }}>上传视频</Button><Button type="primary" disabled={!uploadedID || busy} loading={deliver.isPending} onClick={confirmDelivery}>确认交付</Button></Space>
            <Space wrap><Button danger disabled={busy} onClick={() => { form.resetFields(); setClosingState('failed'); }}>标记失败</Button><Button danger disabled={busy} onClick={() => { form.resetFields(); setClosingState('cancelled'); }}>取消任务</Button><Typography.Text type="secondary">这两项操作都会全额退还本次积分。</Typography.Text></Space>
          </Space>
        </section>}
        {!canWrite && active && <Alert type="info" showIcon title="当前账号仅可查看任务" description="如需上传交付或处理失败，请联系超级管理员分配人工视频制作操作权限。" />}
      </Space>}
    </Drawer>
    <Modal title={closingState === 'failed' ? '标记制作失败' : '取消人工视频任务'} open={closingState !== null} onCancel={() => { if (!deliver.isPending) setClosingState(null); }} onOk={() => form.submit()} okText="结束任务并退款" okButtonProps={{ danger: true }} cancelText="返回任务" confirmLoading={deliver.isPending} destroyOnHidden>
      <Alert type="warning" showIcon title={`将全额退还 ${fmtCredits(task?.estimated_cost)} 积分，此操作不能撤销。`} style={{ marginBottom: 16 }} />
      <Form form={form} layout="vertical" onFinish={values => { if (closingState && !deliver.isPending) deliver.mutate({ status: closingState, message: values.reason.trim() }); }}>
        <Form.Item name="reason" label="原因（客户可见）" rules={[{ required: true, whitespace: true, message: '请填写原因' }, { max: 250 }]}><Input.TextArea rows={3} maxLength={250} showCount disabled={deliver.isPending} placeholder="说明无法交付或取消的原因" /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function ManualMediaPreview({ taskID, assetID, label }: { taskID: number; assetID: number; label: string }) {
  const [open, setOpen] = useState(false);
  const media = useQuery({ queryKey: ['manual-video-media', taskID, assetID], queryFn: () => getManualMedia(taskID, assetID), enabled: open, staleTime: 5 * 60 * 1000 });
  return <Space orientation="vertical" size={8} style={{ width: '100%' }}>
    <Space wrap><Typography.Text>{label}</Typography.Text><Button size="small" loading={media.isFetching} onClick={() => setOpen(!open)}>{open ? '收起预览' : '预览素材'}</Button></Space>
    {open && media.error && <Alert type="error" title="素材预览失败" description={media.error.message} action={<Button size="small" onClick={() => void media.refetch()}>重试</Button>} />}
    {open && media.data && <>
      <Typography.Text type="secondary">{media.data.name}</Typography.Text>
      {media.data.type === 'image' ? <img src={media.data.download_url} alt={media.data.name} style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }} /> : media.data.type === 'video' ? <video controls preload="metadata" src={media.data.download_url} style={{ width: '100%', maxHeight: 320, background: '#111' }} /> : media.data.type === 'audio' ? <audio controls preload="metadata" src={media.data.download_url} style={{ width: '100%' }} /> : null}
      <Typography.Link href={media.data.download_url} target="_blank" rel="noopener noreferrer">在新窗口打开或下载</Typography.Link>
    </>}
  </Space>;
}
