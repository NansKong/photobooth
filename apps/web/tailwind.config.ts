import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#5D969C',
        surface: {
          DEFAULT: '#F4EFE6',
          50: '#FFFFFF',
          100: '#FAF7F2',
          200: '#EBE4D5',
        },
        retro: {
          teal: {
            DEFAULT: '#6BA3A9',
            light: '#86B9BF',
            dark: '#50848A',
            bg: '#5D969C',
          },
          cream: {
            DEFAULT: '#F4EFE6',
            paper: '#EBE4D5',
            dark: '#DDD4C0',
          },
          terracotta: {
            DEFAULT: '#D67C65',
            hover: '#C26750',
            dark: '#9C442E',
            light: '#E59580',
          },
          charcoal: {
            DEFAULT: '#282A2B',
            light: '#3D4042',
            dark: '#1C1D1E',
          },
          mustard: {
            DEFAULT: '#DDA853',
            hover: '#C4913B',
          },
        },
        primary: {
          DEFAULT: '#D67C65',
          hover: '#C26750',
          light: '#E59580',
        },
      },
      fontFamily: {
        retro: ['Righteous', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        mono: ['Courier Prime', 'monospace'],
      },
      animation: {
        'flash': 'flash 0.6s ease-out forwards',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shutter': 'shutter 0.4s ease-in-out',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        flash: {
          '0%': { opacity: '0.95', backgroundColor: '#ffffff' },
          '100%': { opacity: '0', backgroundColor: 'transparent' },
        },
        shutter: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      boxShadow: {
        'retro': '0 8px 0 rgba(40, 42, 43, 0.3), 0 15px 25px -5px rgba(0, 0, 0, 0.2)',
        'retro-sm': '0 4px 0 rgba(40, 42, 43, 0.25)',
        'retro-pressed': '0 2px 0 rgba(40, 42, 43, 0.3)',
        'polaroid': '0 12px 35px -8px rgba(30, 41, 59, 0.25), 0 4px 10px rgba(0, 0, 0, 0.08)',
        'photobooth': '0 25px 60px -15px rgba(40, 42, 43, 0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
