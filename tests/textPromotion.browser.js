async (page) => {
 const origin = await page.evaluate(() => location.origin);
 if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(origin)) throw Error('Local fixture only');
 await page.goto(origin+'/tests/fixtures/pricing.html?provider=openai&version=gpt-5.6-sol&capability=responses');
 await page.getByRole('spinbutton',{name:'普通输入常规成本',exact:true}).fill('400');
 await page.getByRole('spinbutton',{name:'输出常规成本',exact:true}).fill('2000');
 await page.getByRole('button',{name:'collapsed 限时优惠',exact:true}).click();
 for (const [label,value] of [['普通输入优惠成本','200'],['缓存读取优惠成本','20'],['缓存写入 30 分钟优惠成本','250'],['缓存写入 12 小时优惠成本','500'],['输出优惠成本','1000']]) { await page.getByRole('spinbutton',{name:label,exact:true}).fill(value); await page.getByRole('spinbutton',{name:label,exact:true}).blur(); }
 await page.getByRole('textbox',{name:'活动结束时间',exact:true}).fill('2026-11-30 23:59:59');
 await page.getByRole('textbox',{name:'活动结束时间',exact:true}).press('Enter');
 await page.getByRole('switch').click();
 await page.getByRole('button',{name:'保存测试配置'}).click();
 let saved=JSON.parse(await page.getByTestId('saved').innerText()).pricing;
 if(!saved.promo.ends_at || !saved.promo.require_price_review_after_end) throw Error('End-only activity or review flag lost');
 if(saved.promo.provider_cost_cents_per_million_tokens_by_usage.cache_write_12h!==500 || saved.promo.provider_cost_cents_per_million_tokens_by_usage.input!==200 || saved.provider_concurrency_limit!==8) throw Error('lost cost or concurrency');
 await page.screenshot({path:'/tmp/text-promo-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/text-promo-mobile.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow) throw Error('Text promotion overflows mobile width');
 await page.getByRole('button',{name:'取消优惠活动'}).click();
 await page.getByRole('button',{name:'保存测试配置'}).click();
 if(JSON.parse(await page.getByTestId('saved').innerText()).pricing.promo)throw Error('cancel failed');
 await page.setViewportSize({width:1280,height:960});
 await page.goto(origin+'/tests/fixtures/pricing.html?provider=openai&version=gpt-5.4&capability=responses');
 await page.getByRole('button',{name:'collapsed 限时优惠',exact:true}).click();
 await page.getByRole('spinbutton',{name:'普通输入优惠价（积分 / 千 tokens）',exact:false}).fill('1');
 await page.getByRole('spinbutton',{name:'缓存读取优惠价（积分 / 千 tokens）',exact:false}).fill('0.1');
 await page.getByRole('spinbutton',{name:'输出优惠价（积分 / 千 tokens）',exact:false}).fill('2');
 await page.getByRole('button',{name:'保存测试配置'}).click();
 saved=JSON.parse(await page.getByTestId('saved').innerText()).pricing;
 if(saved.promo.input_credit_rate!==1||saved.promo.cached_input_credit_rate!==0.1||saved.promo.output_credit_rate!==2)throw Error('legacy text save failed');
 await page.goto(origin+'/tests/fixtures/pricing.html?provider=volcengine&version=doubao-seedance-2-0-mini&capability=video');
 await page.getByRole('button',{name:/collapsed 限时优惠/}).click();
 if(await page.getByText('折后价(每秒积分)').count()!==1)throw Error('video promo missing');
 console.log('Text promotional costs/credits, cancellation and video regression passed');
}
