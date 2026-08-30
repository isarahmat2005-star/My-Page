/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Mengambil warna utama dari desain HTML sebelumnya
      colors: {
        primary: '#C8D100',
        primaryDark: '#898F00'
      },
      // Menggunakan font Share Tech sebagai default UI
      fontFamily: {
        sans: ['Share Tech', 'sans-serif']
      }
    },
  },
  plugins: [],
}
