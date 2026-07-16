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
          50: '#f0f6ff',
          100: '#e1effe',
          200: '#c3ddfd',
          300: '#96c5fc',
          400: '#5fa3f9',
          500: '#3b82f6', // bright blue
          600: '#2563eb', // medium blue
          700: '#1a56db', // deep brand blue
          800: '#1e429f',
          900: '#111827',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      screens: {
        'xs': '480px',
      }
    },
  },
  plugins: [],
}
