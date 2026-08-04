// ==============================================
// OmniDial - Monochromatic Design System
// Editorial-Brutalist Dark Theme
// No gradients, no accents, blacks and grays only
// ==============================================

export type LayoutType = "sidebar" | "topnavWithSidebar" | "sidebarWithTopbar";

export const themeConfig = {
  layout: "sidebarWithTopbar" as LayoutType,

  colors: {
    // Core - Pure monochromatic
    background: "#0a0a0a",
    foreground: "#fafafa",

    // Elevated surfaces
    card: "#111111",
    cardForeground: "#fafafa",

    // Muted/Secondary
    muted: "#171717",
    mutedForeground: "#737373",

    // Borders - hairline
    border: "#262626",
    input: "#262626",

    // Focus/Ring
    ring: "#404040",

    // Interactive - white on black, inverted
    primary: "#fafafa",
    primaryForeground: "#0a0a0a",

    // Secondary - subtle
    secondary: "#262626",
    secondaryForeground: "#fafafa",

    // Accent - same as secondary for monochrome
    accent: "#1a1a1a",
    accentForeground: "#fafafa",

    // Destructive - only color allowed
    destructive: "#ef4444",
    destructiveForeground: "#fafafa",

    // Popover
    popover: "#111111",
    popoverForeground: "#fafafa",

    // Charts - blue accent for data viz (ElevenLabs-inspired)
    chart1: "#3b82f6", // Blue - primary metric
    chart2: "#22c55e", // Green - success/connected
    chart3: "#a3a3a3", // Gray - secondary
    chart4: "#f59e0b", // Amber - warning/attention
    chart5: "#ef4444", // Red - errors/missed

    // Sidebar
    sidebar: "#0a0a0a",
    sidebarForeground: "#737373",
    sidebarPrimary: "#fafafa",
    sidebarPrimaryForeground: "#0a0a0a",
    sidebarAccent: "#171717",
    sidebarAccentForeground: "#fafafa",
    sidebarBorder: "#262626",
  },

  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },

  typography: {
    fontDisplay: "var(--font-plus-jakarta)",
    fontSans: "var(--font-plus-jakarta)",
    fontMono: "var(--font-jetbrains-mono)",
  },
};

export function generateCSSVariables(config: typeof themeConfig) {
  return {
    "--color-background": config.colors.background,
    "--color-foreground": config.colors.foreground,
    "--color-card": config.colors.card,
    "--color-card-foreground": config.colors.cardForeground,
    "--color-popover": config.colors.popover,
    "--color-popover-foreground": config.colors.popoverForeground,
    "--color-primary": config.colors.primary,
    "--color-primary-foreground": config.colors.primaryForeground,
    "--color-secondary": config.colors.secondary,
    "--color-secondary-foreground": config.colors.secondaryForeground,
    "--color-muted": config.colors.muted,
    "--color-muted-foreground": config.colors.mutedForeground,
    "--color-accent": config.colors.accent,
    "--color-accent-foreground": config.colors.accentForeground,
    "--color-destructive": config.colors.destructive,
    "--color-destructive-foreground": config.colors.destructiveForeground,
    "--color-border": config.colors.border,
    "--color-input": config.colors.input,
    "--color-ring": config.colors.ring,
    "--color-chart-1": config.colors.chart1,
    "--color-chart-2": config.colors.chart2,
    "--color-chart-3": config.colors.chart3,
    "--color-chart-4": config.colors.chart4,
    "--color-chart-5": config.colors.chart5,
    "--color-sidebar": config.colors.sidebar,
    "--color-sidebar-foreground": config.colors.sidebarForeground,
    "--color-sidebar-primary": config.colors.sidebarPrimary,
    "--color-sidebar-primary-foreground": config.colors.sidebarPrimaryForeground,
    "--color-sidebar-accent": config.colors.sidebarAccent,
    "--color-sidebar-accent-foreground": config.colors.sidebarAccentForeground,
    "--color-sidebar-border": config.colors.sidebarBorder,
    "--color-sidebar-ring": config.colors.ring,
    "--radius-none": `${config.radius.none}px`,
    "--radius-sm": `${config.radius.sm / 16}rem`,
    "--radius-md": `${config.radius.md / 16}rem`,
    "--radius-lg": `${config.radius.lg / 16}rem`,
    "--radius-full": `${config.radius.full}px`,
    "--font-display": config.typography.fontDisplay,
    "--font-sans": config.typography.fontSans,
    "--font-mono": config.typography.fontMono,
  } as React.CSSProperties;
}
