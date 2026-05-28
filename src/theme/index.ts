import type { ThemeConfig } from 'antd'

// Stripe 风格 AntD 6 主题,源自根目录 DESIGN.md。
// 设计取舍:DESIGN.md 的 pill 按钮语法用于"动作"(按钮、tag);
// 表格/卡片/输入框等 chrome 保留 DESIGN.md 的 xs/sm/lg 圆角,避免后台高密度界面全圆角失序。
export const colors = {
  primary: '#533afd',
  primaryDeep: '#4434d4',
  primaryPress: '#2e2b8c',
  primarySoft: '#665efd',
  primarySubdued: '#b9b9f9',
  brandDark900: '#1c1e54',
  ink: '#0d253d',
  inkSecondary: '#273951',
  inkMute: '#64748d',
  onPrimary: '#ffffff',
  canvas: '#ffffff',
  canvasSoft: '#f6f9fc',
  canvasCream: '#f5e9d4',
  hairline: '#e3e8ee',
  hairlineInput: '#a8c3de',
  ruby: '#ea2261',
  magenta: '#f96bee',
} as const

const fontFamily =
  "'Inter Variable', 'Inter', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"

export const theme: ThemeConfig = {
  token: {
    colorPrimary: colors.primary,
    colorLink: colors.primary,
    colorInfo: colors.primary,
    colorError: colors.ruby,
    colorTextBase: colors.ink,
    colorText: colors.ink,
    colorTextSecondary: colors.inkSecondary,
    colorTextTertiary: colors.inkMute,
    colorBgLayout: colors.canvasSoft,
    colorBgContainer: colors.canvas,
    colorBorder: colors.hairline,
    colorBorderSecondary: colors.hairline,
    fontFamily,
    // DESIGN.md: 默认 UI body 15px。
    fontSize: 15,
    // chrome 默认圆角走 sm(6px);卡片等大圆角在 components 里单独提。
    borderRadius: 6,
    borderRadiusLG: 12,
    borderRadiusSM: 4,
    // Stripe 蓝调阴影。
    boxShadow: 'rgba(0, 55, 112, 0.08) 0 1px 3px',
    boxShadowSecondary:
      'rgba(0, 55, 112, 0.08) 0 8px 24px, rgba(0, 55, 112, 0.04) 0 2px 6px',
    wireframe: false,
  },
  components: {
    // 按钮:pill 语法是品牌动作信号。
    Button: {
      borderRadius: 9999,
      borderRadiusLG: 9999,
      borderRadiusSM: 9999,
      controlHeight: 36,
      paddingInline: 16,
      fontWeight: 400,
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    // 输入框:DESIGN.md text-input 6px 圆角 + 冷调 hairline。
    Input: {
      borderRadius: 6,
      controlHeight: 36,
      activeBorderColor: colors.primary,
      hoverBorderColor: colors.hairlineInput,
    },
    Select: { borderRadius: 6, controlHeight: 36 },
    // 卡片:feature/pricing 卡片 12px 圆角 + hairline。
    Card: {
      borderRadiusLG: 12,
      colorBorderSecondary: colors.hairline,
    },
    // 表格:hairline 边框、冷白表头、tabular 数字在单元格里按需加 class。
    Table: {
      headerBg: colors.canvasSoft,
      headerColor: colors.inkSecondary,
      borderColor: colors.hairline,
      rowHoverBg: colors.canvasSoft,
    },
    // 侧边栏深 navy 壳(dashboard track)。
    Menu: {
      darkItemBg: colors.brandDark900,
      darkSubMenuItemBg: colors.brandDark900,
      darkItemSelectedBg: colors.primary,
      darkItemColor: 'rgba(255,255,255,0.72)',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedColor: '#ffffff',
    },
    Layout: {
      bodyBg: colors.canvasSoft,
      headerBg: colors.canvas,
      siderBg: colors.brandDark900,
    },
    // tag pill。
    Tag: { borderRadiusSM: 9999 },
  },
}
