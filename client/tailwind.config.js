/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nest: {
          950: '#060B1C',
          900: '#0A1128',
          850: '#0D1633',
          800: '#101A3C',
          700: '#182452',
          600: '#22306B',
          500: '#2E3F86',
        },
      },
      fontFamily: {
        mono: ['Consolas', '"JetBrains Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
