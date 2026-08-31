/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { 
        primary: '#C8D100', 
        primaryDark: '#898F00' 
      },
      fontFamily: { 
        sans: ['Share Tech', 'sans-serif'] 
      }
    }
  },
  plugins: [],
}
