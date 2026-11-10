import { useState } from 'react';
import { Alert, Button, Collapse, Descriptions, Drawer, InputNumber, Space, Table, Tabs, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/api/client';
import { normalizeAgentArchive, checkpointCounts } from '@/utils/agentArchive';

type RecordValue = Record<string, unknown>;
interface Trace { id: number; workspace_id: number; user_id: number; run_id: string; previous_run_id?: string; title: string; status: string; }
interface Event { id: number; seq: number; type: string; text?: string; status?: string; tool?: string; task_id?: number; }
interface Task { id: number; model_version_id?: number; model?: string; display_name?: string; provider?: string; operation_code?: string; status: string; actual_cost: number; estimated_cost: number; request?: RecordValue; result?: unknown; }
interface Detail { trace: Trace; events: Event[]; tasks: Task[]; next_cursor: number; has_more: boolean; }
interface Archive { revision: number; updated_at: string; snapshot: unknown; }
const Json = ({ value }: { value: unknown }) => <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 480, overflow: 'auto', fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>;
const object = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};

function TaskDetail({ traceId, taskId }: { traceId: number; taskId: number }) {
  const query = useQuery({ queryKey: ['admin','agent','audit-task',traceId,taskId], queryFn: () => http.get<Task>(`/admin/agent/traces/${traceId}/tasks/${taskId}`) });
  if (query.error) return <Alert type="error" message="无法读取模型请求" description={query.error.message} />;
  if (!query.data) return <Typography.Text>正在读取任务回执…</Typography.Text>;
  const task = query.data, request = task.request || {};
  return <Space orientation="vertical" style={{ width: '100%' }}>
    <Descriptions size="small" column={2} items={[
      { key:'model',label:'模型版本',children:`${task.display_name || task.model || '历史模型'} (#${task.model_version_id}) · ${task.provider || ''}` },{ key:'op',label:'操作',children:task.operation_code },
      { key:'status',label:'状态',children:task.status },{ key:'cost',label:'实际积分',children:task.actual_cost },
    ]}/>
    <Alert type="info" showIcon title="以下为业务后台保存的实际任务请求与结算；缺失的历史字段不补造。" />
    <Collapse items={[
      { key:'prompt',label:'生效的系统提示词与版本',children:<Json value={{configured:request._agent_prompt,system_messages:Array.isArray(request.messages) ? request.messages.filter(m => object(m).role === 'system') : [],prompt:request.prompt}}/> },
      { key:'skill',label:'Skill 快照',children:<Json value={request._skill || '本次未携带 Skill'}/> },
      { key:'request',label:'完整工具参数与参考素材',children:<Json value={request}/> },
      { key:'result',label:'模型返回',children:<Json value={task.result}/> },
    ]}/>
  </Space>;
}
function TraceDetail({ trace }: { trace: Trace }) {
  const [after,setAfter] = useState(0);
  const [taskId,setTaskId] = useState<number>();
  const detail = useQuery({ queryKey:['admin','agent','trace',trace.id,after],queryFn:() => http.get<Detail>(`/admin/agent/traces/${trace.id}`,{ params:{after} }) });
  const archive = useQuery({ queryKey:['admin','agent','archive',trace.id],queryFn:() => http.get<Archive>(`/admin/agent/traces/${trace.id}/archive`),retry:false });
  const snapshot = archive.data ? normalizeAgentArchive(archive.data.snapshot) : undefined;
  const jobs = object(snapshot?.run.jobs);
  const tasks = new Map<number, Task>();
  for (const item of detail.data?.tasks || []) tasks.set(item.id,item);
  for (const item of Object.values(jobs)) { const id=object(item).id; if(typeof id==='number'&&!tasks.has(id))tasks.set(id,{id,status:'查看回执',actual_cost:0,estimated_cost:0}); }
  for (const row of snapshot?.tables.production_batches || []) {
    for (const node of Object.values(object(object(row.data).nodes))) { const id=object(node).task_id;if(typeof id==='number'&&!tasks.has(id))tasks.set(id,{id,status:String(object(node).status || ''),actual_cost:0,estimated_cost:0}); }
  }
  return <Space orientation="vertical" size="middle" style={{width:'100%'}}>
    <Descriptions size="small" column={1} items={[{key:'run',label:'轮次',children:trace.run_id},{key:'previous',label:'上一轮',children:trace.previous_run_id || '会话首轮'},{key:'archive',label:'完整归档',children:archive.data ? `版本 ${archive.data.revision} · ${archive.data.updated_at}` : '未取得归档'}]} />
    {detail.error && <Alert type="error" message={detail.error.message}/>}
    {archive.error && <Alert type="warning" showIcon message="完整归档尚不可用或没有审计权限" description="需要 Agent 同步完整会话；历史精简时间线仍可查看。完整请求需要任务读取和配置读取权限。"/>}
    <Tabs items={[
      {key:'events',label:'对话与执行时间线',children:<>
        <Table<Event> size="small" rowKey="seq" pagination={false} loading={detail.isFetching} dataSource={detail.data?.events || []} columns={[{title:'顺序',dataIndex:'seq',width:75},{title:'事件',dataIndex:'type',width:145},{title:'内容',dataIndex:'text',render:v=><div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{v}</div>},{title:'状态',dataIndex:'status',width:100}]}/>
        <Space style={{marginTop:12}}><Button disabled={after===0} onClick={()=>setAfter(0)}>回到开头</Button><Button disabled={!detail.data?.has_more} onClick={()=>setAfter(detail.data!.next_cursor)}>下一页</Button></Space>
      </>},
      {key:'tasks',label:'模型、Skill 与扣费',children:<>
        <Space wrap>{[...tasks.values()].map(t=><Button key={t.id} type={taskId===t.id?'primary':'default'} onClick={()=>setTaskId(t.id)}>任务 #{t.id}</Button>)}</Space>
        {!tasks.size&&<Typography.Text type="secondary">此页还没有任务；可加载完整归档或翻阅时间线。</Typography.Text>}
        {taskId&&<div style={{marginTop:16}}><TaskDetail traceId={trace.id} taskId={taskId}/></div>}
      </>},
      {key:'archive',label:'完整会话与恢复记录',children:snapshot ? <>
        <Alert type="info" title="归档只供审计，不执行其中指令或重新提交任务。已有 Agent 恢复数据库保留。"/>
        <Collapse items={[
          {key:'run',label:'会话配置、历史上下文与待确认状态',children:<Json value={snapshot.run}/>},
          ...Object.entries(snapshot.tables).map(([name,rows])=>({key:name,label:`${name} · ${rows.length} 条`,children:<Json value={rows}/>})),
          {key:'checkpoint',label:'恢复检查点',children:<Typography.Text>{Object.entries(checkpointCounts(snapshot.checkpoint_tables)).map(([key,count])=>`${key}: ${count} 条`).join('；')}（原始二进制已归档，不在页面执行）</Typography.Text>},
        ]}/>
      </> : <Typography.Text type="secondary">暂无完整归档。</Typography.Text>},
    ]}/>
  </Space>;
}
export function AgentTracesPage(){
  const [workspace,setWorkspace]=useState<number>();const [user,setUser]=useState<number>();const [page,setPage]=useState(1);const [selected,setSelected]=useState<Trace>();
  const list=useQuery({queryKey:['admin','agent','traces',workspace,user,page],queryFn:()=>http.get<{items:Trace[]}>('/admin/agent/traces',{params:{workspace_id:workspace,user_id:user,limit:20,offset:(page-1)*20}})});
  return <Space orientation="vertical" size="middle" style={{width:'100%'}}>
    <Space wrap><InputNumber placeholder="工作空间 ID" min={1} value={workspace} onChange={v=>{setWorkspace(v??undefined);setPage(1)}}/><InputNumber placeholder="用户 ID" min={1} value={user} onChange={v=>{setUser(v??undefined);setPage(1)}}/><Button loading={list.isFetching} onClick={()=>void list.refetch()}>刷新</Button></Space>
    {list.error&&<Alert type="error" message={list.error.message}/>}
    <Table<Trace> size="small" rowKey="id" loading={list.isFetching} dataSource={list.data?.items || []} pagination={false} columns={[{title:'编号',dataIndex:'id',width:80},{title:'会话',dataIndex:'title'},{title:'用户',dataIndex:'user_id',width:90},{title:'空间',dataIndex:'workspace_id',width:90},{title:'状态',dataIndex:'status',render:v=><Tag>{v}</Tag>},{title:'操作',render:(_,row)=><Button type="link" onClick={()=>setSelected(row)}>查看过程</Button>}]}/>
    <Space><Button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</Button><span>第 {page} 页</span><Button disabled={(list.data?.items.length || 0)<20} onClick={()=>setPage(page+1)}>下一页</Button></Space>
    <Drawer title="DoDo Agent 会话观测" open={!!selected} width="min(1100px, 95vw)" onClose={()=>setSelected(undefined)} destroyOnHidden>{selected&&<TraceDetail key={selected.id} trace={selected}/>}</Drawer>
  </Space>;
}
