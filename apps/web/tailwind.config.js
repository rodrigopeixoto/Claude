/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#4F46E5', dark: '#3730A3', light: '#818CF8' },
      },
    },
  },
  plugins: [],
};
