/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stitch: {
          primary: '#0052cc',
          'primary-hover': '#003d9b',
          'primary-light': '#e8edff',
          'primary-container': '#0052cc',
          secondary: '#1e293b',
          'secondary-hover': '#334155',
          background: '#090d16',
          surface: '#0f172a',
          'surface-card': '#1e293b',
          'surface-input': '#0b1120',
          border: '#334155',
          'border-light': '#1e293b',
          text: '#f8fafc',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
          success: '#10b981',
          'success-bg': 'rgba(16, 185, 129, 0.1)',
          error: '#ef4444',
          'error-bg': 'rgba(239, 68, 68, 0.1)',
          warning: '#f59e0b',
          'warning-bg': 'rgba(245, 158, 11, 0.1)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
