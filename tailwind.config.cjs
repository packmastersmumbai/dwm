/** @type {import('tailwindcss').Config}
 *  TaskFlow "Calm Material" — light, indigo-accented theme.
 *  Semantic keys preserved so existing utility classes (bg-primary, text-on-surface, etc.)
 *  auto-flip to the new palette.
 *  Source of truth: DESIGN.md + style_tokens.html
 */
module.exports = {
  content: [
    "./screen_*.html",
    "./screens/clean/*.html",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Primary — indigo
        'primary': '#4F46E5',
        'on-primary': '#FFFFFF',
        'primary-container': '#EEF2FF',
        'on-primary-container': '#3730A3',
        'primary-fixed': '#6366F1',
        'on-primary-fixed': '#FFFFFF',
        'primary-fixed-dim': '#4338CA',
        // Secondary — neutral ink
        'secondary': '#4A5260',
        'on-secondary': '#FFFFFF',
        'secondary-container': '#F4F2EE',
        'on-secondary-container': '#1F2328',
        'secondary-fixed': '#EAE6DF',
        'on-secondary-fixed': '#1F2328',
        'secondary-fixed-dim': '#6B7280',
        // Tertiary — emerald success
        'tertiary': '#10B981',
        'on-tertiary': '#FFFFFF',
        'tertiary-container': '#ECFDF5',
        'on-tertiary-container': '#047857',
        'tertiary-fixed': '#ECFDF5',
        'on-tertiary-fixed': '#047857',
        'tertiary-fixed-dim': '#10B981',
        // Surface — light canvas + tonal lifts
        'surface': '#FAF9F7',
        'on-surface': '#1F2328',
        'surface-dim': '#F4F2EE',
        'surface-bright': '#FFFFFF',
        'surface-tint': '#4F46E5',
        'surface-variant': '#F4F2EE',
        'on-surface-variant': '#4A5260',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#FAF9F7',
        'surface-container': '#F4F2EE',
        'surface-container-high': '#EAE6DF',
        'surface-container-highest': '#D3CFC7',
        // Outline — hairlines
        'outline': '#D3CFC7',
        'outline-variant': '#E5E1DA',
        // Error — overdue red
        'error': '#DC2626',
        'on-error': '#FFFFFF',
        'error-container': '#FEF2F2',
        'on-error-container': '#991B1B',
        // Background
        'background': '#FAF9F7',
        'on-background': '#1F2328',
      },
      fontFamily: {
        'title-main': ['Inter', 'sans-serif'],
        'title-main-mobile': ['Inter', 'sans-serif'],
        'body-standard': ['Inter', 'sans-serif'],
        'label-bold': ['Inter', 'sans-serif'],
        'timer-display': ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        'title-main': ['20px', { lineHeight: '1.25', fontWeight: '600' }],
        'title-main-mobile': ['17px', { lineHeight: '1.3', fontWeight: '600' }],
        'body-standard': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label-bold': ['11px', { lineHeight: '1', letterSpacing: '0.12em', fontWeight: '700' }],
        'timer-display': ['18px', { lineHeight: '1', letterSpacing: '0.02em', fontWeight: '600' }],
      },
      fontWeight: {
        'title-main': '600',
        'title-main-mobile': '600',
        'body-standard': '400',
        'label-bold': '700',
        'timer-display': '600',
      },
      spacing: {
        'nav-height': '64px',
        'touch-target': '48px',
        'touch-glove': '56px',
        'margin-edge': '16px',
        'gutter-card': '16px',
        'fab-size': '56px',
      },
      height: {
        'nav-height': '64px',
        'touch-target': '48px',
        'touch-glove': '56px',
        'fab-size': '56px',
      },
      width: {
        'nav-height': '64px',
        'touch-target': '48px',
        'touch-glove': '56px',
        'fab-size': '56px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '10px',
        'xl': '10px',
        '2xl': '10px',
      },
      boxShadow: {
        // Subtle elevation for light mode legibility
        'none': 'none',
        'sm': '0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 1px 2px rgba(0,0,0,0.04)',
        'md': '0 1px 3px rgba(0,0,0,0.06)',
        'lg': '0 4px 12px rgba(0,0,0,0.08)',
        'xl': '0 8px 24px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
