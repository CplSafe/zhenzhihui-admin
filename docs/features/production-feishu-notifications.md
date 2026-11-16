# T+1 / T+5 飞书通知

「人工视频制作」和「定制宣传片 T+5」页共用一个「飞书通知」抽屉，调用真实后端 GET/PUT `/api/v1/admin/settings/production-notifications`、POST `/api/v1/admin/settings/production-notifications/test`。

- 查看入口需要 `admin.settings.read`；保存、发送测试需要 `admin.settings.write`。制作角色不自动获得系统设置权限。
- 配置 Webhook、可选签名密钥、当前环境 HTTPS 后台域名，开启任务通知。两条业务线共用机器人。
- URL／密钥均不回显，输入留空保留已保存值；可以明确清除签名密钥。保存使用 version，409 后重新加载并重填。
- 新任务、T+1 付费修改、T+5 返工申请触发通知；首次启用不补历史。暂停期间新发生的事件不会补发，已入队的失败通知恢复后继续重试。更换机器人后未发送队列使用新地址。
- 测试按钮只使用已保存配置，不创建订单、不扣积分。实际飞书群需配置真实 Webhook 后验收。

生产代码无 mock。本地浏览器验证使用了隔离模拟接口（仅测试工具，不在产品代码中）：验证 T+5／T+1 两个入口、保存版本、凭据清空、状态标签与测试按钮；未对真实飞书发消息。验证：TypeScript+构建、ESLint、现有 Node 测试及后端加密／权限／队列测试。
