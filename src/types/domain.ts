// 业务领域类型,对应后端 internal/domain/models.go 的 JSON 序列化形态。
// 仅声明 admin 只读列表/详情会用到的字段。

// 列表统一信封,对应 admin.ListPage。
export interface ListPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// 分页/筛选请求通用参数。
export interface PageParams {
  limit?: number;
  offset?: number;
}

// 所有领域实体共享 id + 创建时间;大多数也有更新时间。
interface Entity {
  id: number;
  created_at: string;
}

interface MutableEntity extends Entity {
  updated_at: string;
}

// workspace 维度的资源(任务、资产、订单、账单等)。
interface WorkspaceScoped extends MutableEntity {
  workspace_id: number;
  user_id: number;
}

export type WorkspaceType = "personal" | "team" | "enterprise";
// activation_pending:买 team 套餐开新空间时下单即建的占位空间,付款激活前不可用、列表隐藏;
// disbanded:已解散(owner 解散 / 未付款开团队单被清理)。
export type WorkspaceStatus =
  "enabled" | "disabled" | "disbanded" | "activation_pending";
export type AssetType = "image" | "video" | "audio" | "prompt";
export type AssetStatus = "pending" | "active" | "rejected" | "deleted";
export type PaymentOrderType =
  "credit_recharge" | "subscription_initial" | "subscription_renewal";
// 后端会扩展 kind 值,这里允许已知字面量之外的字符串。
export type CreditLedgerKind =
  "freeze" | "settle" | "release" | "credit" | (string & {});

export interface User extends MutableEntity {
  deepauth_user_id: string;
  mobile?: string;
  nickname?: string;
  email?: string;
  email_verified_at?: string;
}

// 销售数据(推广绑定)列表行:邀请人 + 被邀请人 双方档案 + 绑定码 + 绑定时间。
export interface ReferralBindingItem {
  id: number;
  created_at: string;
  code: string;
  referrer_user_id: number;
  referrer_mobile?: string;
  referrer_nickname?: string;
  referee_user_id: number;
  referee_mobile?: string;
  referee_nickname?: string;
}

export interface Workspace extends MutableEntity {
  type: WorkspaceType;
  name: string;
  owner_user_id: number;
  status: WorkspaceStatus;
}

// 空间内单个成员的消耗/作品统计(本月 Asia/Shanghai + 累计),对应后端 admin.WorkspaceMemberStatItem。
// 消耗积分只计 settle(结算),作品数只计 active。
export interface WorkspaceMemberStat {
  user_id: number;
  nickname: string;
  role: string;
  status: string;
  month_credits: number;
  total_credits: number;
  month_works: number;
  total_works: number;
}

export interface AITask extends WorkspaceScoped {
  model_version_id: number;
  operation_code: string;
  idempotency_key?: string;
  provider: string;
  provider_task_id?: string;
  status: string;
  prompt?: string;
  estimated_cost: number;
  actual_cost: number;
  error_message?: string;
  // 仅详情接口 GET /admin/ai/tasks/:id 返回的大字段。
  request_json?: unknown;
  result_json?: unknown;
}

export interface Asset extends WorkspaceScoped {
  task_id?: number;
  type: AssetType;
  source: string;
  name: string;
  bucket?: string;
  object_key?: string;
  mime_type?: string;
  size_bytes?: number;
  hash?: string;
  storage_etag?: string;
  prompt?: string;
  status: AssetStatus;
}

export interface PaymentOrder extends WorkspaceScoped {
  credit_package_id?: number;
  type: PaymentOrderType;
  amount_cents: number;
  credits: number;
  status: string;
  provider: string;
  provider_trade_no?: string;
  business_key?: string;
}

export interface CreditLedger extends Entity {
  workspace_id: number;
  user_id: number;
  kind: CreditLedgerKind;
  amount: number;
  balance_after: number;
  frozen_after: number;
  reason: string;
  idempotency_key?: string;
}

export interface Wallet extends MutableEntity {
  workspace_id: number;
  balance: number;
  frozen: number;
}

// 钱包列表项,对应 admin.AdminWalletItem(联 workspace)。
// 后端 ListWallets 返回的是嵌套结构,不是扁平 Wallet。
export interface AdminWalletItem {
  wallet: Wallet;
  workspace: Workspace;
}

export interface Subscription extends WorkspaceScoped {
  plan_id: number;
  alipay_agreement_no?: string;
  status: string;
  current_period_end: string;
  canceled_at?: string;
}

export interface AdminAuditLog extends Entity {
  actor_admin_user_id: number;
  actor_local_user_id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  before_json?: unknown;
  after_json?: unknown;
  ip?: string;
  user_agent?: string;
}

// 用户详情里某 workspace 的聚合视图,对应 admin.UserWorkspaceItem。
export interface UserWorkspaceItem {
  workspace: Workspace;
  role: string;
  wallet?: Wallet;
  subscription?: Subscription;
}

// 用户详情,对应 admin.AdminUserDetail(用户 + 其 workspace 列表带钱包/订阅)。
export interface AdminUserDetail {
  user: User;
  workspace_count: number;
  workspaces: UserWorkspaceItem[];
}

// 授予套餐结果,对应 admin.GrantPlanResult。
export interface GrantPlanResult {
  subscription: Subscription;
  credits_granted: number;
}

// 套餐,对应 domain.Plan。entitlements_json 含 models/concurrency/system_only/
// is_trial_grant/trial_days,前端用 JSON 编辑器读写。
// 订阅周期。后端校验同步:week/month/quarter/year(internal/admin/plans.go)。
export type PlanPeriod = "week" | "month" | "quarter" | "year";

export interface Plan extends MutableEntity {
  code: string;
  name: string;
  period: PlanPeriod;
  price_cents: number;
  base_credits: number;
  discount_enabled: boolean;
  discount_percent: number; // 80=八折
  discounted_price_cents: number; // 后端算好的折后价(应付),只读展示
  entitlements_json?: unknown;
  status: "enabled" | "disabled";
}

// 积分包,对应 domain.CreditPackage。
export interface CreditPackage extends MutableEntity {
  code: string;
  name: string;
  amount_cents: number;
  credits: number;
  status: "enabled" | "disabled";
}

// 首页轮播图,对应 domain.Banner。前台公开拉取 enabled 列表,后台 CRUD。
export interface Banner extends MutableEntity {
  title: string;
  image_url: string;
  media_type: "image" | "video";
  // category_id 关联 BannerCategory(投放位置);0 = 未分类。
  category_id: number;
  link_url: string;
  description: string;
  position: number;
  enabled: boolean;
}

// 轮播分类(投放位置:首页轮播 / 登录页 …),对应 domain.BannerCategory。
// 前台按 slug 拉取对应位置的 banner;后台 CRUD。
export interface BannerCategory extends MutableEntity {
  name: string;
  slug: string;
  position: number;
  enabled: boolean;
}

// 反馈类型,对应 domain.FeedbackType。后台 CRUD,前台读启用列表。
export interface FeedbackType extends MutableEntity {
  name: string;
  position: number;
  enabled: boolean;
}

// 用户反馈,对应 domain.Feedback。
export interface Feedback extends MutableEntity {
  user_id: number;
  feedback_type: number;
  content: string;
  contact: string;
  asset_ids_json?: number[] | null;
  status: "pending" | "resolved";
  admin_note: string;
}

// provider 凭证脱敏视图,对应 settings.ProviderConfigView。
// 永不含明文/密文 key,只有掩码 + 是否已配置。
export interface ProviderConfigView {
  provider: string;
  base_url: string;
  timeout_seconds: number;
  api_key_configured: boolean;
  api_key_masked?: string;
}

// 后台管理员,对应 domain.AdminUser。
export interface AdminUser extends MutableEntity {
  deepauth_user_id: string;
  local_user_id: number;
  status: "active" | "disabled";
  remark?: string;
}

// 后台角色,对应 domain.AdminRole。
export interface AdminRole extends MutableEntity {
  code: string;
  name: string;
  description?: string;
  status?: string;
}

// admin_users 列表/详情对外形状,对应 admin.AdminUserView。
// 列表只带 roles,详情额外带 permissions。
export interface AdminUserView {
  admin_user: AdminUser;
  roles: AdminRole[];
  permissions?: string[];
}

// 计价配置,对应 catalog.Pricing。chat 模型主要用 input/output_credit_rate(每千 token 积分),
// 其余字段(视频按秒、并发限制)按需,运营用结构化表单填常用项,生僻项走高级 JSON。
export interface Pricing {
  input_credit_rate?: number;
  output_credit_rate?: number;
  provider_concurrency_limit?: number;
  unit?: string;
  hold_credits_per_second?: number;
  credits_per_billable_second_by_resolution?: Record<string, number>;
  // Seedance 这类按 token 后置计费、单价随分辨率×含视频跳变的视频模型查表单价(积分/千 token)。
  credits_per_thousand_tokens_by_tier?: Record<string, TierTokenRate>;
}

// 单个分辨率档的 token 单价(积分/千 token),按输入是否含视频区分。
export interface TierTokenRate {
  no_video?: number;
  with_video?: number;
}

// 模型版本,对应 catalog.ModelVersion(admin 详情额外带 system_prompts)。
// 复杂字段(pricing / params_schema / result_schema)结构因 provider 而异,
// 统一以 unknown 透传,前端用 JSON 编辑器读写。
export interface ModelVersion extends MutableEntity {
  provider: string;
  model: string;
  version: string;
  display_name: string;
  capability: string;
  enabled: boolean;
  task_mode: string;
  allowed_plans_json?: unknown;
  pricing_json?: unknown;
  operation_codes_json?: unknown;
  params_schema_json?: unknown;
  system_prompts_json?: unknown;
  // admin 详情/写接口返回的结构化字段(catalog 形态)。
  allowed_plans?: string[];
  operation_codes?: string[];
  pricing?: unknown;
  params_schema?: unknown;
  result_schema?: unknown;
  system_prompts?: Record<string, string>;
}

// 运营概览,对应 admin.Overview。金额为分(cents),展示时转元。
export interface Overview {
  users_total: number;
  users_new: number;
  workspaces_total: number;
  workspaces_new: number;
  ai_tasks_total: number;
  ai_tasks_succeeded: number;
  ai_tasks_failed: number;
  ai_tasks_processing: number;
  credits_consumed: number;
  recharge_amount_cents: number;
  active_subscriptions: number;
  assets_total: number;
  assets_size_bytes: number;
}
