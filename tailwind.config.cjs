/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./screen_*.html",
    "./screens/clean/*.html",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        'primary': '#1A73E8',
        'on-primary': '#FFFFFF',
        'primary-container': '#E8F0FE',
        'on-primary-container': '#041E49',
        'primary-fixed': '#D3E3FD',
        'on-primary-fixed': '#041E49',
        'primary-fixed-dim': '#A8C7FA',
        // Secondary
        'secondary': '#4285F4',
        'on-secondary': '#FFFFFF',
        'secondary-container': '#C2E7FF',
        'on-secondary-container': '#001D35',
        'secondary-fixed': '#D3E3FD',
        'on-secondary-fixed': '#001A41',
        'secondary-fixed-dim': '#82B0FF',
        // Tertiary
        'tertiary': '#9334E6',
        'on-tertiary': '#FFFFFF',
        'tertiary-container': '#EAD5F9',
        'on-tertiary-container': '#21005D',
        'tertiary-fixed': '#EAD5F9',
        'on-tertiary-fixed': '#21005D',
        'tertiary-fixed-dim': '#D0BCFF',
        // Surface
        'surface': '#FFFFFF',
        'on-surface': '#202124',
        'surface-dim': '#F5F5F5',
        'surface-bright': '#FAFAFA',
        'surface-tint': '#1A73E8',
        'surface-variant': '#DADCE0',
        'on-surface-variant': '#5F6368',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F8F9FA',
        'surface-container': '#F1F3F4',
        'surface-container-high': '#E8EAED',
        'surface-container-highest': '#DADCE0',
        // Outline
        'outline': '#79747E',
        'outline-variant': '#E0E0E0',
        // Error
        'error': '#EA4335',
        'on-error': '#FFFFFF',
        'error-container': '#FFDAD6',
        'on-error-container': '#410002',
        // Background
        'background': '#FFFFFF',
        'on-background': '#202124',
      },
      fontFamily: {
        'title-main': ['Inter', 'sans-serif'],
        'title-main-mobile': ['Inter', 'sans-serif'],
        'body-standard': ['Inter', 'sans-serif'],
        'label-bold': ['Inter', 'sans-serif'],
        'timer-display': ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        'title-main': ['20px', { lineHeight: '1.25', fontWeight: '700' }],
        'title-main-mobile': ['16px', { lineHeight: '1.25', fontWeight: '700' }],
        'body-standard': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label-bold': ['11px', { lineHeight: '1.25', fontWeight: '600' }],
        'timer-display': ['16px', { lineHeight: '1.25', letterSpacing: '0.06em', fontWeight: '700' }],
      },
      fontWeight: {
        'title-main': '700',
        'title-main-mobile': '700',
        'body-standard': '400',
        'label-bold': '600',
        'timer-display': '700',
      },
      spacing: {
        'nav-height': '56px',
        'touch-target': '48px',
        'margin-edge': '16px',
        'gutter-card': '16px',
        'fab-size': '56px',
      },
      height: {
        'nav-height': '56px',
        'touch-target': '48px',
        'fab-size': '56px',
      },
      width: {
        'nav-height': '56px',
        'touch-target': '48px',
        'fab-size': '56px',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
