/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D6A4F',
          50: '#E8F4EF',
          100: '#C5E3D4',
          200: '#9FCFB7',
          300: '#6DB899',
          400: '#47A37F',
          500: '#2D6A4F',
          600: '#255A43',
          700: '#1C4734',
          800: '#133325',
          900: '#0A1F16',
        },
        secondary: {
          DEFAULT: '#E07A5F',
          50: '#FDF0EC',
          100: '#F9D8CE',
          200: '#F4B9A8',
          300: '#EF9A82',
          400: '#E88A70',
          500: '#E07A5F',
          600: '#D4624A',
          700: '#BE4E38',
          800: '#9B3D2B',
          900: '#7A2E1F',
        },
        accent: {
          DEFAULT: '#F2CC8F',
        },
        background: '#FAFAF8',
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
