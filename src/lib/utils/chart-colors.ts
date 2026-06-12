// Centralized chart color palette — Recharts SVG props do not support CSS variables,
// so colors are defined as constants. These map to the design tokens in globals.css.

export const CHART_COLORS = {
  sage:      '#6E8F74', // --color-sage
  steel:     '#7B92B2',
  sand:      '#D4A05D',
  terracotta: '#C97A6B', // --color-terracotta
} as const

// Ordered palette for sequential multi-segment charts (e.g. AllocationChart)
export const CHART_PALETTE = [
  CHART_COLORS.sage,
  CHART_COLORS.steel,
  CHART_COLORS.sand,
  CHART_COLORS.terracotta,
] as const

// Shared styling for Recharts tooltips and axes
export const CHART_STYLE = {
  tooltipContent: { background: '#fff', borderRadius: '12px', border: '1px solid #ECEAE5' },
  gridStroke:     '#ECEAE5',
  axisTickFill:   '#6B7280',
  labelFill:      '#6B7280',
  valueFill:      '#161616',
} as const
