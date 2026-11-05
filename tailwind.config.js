/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Pitch green — the team's primary accent.
        pitch: {
          50: '#edfdf3',
          100: '#d4f9e1',
          200: '#abf1c7',
          300: '#73e4a6',
          400: '#3bcf81',
          500: '#16b364',
          600: '#0a9150',
          700: '#097442',
          800: '#0b5c37',
          900: '#0a4b2f',
          950: '#032a19',
        },
        // Charcoal / black surfaces.
        coal: {
          50: '#f6f7f8',
          100: '#eceef1',
          200: '#d4d8de',
          300: '#aeb5c0',
          400: '#828c9c',
          500: '#647081',
          600: '#4f5a68',
          700: '#414955',
          800: '#2a3038',
          900: '#1b1f25',
          925: '#15181d',
          950: '#0e1013',
          975: '#08090b',
        },
        willow: '#d8c3a5',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(22,179,100,0.35), 0 8px 32px -8px rgba(22,179,100,0.35)',
      },
      backgroundImage: {
        'pitch-gradient': 'linear-gradient(135deg, #0a9150 0%, #16b364 50%, #3bcf81 100%)',
        'coal-gradient': 'linear-gradient(160deg, #1b1f25 0%, #0e1013 100%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(22,179,100,0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgba(22,179,100,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(22,179,100,0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'slide-down': 'slide-down 0.2s ease-out both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.66,0,0,1) infinite',
      },
    },
  },
  plugins: [],
}
