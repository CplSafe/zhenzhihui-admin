import { Alert, App, Button, Descriptions, Space, Tag } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncExchangeRate } from '@/api/exchangeRate';
import { Can } from '@/components/Can';
import { Permission } from '@/types/admin';
import { fmtTime } from '@/utils/format';

import { exchangeRateQueryKey, useExchangeRate } from "@/hooks/useExchangeRate";

export function ExchangeRatePanel() {
  const q = useExchangeRate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const sync = useMutation({ mutationFn: syncExchangeRate, onSuccess: () => { message.success('已检查汇率同步状态'); },
    onError: (e: Error) => { message.error(e.message); },
    onSettled: () => { qc.invalidateQueries({ queryKey: exchangeRateQueryKey }); } });
  const rate = q.data;
  const state = rate?.status;
  return <div style={{ marginBottom: 16 }}>
    <Alert type={q.isError || (rate && !rate.usable) ? 'error' : state === 'degraded' ? 'warning' : 'info'} showIcon
      title={<Space wrap>统一积分与汇率 <Tag>{({ ready: '同步正常', degraded: '同步异常 · 沿用有效值', expired: '汇率已过期', unavailable: '暂无有效汇率', pending: '等待首次同步' })[state ?? 'pending']}</Tag></Space>}
      description={<>
        <p>1 积分 = ¥0.02。美元成本共用每日参考汇率，每小时检查更新；任务提交时锁定计价快照。</p>
        {q.isError ? <p>汇率状态读取失败：{q.error.message}</p> : <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }} items={[
          { key: 'rate', label: 'USD → CNY', children: rate?.rate_ppm ? (rate.rate_ppm / 1_000_000).toFixed(6) : '未获取' },
          { key: 'date', label: '汇率日期', children: rate?.rate_date || '—' },
          { key: 'source', label: '来源', children: rate?.source || 'CFETS via Frankfurter' },
          { key: 'success', label: '最近同步成功', children: rate?.last_success_at ? fmtTime(rate.last_success_at) : '—' },
        ]} />}
        {rate?.last_error && <p>{rate.last_error}</p>}
        {rate && !rate.usable && <p>美元模型的新请求暂停；已有任务仍按原快照结算。</p>}
        <Space wrap>
          <Button size="small" loading={q.isFetching} onClick={() => q.refetch()}>刷新状态</Button>
          <Can permission={Permission.SETTINGS_WRITE}><Button size="small" loading={sync.isPending} onClick={() => sync.mutate()}>立即同步</Button></Can>
          <span>手动同步间隔至少 1 分钟。节假日可能沿用上一工作日汇率。</span>
        </Space>
      </>} />
  </div>;
}
