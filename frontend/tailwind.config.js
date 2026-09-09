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
          DEFAULT: '#1E3A5F', // Primary Navy
          light: '#2D5282',
        },
        accent: {
          DEFAULT: '#E67E22', // Accent Orange
        },
        surface: '#FFFFFF',
        background: '#F8FAFC',
        border: '#E2E8F0',
        text: {
          primary: '#1A202C',
          secondary: '#64748B',
        },
        success: '#16A34A',
        warning: '#D97706',
        violation: '#DC2626',
        sidebar: {
          DEFAULT: '#1E3A5F',
          text: '#CBD5E1',
        }
      },
    },
  },
  plugins: [],
}
