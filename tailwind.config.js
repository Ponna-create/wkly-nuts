/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D8B7B',
          50: '#E8F5F2',
          100: '#D1EBE5',
          200: '#A3D7CB',
          300: '#75C3B1',
          400: '#47AF97',
          500: '#2D8B7B',
          600: '#246F62',
          700: '#1B534A',
          800: '#123731',
          900: '#091B19',
        },
        accent: {
          DEFAULT: '#FF9580',
          50: '#FFF4F2',
          100: '#FFE9E5',
          200: '#FFD3CC',
          300: '#FFBDB2',
          400: '#FFA799',
          500: '#FF9580',
          600: '#FF7A5C',
          700: '#FF5F38',
          800: '#FF4414',
          900: '#EF2900',
        }
      }
    },
  },
  plugins: [],
}
