/** Preset window for trend endpoints when `fromDate` / `toDate` omitted. */
export const ANALYTICS_RANGE_PRESETS = ['7d', '30d', '90d', '365d', 'custom'] as const;
export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];
