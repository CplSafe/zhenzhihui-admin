async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let readonly = false, fail = false;
  const writes = [];
  const config = { source: 'volcengine', account_label: '独立账单测试账号', products: ['ark'], local_providers: ['volcengine'], exclusive: true, configured: true };
  const snapshot = { config, products: [{code:'ark',name:'方舟',currency:'CNY',gross:'12.500001',payable:'10.000001',rows:2},{code:'ecs',name:'云服务器',currency:'CNY',gross:'100',payable:'80',rows:1}],gross:'12.500001',payable:'10.000001',local_estimate:'9.000000',difference:'1.000001',task_count:4,unknown_cost_count:0,pending_count:0,failed_count:0,comparable:true };
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let data;
    if(path.endsWith('/admin/session')) data={admin_user:{id:1,status:'active'},roles:[],permissions: readonly ? ['admin.billing.read'] : ['admin.billing.read','admin.settings.read','admin.settings.write']};
    else if(path.endsWith('/settings/billing')) data=[config,{...config,source:'aliyun',products:[],local_providers:['bailian'],configured:false}];
    else if(req.method()==='PUT') { writes.push(req.postDataJSON()); data=config; }
    else if(path.endsWith('/sync')) {fail=true;return route.fulfill({status:502,json:{code:10001,message:'账单查询失败，请检查权限'}});}
    else if(path.endsWith('/provider-bills')) data=[{source:'volcengine',month:'2026-10',status:fail?'failed':'synced',error:fail?'同步失败，已保留上次成功结果':'',synced_at:'2026-11-04T04:00:00Z',snapshot,provisional:false,config_changed:false},{source:'aliyun',month:'2026-10',status:'not_synced',snapshot:null,synced_at:null,provisional:false,config_changed:false}];
    else data={};
    return route.fulfill({json:{code:0,data}});
  });
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForTimeout(350);
  await page.goto('http://127.0.0.1:5188/billing/provider-bills');
  await page.getByRole('heading',{name:'AI 厂商月度对账'}).waitFor();
  await page.getByText('10.000001',{exact:true}).waitFor();
  await page.getByRole('button',{name:'火山账单配置',exact:true}).waitFor({state:'visible'});
  await page.screenshot({path:'/tmp/zzh-billing-desktop.png',fullPage:true});
  await page.getByRole('button',{name:/明\s*细/}).first().click();
  await page.getByText('云服务器',{exact:true}).waitFor();
  await page.getByRole('button',{name:/关闭|Close/}).click();
  await page.getByRole('button',{name:'火山账单配置',exact:true}).click();
  await page.getByLabel('账号标识',{exact:true}).fill('更新后的测试账号');
  await page.getByRole('button',{name:/确\s*定/}).click();
  await page.getByText('配置已保存，请重新同步账单').waitFor();
  if(writes.length!==1 || 'access_key' in writes[0] || 'secret_key' in writes[0]) throw Error('Blank keys must be omitted');
  await page.getByRole('button',{name:/同\s*步/}).first().click();
  await page.getByText('火山引擎：同步失败，已保留上次成功结果').waitFor();
  await page.getByText('10.000001',{exact:true}).waitFor();
  readonly=true;
  await page.reload();
  await page.getByRole('heading',{name:'AI 厂商月度对账'}).waitFor();
  if(await page.getByRole('button',{name:/同\s*步/}).count()) throw Error('Readonly sees sync');
  if(await page.getByRole('button',{name:'火山账单配置',exact:true}).count()) throw Error('Readonly sees config');
  await page.setViewportSize({width:768,height:900});
  await page.waitForTimeout(350);
  await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().width === 0);
  await page.screenshot({path:'/tmp/zzh-billing-tablet.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(350);
  await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().width === 0);
  await page.screenshot({path:'/tmp/zzh-billing-mobile.png',fullPage:true});
  if(errors.length) throw Error(errors.join('\n'));
  return {passed:true,writes:writes.length};
}
