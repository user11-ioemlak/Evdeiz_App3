/**
 * Color palette for the Prototype template.
 * Supports both light and dark themes.
 */
export const Colors = {
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#64748B',
    accent: '#3B82F6',
    accentLight: '#DBEAFE',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    border: '#334155',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    accent: '#3B82F6',
    accentLight: '#1E3A5F',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
} as const;

export type ThemeColors = typeof Colors.light;
