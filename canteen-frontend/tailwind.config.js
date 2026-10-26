/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Outfit"', '"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['"Outfit"', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: '#F6F7F9',
          dark: '#EFF1F5',
          deep: '#E3E7EE',
        },
        ink: {
          DEFAULT: '#0F172A',
          soft: '#334155',
          mute: '#64748B',
        },
        cobalt: {
          50: '#F0F6FF',
          100: '#DBE9FF',
          200: '#BDD6FF',
          300: '#94BDFF',
          400: '#5797FF',
          500: '#0A68FF',
          600: '#0048BB',
          700: '#003D9E',
          800: '#003385',
          900: '#00296B',
          950: '#001D4D',
        },
        leaf: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        primary: {
          DEFAULT: '#0048BB',
          50: '#F0F6FF',
          100: '#DBE9FF',
          200: '#BDD6FF',
          300: '#94BDFF',
          400: '#5797FF',
          500: '#0A68FF',
          600: '#0048BB',
          700: '#003D9E',
          800: '#003385',
          900: '#00296B',
          950: '#001D4D',
        },
        secondary: '#64748B',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        diffusion: '0 20px 40px -15px rgba(15, 23, 42, 0.08)',
        card: '0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.03)',
        dock: '0 24px 48px -12px rgba(15, 23, 42, 0.24)',
        cobalt: '0 12px 24px -8px rgba(0, 72, 187, 0.32)',
      },
      spacing: {
        4.5: '1.125rem',
      },
      gridTemplateColumns: {
        15: 'repeat(15, minmax(0, 1fr))',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        breathe: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.82)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        steam: {
          '0%': { opacity: '0', transform: 'translateY(6px) scaleX(1)' },
          '40%': { opacity: '0.7' },
          '100%': { opacity: '0', transform: 'translateY(-14px) scaleX(1.4)' },
        },
        drawLine: {
          '0%': { strokeDashoffset: 'var(--dash, 400)' },
          '100%': { strokeDashoffset: '0' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(12px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        floaty: 'floaty 5s ease-in-out infinite',
        breathe: 'breathe 2.2s ease-in-out infinite',
        marquee: 'marquee 28s linear infinite',
        fadeUp: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
        steam: 'steam 2.4s ease-out infinite',
        drawLine: 'drawLine 1.6s cubic-bezier(0.16,1,0.3,1) both',
        modalIn: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1) both',
        fadeIn: 'fadeIn 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
