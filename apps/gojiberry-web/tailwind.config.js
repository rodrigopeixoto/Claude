/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#16A34A', dark: '#15803D', light: '#4ADE80', ink: '#052E16' },
      },
    },
  },
  plugins: [],
};
