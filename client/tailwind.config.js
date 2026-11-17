/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Instrument Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#EEF1F5',
        line: { DEFAULT: '#DDE2E9', soft: '#E8ECF1' },
        ink: { DEFAULT: '#0E1A2B', soft: '#3F4B5E', mute: '#6B788C', faint: '#98A3B3' },
        // reply owners: one colour each, used everywhere
        cobalt: { 50: '#EEF3FF', 100: '#DCE7FF', 200: '#BCD0FF', 500: '#2F5BEA', 600: '#2449C7', 700: '#1C3A9E' },
        marigold: { 50: '#FFF8E1', 100: '#FFEDB8', 200: '#FFDC70', 400: '#F5B800', 500: '#E8A400', 700: '#7A4F00' },
        orchid: { 50: '#F6EFFF', 100: '#EAD9FF', 200: '#D6B8FF', 500: '#8B3FD9', 600: '#7430BD', 700: '#5B2596' },
      },
      boxShadow: {
        pop: '0 12px 32px -8px rgba(14,26,43,.22), 0 2px 6px rgba(14,26,43,.08)',
        sheet: '-16px 0 40px -12px rgba(14,26,43,.25)',
        lift: '0 1px 2px rgba(14,26,43,.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-left': { from: { transform: 'translateX(24px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        'slide-up': { from: { transform: 'translateY(16px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        pop: { from: { transform: 'scale(.96)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        settle: { '0%': { backgroundColor: 'rgba(245,184,0,.28)' }, '100%': { backgroundColor: 'transparent' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'slide-left': 'slide-left .22s cubic-bezier(.2,.8,.2,1)',
        'slide-up': 'slide-up .22s cubic-bezier(.2,.8,.2,1)',
        pop: 'pop .16s ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
        settle: 'settle 2.4s ease-out',
      },
    },
  },
  plugins: [],
};
