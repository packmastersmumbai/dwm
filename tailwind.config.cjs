/** @type {import('tailwindcss').Config}
 *  TaskFlow Shopfloor theme — semantic keys preserved so existing utility classes
 *  (bg-primary, text-on-surface, etc.) auto-flip to the dark amber palette.
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
        // Primary — safety amber
        'primary': '#FFB400',
        'on-primary': '#0E1116',
        'primary-container': '#2E2410',
        'on-primary-container': '#FFB400',
        'primary-fixed': '#FFC633',
        'on-primary-fixed': '#0E1116',
        'primary-fixed-dim': '#E69F00',
        // Secondary — muted ink (kept distinct from primary on dark canvas)
        'secondary': '#B8BFCA',
        'on-secondary': '#0E1116',
        'secondary-container': '#1D222A',
        'on-secondary-container': '#F2F4F7',
        'secondary-fixed': '#252B35',
        'on-secondary-fixed': '#F2F4F7',
        'secondary-fixed-dim': '#7A828F',
        // Tertiary — on-time green (kept as semantic accent for success states)
        'tertiary': '#2FB344',
        'on-tertiary': '#0E1116',
        'tertiary-container': '#1A2E20',
        'on-tertiary-container': '#2FB344',
        'tertiary-fixed': '#1A2E20',
        'on-tertiary-fixed': '#2FB344',
        'tertiary-fixed-dim': '#2FB344',
        // Surface — dark canvas + tonal lifts
        'surface': '#0E1116',
        'on-surface': '#F2F4F7',
        'surface-dim': '#0E1116',
        'surface-bright': '#252B35',
        'surface-tint': '#FFB400',
        'surface-variant': '#1D222A',
        'on-surface-variant': '#B8BFCA',
        'surface-container-lowest': '#0E1116',
        'surface-container-low': '#161A20',
        'surface-container': '#1D222A',
        'surface-container-high': '#252B35',
        'surface-container-highest': '#3A4250',
        // Outline — hairlines
        'outline': '#3A4250',
        'outline-variant': '#2A313C',
        // Error — overdue red
        'error': '#E5484D',
        'on-error': '#F2F4F7',
        'error-container': '#2E1517',
        'on-error-container': '#E5484D',
        // Background
        'background': '#0E1116',
        'on-background': '#F2F4F7',
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
        // Flat system — shadows neutralised, replaced visually by hairline borders
        'none': 'none',
        'sm': '0 0 0 1px #2A313C',
        DEFAULT: '0 0 0 1px #2A313C',
        'md': '0 0 0 1px #3A4250',
        'lg': '0 0 0 1px #3A4250',
        'xl': '0 0 0 1px #3A4250',
      },
    },
  },
  plugins: [],
}
