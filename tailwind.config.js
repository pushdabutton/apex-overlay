/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        // Apex-inspired dark theme
        'overlay-bg': 'rgba(15, 15, 20, 0.85)',
        'overlay-card': 'rgba(25, 25, 35, 0.90)',
        'overlay-border': 'rgba(255, 255, 255, 0.08)',
        'apex-red': '#e74c3c',
        'apex-gold': '#f1c40f',
        'apex-blue': '#3498db',
        'apex-green': '#2ecc71',
        'apex-purple': '#9b59b6',
        'apex-orange': '#e67e22',
        // Severity colors
        'severity-info': '#3498db',
        'severity-suggestion': '#f1c40f',
        'severity-warning': '#e74c3c',
        'severity-achievement': '#2ecc71',
        // Rank tier colors
        'rank-bronze': '#cd7f32',
        'rank-silver': '#c0c0c0',
        'rank-gold': '#ffd700',
        'rank-platinum': '#00ced1',
        'rank-diamond': '#00bfff',
        'rank-master': '#9b59b6',
        'rank-predator': '#e74c3c',
      },
      fontFamily: {
        'overlay': ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'overlay-xs': '0.65rem',
        'overlay-sm': '0.75rem',
        'overlay-base': '0.85rem',
        'overlay-lg': '1rem',
        'overlay-xl': '1.25rem',
      },
      backdropBlur: {
        'overlay': '12px',
      },
      animation: {
        'insight-in': 'insightSlideIn 0.3s ease-out',
        'insight-out': 'insightSlideOut 0.3s ease-in',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        insightSlideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        insightSlideOut: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
