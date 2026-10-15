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
        cream: {
          DEFAULT: '#FAF7F1',
          dark: '#F3EDE2',
          deep: '#EDE4D3',
        },
        ink: {
          DEFAULT: '#1C1917',
          soft: '#44403C',
          mute: '#78716C',
        },
        ember: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#D9622B',
          600: '#C2410C',
          700: '#9A3412',
          800: '#7C2D12',
          900: '#5C200C',
          950: '#431407',
        },
        leaf: {
          50: '#F0FDF4',
          600: '#15803D',
          700: '#166534',
        },
        primary: {
          DEFAULT: '#C2410C',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#D9622B',
          600: '#C2410C',
          700: '#9A3412',
          800: '#7C2D12',
          900: '#431407',
        },
        secondary: '#78716C',
      },
      boxShadow: {
        diffusion: '0 20px 40px -15px rgba(28,25,23,0.08)',
        card: '0 10px 25px -5px rgba(28,25,23,0.06), 0 8px 10px -6px rgba(28,25,23,0.03)',
        dock: '0 24px 48px -12px rgba(28,25,23,0.22)',
        ember: '0 12px 24px -8px rgba(194,65,12,0.35)',
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
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        floaty: 'floaty 5s ease-in-out infinite',
        breathe: 'breathe 2.2s ease-in-out infinite',
        marquee: 'marquee 28s linear infinite',
        fadeUp: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
        steam: 'steam 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
