import { useState } from 'react';
import { Alert, App, Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography, Upload } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/types/admin';
import { deleteTemplate, deleteTemplateCategory, getTemplateOSS, listTemplateCategories, listTemplates, saveTemplate, saveTemplateCategory, saveTemplateOSS, uploadTemplateFile } from '@/api/templates';
import type { LibraryTemplate, TemplateBody, TemplateCategory, OSSBody } from '@/api/templates';

const urlRules = [{ type: 'url' as const, message: '请输入完整 HTTPS 地址' }, { pattern: /^https:\/\//, message: '请使用 HTTPS 地址' }];
export function TemplatesPage() {
 const { message } = App.useApp(); const qc = useQueryClient(); const { has } = usePermission();
 const canWrite = has(Permission.TEMPLATES_WRITE);
 const [category, setCategory] = useState<number>(); const [enabled, setEnabled] = useState<string>();
 const [cursors, setCursors] = useState<string[]>(['']); const cursor = cursors.at(-1)!;
 const [editing, setEditing] = useState<LibraryTemplate | null | undefined>();
 const [catEdit, setCatEdit] = useState<TemplateCategory | null | undefined>();
 const [uploading, setUploading] = useState<string>();
 const [form] = Form.useForm<TemplateBody>(); const [catForm] = Form.useForm<{name: string; position: number}>();
 const [ossForm] = Form.useForm<OSSBody>();
 const categories = useQuery({ queryKey: ['template-categories'], queryFn: listTemplateCategories });
 const page = useQuery({ queryKey: ['templates', category, enabled, cursor], queryFn: () => listTemplates(category, enabled, cursor) });
 const oss = useQuery({ queryKey: ['template-oss'], queryFn: getTemplateOSS, enabled: has(Permission.SETTINGS_READ) });
 const failure = (e: Error) => { void message.error(e.message); };
 const refresh = () => { setCursors(['']); void qc.invalidateQueries({ queryKey: ['templates'] }); void qc.invalidateQueries({ queryKey: ['template-categories'] }); };
 const save = useMutation({ mutationFn: (v: TemplateBody) => saveTemplate(v, editing?.id), onSuccess: () => { setEditing(undefined); refresh(); void message.success('模板已保存'); }, onError: failure });
 const remove = useMutation({ mutationFn: deleteTemplate, onSuccess: refresh, onError: failure });
 const saveCat = useMutation({ mutationFn: (v: {name: string;position: number}) => saveTemplateCategory(v, catEdit?.id), onSuccess: () => { setCatEdit(undefined); refresh(); }, onError: failure });
 const removeCat = useMutation({ mutationFn: deleteTemplateCategory, onSuccess: () => { setCategory(undefined); refresh(); }, onError: failure });
 const saveOSS = useMutation({ mutationFn: (v: OSSBody) => saveTemplateOSS({...v, access_key_id: v.access_key_id?.trim() || undefined, access_key_secret: v.access_key_secret?.trim() || undefined }), onSuccess: () => { ossForm.resetFields(['access_key_id','access_key_secret']); void qc.invalidateQueries({queryKey: ['template-oss']}); void message.success('OSS 配置已保存'); }, onError: failure });
 const openTemplate = (row: LibraryTemplate | null) => { form.resetFields(); form.setFieldsValue(row ?? { enabled: true, media_type: 'video', category_id: category }); setEditing(row); };
 const openCategory = (row: TemplateCategory | null) => { catForm.resetFields(); catForm.setFieldsValue(row ?? { position: 0 }); setCatEdit(row); };
 const upload = async (file: File, field: 'media_url'|'cover_url') => {
  const allowed = field === 'cover_url' ? ['image/jpeg','image/png','image/webp'] : ['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
  if (!allowed.includes(file.type) || file.size > (file.type.startsWith('image/') ? 10 : 500)*1024*1024 || file.size === 0) { void message.error('请选择支持的图片（≤10MB）或视频（≤500MB）'); return; }
  setUploading(field);
  try { const url = await uploadTemplateFile(file); form.setFieldValue(field, url); if (field === 'media_url') form.setFieldValue('media_type', file.type.startsWith('video/') ? 'video' : 'image'); void message.success('上传完成'); } catch (e) { failure(e instanceof Error ? e : new Error('上传失败')); } finally { setUploading(undefined); }
 };
 const list = <Space orientation="vertical" size="middle" style={{width:'100%'}}>
  <Space wrap>{[ {id: undefined, name:'全部'}, ...(categories.data ?? []) ].map(c => <Button key={c.id ?? 'all'} shape="round" type={category === c.id ? 'primary' : 'default'} onClick={() => {setCategory(c.id);setCursors(['']);}}>{c.name}</Button>)}</Space>
  <Space wrap><Select aria-label="模板状态" placeholder="全部状态" allowClear value={enabled} style={{width:140}} options={[{value:'true',label:'已上架'},{value:'false',label:'已下架'}]} onChange={v=>{setEnabled(v);setCursors(['']);}}/><Button onClick={refresh} loading={page.isFetching}>刷新</Button>{canWrite && <Button type="primary" onClick={()=>openTemplate(null)}>新增模板</Button>}</Space>
  {page.error && <Alert type="error" title={page.error.message} action={<Button onClick={()=>void page.refetch()}>重试</Button>}/>}
  <Table<LibraryTemplate> rowKey="id" loading={page.isFetching} dataSource={page.data?.items ?? []} pagination={false} scroll={{x:850}} locale={{emptyText:<Empty description="暂无模板，请新增模板或切换分类"/>}} columns={[
   {title:'模板',dataIndex:'title',render:(v:string,r)=> <Space>{r.cover_url && <img src={r.cover_url} alt="" loading="lazy" style={{width:64,height:44,objectFit:'cover',borderRadius:6}}/>}<Typography.Text>{v}</Typography.Text></Space>},
   {title:'分类',dataIndex:'category_id',render:(id:number)=>categories.data?.find(c=>c.id===id)?.name ?? id},
   {title:'类型',dataIndex:'media_type',render:(v:string)=>v==='video'?'视频':'图片'},
   {title:'状态',dataIndex:'enabled',render:(v:boolean)=><Tag color={v?'success':'default'}>{v?'已上架':'已下架'}</Tag>},
   {title:'操作',render:(_,r)=><Space><Button type="link" href={r.media_url} target="_blank" rel="noopener noreferrer">预览</Button>{canWrite && <><Button type="link" onClick={()=>openTemplate(r)}>编辑</Button><Popconfirm title="删除此模板？OSS 文件将保留。" onConfirm={()=>remove.mutateAsync(r.id)}><Button type="link" danger loading={remove.isPending}>删除</Button></Popconfirm></>}</Space>}
  ]}/>
  <Space><Button disabled={cursors.length===1 || page.isFetching} onClick={()=>setCursors(cursors.slice(0,-1))}>上一页</Button><Typography.Text type="secondary">第 {cursors.length} 页 · 每页 20 条</Typography.Text><Button disabled={!page.data?.has_more || page.isFetching || page.isError} onClick={()=>setCursors([...cursors,page.data!.next_cursor])}>下一页</Button></Space>
 </Space>;
 return <Space orientation="vertical" size="large" style={{width:'100%'}}>
  <Typography.Title level={4} style={{margin:0}}>模板库</Typography.Title>
  {categories.error && <Alert type="error" title={categories.error.message} action={<Button onClick={()=>void categories.refetch()}>重试分类</Button>}/>}
  <Tabs items={[
   {key:'templates',label:'模板管理',children:list},
   {key:'categories',label:'分类管理',children:<Space orientation="vertical" style={{width:'100%'}}>{canWrite && <Button type="primary" onClick={()=>openCategory(null)}>新增分类</Button>}<Table<TemplateCategory> loading={categories.isFetching} dataSource={categories.data} rowKey="id" pagination={false} columns={[{title:'分类名称',dataIndex:'name'},{title:'排序',dataIndex:'position'},{title:'操作',render:(_,r)=>canWrite && <Space><Button onClick={()=>openCategory(r)}>编辑</Button><Popconfirm title="删除分类？请先移走分类下的模板。" onConfirm={()=>removeCat.mutateAsync(r.id)}><Button danger loading={removeCat.isPending}>删除</Button></Popconfirm></Space>}]}/></Space>},
   ...(has(Permission.SETTINGS_READ) ? [{key:'oss',label:'OSS 配置',children:<Space orientation="vertical" style={{width:'100%',maxWidth:700}}>
    <Alert type="info" showIcon title={oss.data?.credentials_set ? '已配置独立 OSS 存储' : '请配置模板库专用 OSS'} description="视频上限 500MB，图片上限 10MB。桶需允许当前后台域名跨域 POST；公开访问地址需能读取上传的文件。建议使用仅允许 templates/ 路径写入的 RAM 凭据。更换存储配置不会迁移已有文件。"/>
    {oss.error && <Alert type="error" title={oss.error.message}/>}
    <Button onClick={()=>{if(oss.data)ossForm.setFieldsValue({...oss.data,access_key_id:'',access_key_secret:''});}} disabled={!oss.data}>载入当前配置</Button>
    <Form form={ossForm} initialValues={oss.data} layout="vertical" onFinish={v=>saveOSS.mutate(v)} disabled={!canWrite || !has(Permission.SETTINGS_WRITE) || oss.isFetching || saveOSS.isPending}>
     <Form.Item name="endpoint" label="OSS Endpoint" rules={[{required:true}]} extra={oss.data?.endpoint}><Input placeholder="oss-cn-hangzhou.aliyuncs.com"/></Form.Item>
     <Form.Item name="bucket" label="Bucket" rules={[{required:true}]} extra={oss.data?.bucket}><Input/></Form.Item>
     <Form.Item name="public_base_url" label="公开访问地址 / CDN 地址" rules={[{required:true},...urlRules]} extra={oss.data?.public_base_url}><Input placeholder="https://your-bucket.oss-cn-hangzhou.aliyuncs.com"/></Form.Item>
     <Form.Item name="access_key_id" label="AccessKey ID" extra="留空保留现有凭据，首次配置必填"><Input.Password autoComplete="off"/></Form.Item>
     <Form.Item name="access_key_secret" label="AccessKey Secret"><Input.Password autoComplete="new-password"/></Form.Item>
     <Button type="primary" htmlType="submit" loading={saveOSS.isPending}>保存 OSS 配置</Button>
    </Form>
   </Space>}] : [])
  ]}/>
  <Modal title={editing ? '编辑模板' : '新增模板'} open={editing!==undefined} forceRender onCancel={()=>setEditing(undefined)} onOk={()=>form.submit()} confirmLoading={save.isPending} okButtonProps={{disabled:!!uploading}} cancelButtonProps={{disabled:!!uploading || save.isPending}} keyboard={!uploading && !save.isPending} closable={!uploading && !save.isPending} mask={{closable:false}}>
   <Form form={form} layout="vertical" onFinish={v=>save.mutate(v)} disabled={save.isPending || !!uploading}>
    <Form.Item name="title" label="模板名称" rules={[{required:true}]}><Input maxLength={255}/></Form.Item>
    <Form.Item name="category_id" label="分类" rules={[{required:true}]}><Select options={categories.data?.map(c=>({value:c.id,label:c.name}))}/></Form.Item>
    <Form.Item name="media_type" label="媒体类型" rules={[{required:true}]}><Select options={[{value:'video',label:'视频'},{value:'image',label:'图片'}]}/></Form.Item>
    <Form.Item name="media_url" label="媒体地址" rules={[{required:true},...urlRules]}><Input/></Form.Item>
    <Upload showUploadList={false} accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" beforeUpload={f=>{void upload(f,'media_url');return false;}} disabled={!!uploading || save.isPending}><Button loading={uploading==='media_url'}>上传媒体到 OSS</Button></Upload>
    <Form.Item name="cover_url" label="封面地址" rules={urlRules}><Input/></Form.Item>
    <Upload showUploadList={false} accept="image/jpeg,image/png,image/webp" beforeUpload={f=>{void upload(f,'cover_url');return false;}} disabled={!!uploading || save.isPending}><Button loading={uploading==='cover_url'}>上传封面到 OSS</Button></Upload>
    <Form.Item name="description" label="说明"><Input.TextArea maxLength={10000} rows={3}/></Form.Item>
    <Form.Item name="enabled" label="上架" valuePropName="checked"><Switch/></Form.Item>
   </Form>
  </Modal>
  <Modal title={catEdit?'编辑分类':'新增分类'} open={catEdit!==undefined} forceRender onCancel={()=>setCatEdit(undefined)} onOk={()=>catForm.submit()} confirmLoading={saveCat.isPending} cancelButtonProps={{disabled:saveCat.isPending}} mask={{closable:false}}>
   <Form form={catForm} layout="vertical" onFinish={v=>saveCat.mutate(v)} disabled={saveCat.isPending}><Form.Item name="name" label="分类名称" rules={[{required:true}]}><Input maxLength={80}/></Form.Item><Form.Item name="position" label="排序（小的在前）" rules={[{required:true}]}><InputNumber min={0} max={1000000} precision={0}/></Form.Item></Form>
  </Modal>
 </Space>;
}
